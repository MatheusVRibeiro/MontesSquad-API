// Controller GitHub — webhook e processamento de eventos (ETAPA 4+)
const webhookService = require("../services/githubWebhook");
const githubApp = require("../services/githubApp");
const db = require("../database/connection");

/**
 * POST /projetos/:projetoId/github/repository — conecta um repositório ao projeto.
 * Somente owner. O backend consulta o GitHub (nunca confia no full_name do browser).
 */
async function conectarRepository(request, response, next) {
  try {
    const { projetoId } = request.params;
    const { installationId, repositoryId } = request.body || {};

    if (!installationId || !repositoryId) {
      return response.status(400).json({ sucesso: false, message: "installationId e repositoryId são obrigatórios", dados: null });
    }

    // Busca dados do repositório direto do GitHub (autoridade)
    let repo;
    try {
      repo = await githubApp.getRepositoryById(installationId, repositoryId);
    } catch (e) {
      return response.status(404).json({ sucesso: false, message: "Repositório não encontrado ou não autorizado pela instalação", dados: null });
    }

    if (!repo || !repo.id) {
      return response.status(404).json({ sucesso: false, message: "Repositório não encontrado", dados: null });
    }

    // Valida que o projeto existe
    const [projRows] = await db.query("SELECT id, titulo FROM projetos WHERE id = ?", [projetoId]);
    if (projRows.length === 0) {
      return response.status(404).json({ sucesso: false, message: "Projeto não encontrado", dados: null });
    }

    await db.query(
      `UPDATE projetos SET
         github_repository_id = ?, github_repository_full_name = ?, github_installation_id = ?,
         github_default_branch = ?, github_connected_at = NOW(), repositorio_url = ?
       WHERE id = ?`,
      [
        repo.id,
        repo.full_name || null,
        Number(installationId),
        repo.default_branch || "main",
        repo.html_url || null,
        projetoId,
      ]
    );

    return response.status(200).json({
      sucesso: true,
      message: "Repositório conectado ao projeto",
      dados: {
        github_repository_id: repo.id,
        github_repository_full_name: repo.full_name,
        github_installation_id: Number(installationId),
        github_default_branch: repo.default_branch || "main",
        repositorio_url: repo.html_url,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /projetos/:projetoId/github/status — status da conexão GitHub do projeto.
 * Membro/dono.
 */
async function statusRepository(request, response, next) {
  try {
    const { projetoId } = request.params;
    const [rows] = await db.query(
      `SELECT github_repository_id, github_repository_full_name, github_installation_id,
              github_default_branch, github_connected_at, repositorio_url
       FROM projetos WHERE id = ?`,
      [projetoId]
    );
    if (rows.length === 0) {
      return response.status(404).json({ sucesso: false, message: "Projeto não encontrado", dados: null });
    }
    const p = rows[0];
    const conectado = !!(p.github_repository_id && p.github_repository_full_name);
    return response.status(200).json({
      sucesso: true,
      message: conectado ? "Projeto conectado ao GitHub" : "Projeto sem GitHub",
      dados: {
        conectado,
        github_repository_id: p.github_repository_id ?? null,
        github_repository_full_name: p.github_repository_full_name ?? null,
        github_installation_id: p.github_installation_id ?? null,
        github_default_branch: p.github_default_branch ?? null,
        github_connected_at: p.github_connected_at ?? null,
        repositorio_url: p.repositorio_url ?? null,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /projetos/:projetoId/github/repository — desconecta o repositório.
 * Somente owner. NÃO apaga tasks nem histórico de commits.
 */
async function desconectarRepository(request, response, next) {
  try {
    const { projetoId } = request.params;
    const [result] = await db.query(
      `UPDATE projetos SET
         github_repository_id = NULL, github_repository_full_name = NULL, github_installation_id = NULL,
         github_default_branch = NULL, github_connected_at = NULL, repositorio_url = NULL
       WHERE id = ?`,
      [projetoId]
    );
    if (result.affectedRows === 0) {
      return response.status(404).json({ sucesso: false, message: "Projeto não encontrado", dados: null });
    }
    return response.status(200).json({ sucesso: true, message: "Repositório desconectado (tasks preservadas)", dados: null });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /github/installations/:installationId/repositories — lista repositórios da instalação.
 * Usado pelo frontend para o owner escolher o repositório.
 */
async function listarRepositoriesInstalacao(request, response, next) {
  try {
    const { installationId } = request.params;
    const repos = await githubApp.listInstallationRepositories(installationId);
    const dados = repos.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      html_url: r.html_url,
      default_branch: r.default_branch || "main",
      private: !!r.private,
    }));
    return response.status(200).json({ sucesso: true, message: "Repositórios da instalação", nItens: dados.length, dados });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /github/webhook — entrada pública de eventos do GitHub.
 * NÃO usa verificarToken; a autenticação é a assinatura HMAC (X-Hub-Signature-256).
 */
async function webhook(request, response, next) {
  try {
    // 1. raw body preservado pelo middleware express.raw() em index.js
    const rawBody = request.rawBody || "";
    if (!rawBody) {
      return response.status(400).json({ sucesso: false, message: "Body vazio" });
    }

    // 2. validar assinatura
    const signature = request.headers["x-hub-signature-256"] || request.headers["x-hub-signature"];
    if (!webhookService.verifyWebhookSignature(rawBody, signature)) {
      return response.status(401).json({ sucesso: false, message: "Assinatura inválida" });
    }

    // 3. identificar delivery e evento
    const deliveryId = webhookService.getDeliveryId(request);
    const eventName = webhookService.getEventName(request);

    if (!deliveryId) {
      return response.status(400).json({ sucesso: false, message: "X-GitHub-Delivery ausente" });
    }

    // 4. idempotência: delivery já processado com sucesso? responde 200 sem reprocessar
    if (await webhookService.isDeliveryDuplicate(deliveryId)) {
      return response.status(200).json({ sucesso: true, message: "Delivery já processado", idempotente: true });
    }

    // 5. parse do payload (JSON)
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return response.status(400).json({ sucesso: false, message: "JSON inválido" });
    }

    const repositoryId = payload?.repository?.id ?? null;
    const actionName = payload?.action ?? null;

    // 6. registrar delivery (INSERT IGNORE — idempotente)
    await webhookService.registerDelivery({ deliveryId, eventName, actionName, repositoryId });

    // 7. delegar para o processador de eventos (push/PR nas ETAPAS 8/9)
    const events = require("../services/githubEvents");
    try {
      const resultado = await events.processGitHubEvent(eventName, payload, { deliveryId, repositoryId });
      if (resultado && resultado.processado === false) {
        // handler ainda pendente (ETAPA 4): aceita, mas não marca como processado com efeito
        await webhookService.markDeliveryProcessed(deliveryId);
        return response.status(200).json({
          sucesso: true,
          message: "Webhook recebido",
          processado: true,
          motivo: resultado.motivo || null,
          deliveryId,
        });
      }
    } catch (e) {
      await webhookService.markDeliveryFailed(deliveryId, e);
      return response.status(200).json({ sucesso: true, message: "Webhook recebido (falha de processamento)", processado: false });
    }

    // 8. marcar processado e responder 200
    await webhookService.markDeliveryProcessed(deliveryId);
    return response.status(200).json({ sucesso: true, message: "Webhook recebido", processado: true, deliveryId });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  webhook,
  conectarRepository,
  statusRepository,
  desconectarRepository,
  listarRepositoriesInstalacao,
};