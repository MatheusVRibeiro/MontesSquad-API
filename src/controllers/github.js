// Controller GitHub — webhook e processamento de eventos (ETAPA 4+)
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const webhookService = require("../services/githubWebhook");
const githubApp = require("../services/githubApp");
const db = require("../database/connection");

const GITHUB_OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_OAUTH_TOKEN = "https://github.com/login/oauth/access_token";

/** Gera o state anti-CSRF do OAuth (JWT curto assinado com JWT_SECRET). */
function gerarStateOAuth(usuarioId) {
  return jwt.sign({ oauth: "github", uid: usuarioId }, process.env.JWT_SECRET, { expiresIn: "10m" });
}

/** Valida o state do OAuth e devolve o usuário id (null se inválido/expirado). */
function validarStateOAuth(state) {
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET);
    if (!payload || payload.oauth !== "github" || !payload.uid) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

/** GET /github/me — estado de conexão do usuário autenticado. */
async function me(request, response, next) {
  try {
    const usuarioLogadoId = request.usuarioAutenticado.id;
    const [rows] = await db.query(
      `SELECT github_user_id, github_login, github_avatar_url, github_connected_at
       FROM usuarios WHERE id = ? LIMIT 1`,
      [usuarioLogadoId]
    );
    const u = rows[0] || {};
    const conectado = !!(u.github_user_id && u.github_login);
    return response.status(200).json({
      sucesso: true,
      message: conectado ? "Conta GitHub conectada" : "Conta GitHub não conectada",
      dados: {
        conectado,
        github_user_id: u.github_user_id ?? null,
        github_login: u.github_login ?? null,
        github_avatar_url: u.github_avatar_url ?? null,
        github_connected_at: u.github_connected_at ?? null,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/** GET /github/connect — inicia OAuth do usuário (redirect para GitHub com state anti-CSRF). */
async function connect(request, response, next) {
  try {
    const usuarioId = request.usuarioAutenticado.id;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL || "http://localhost:3333/github/callback";
    if (!clientId) {
      return response.status(500).json({ sucesso: false, message: "GITHUB_CLIENT_ID não configurado", dados: null });
    }
    const state = gerarStateOAuth(usuarioId);
    const url =
      `${GITHUB_OAUTH_AUTHORIZE}?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&state=${encodeURIComponent(state)}&scope=read:user`;
    return response.status(200).json({ sucesso: true, message: "URL de conexão", dados: { url, state } });
  } catch (error) {
    return next(error);
  }
}

/** Troca o code do GitHub pelo token de acesso e busca o usuário. */
async function trocarCodePorUsuarioGitHub(code) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const callbackUrl = process.env.GITHUB_CALLBACK_URL || "http://localhost:3333/github/callback";
  if (!clientId || !clientSecret) {
    throw new Error("GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET não configurados");
  }

  const tokenRes = await fetch(GITHUB_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "MontesSquad" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error("Falha ao obter token do GitHub");
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json", "User-Agent": "MontesSquad" },
  });
  return userRes.json();
}

/** GET /github/callback — recebe code+state do GitHub e vincula a conta. */
async function callback(request, response, next) {
  try {
    const { code, state } = request.query || {};
    if (!code || !state) {
      return response.status(400).json({ sucesso: false, message: "code e state são obrigatórios", dados: null });
    }
    const usuarioId = validarStateOAuth(String(state));
    if (!usuarioId) {
      return response.status(401).json({ sucesso: false, message: "state inválido ou expirado", dados: null });
    }

    const gh = await trocarCodePorUsuarioGitHub(String(code));
    if (!gh || !gh.id) {
      return response.status(502).json({ sucesso: false, message: "Não foi possível obter o usuário do GitHub", dados: null });
    }

    // Evita que o MESMO github_user_id seja vinculado a outro usuário MontesSquad
    const [dup] = await db.query(
      "SELECT id FROM usuarios WHERE github_user_id = ? AND id != ? LIMIT 1",
      [gh.id, usuarioId]
    );
    if (dup.length > 0) {
      return response.status(409).json({ sucesso: false, message: "Conta GitHub já vinculada a outro usuário", dados: null });
    }

    await db.query(
      `UPDATE usuarios SET
         github_user_id = ?, github_login = ?, github_avatar_url = ?, github_connected_at = NOW()
       WHERE id = ?`,
      [gh.id, gh.login || null, gh.avatar_url || null, usuarioId]
    );

    const frontendUrl = process.env.GITHUB_FRONTEND_SUCCESS_URL || "http://localhost:5173";
    return response.redirect(`${frontendUrl}/configuracoes?github=connected`);
  } catch (error) {
    return next(error);
  }
}

/** DELETE /github/disconnect — remove o vínculo (histórico de commits preservado). */
async function disconnect(request, response, next) {
  try {
    const usuarioLogadoId = request.usuarioAutenticado.id;
    await db.query(
      `UPDATE usuarios SET github_user_id = NULL, github_login = NULL, github_avatar_url = NULL, github_connected_at = NULL
       WHERE id = ?`,
      [usuarioLogadoId]
    );
    return response.status(200).json({ sucesso: true, message: "Conta GitHub desconectada (histórico preservado)", dados: null });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /projetos/:projetoId/tarefas/:tarefaId/github — status GitHub da task (ETAPA 8).
 * Membro/dono.
 */
async function taskGithubStatus(request, response, next) {
  try {
    const { projetoId, tarefaId } = request.params;
    const [rows] = await db.query(
      `SELECT t.github_branch, t.github_pr_number, t.github_pr_url, t.github_pr_status,
              t.github_last_activity_at, t.concluida_via AS completion_source, t.concluida_em AS completed_at
       FROM tarefas t WHERE t.id = ? AND t.projeto_id = ? LIMIT 1`,
      [tarefaId, projetoId]
    );
    if (rows.length === 0) {
      return response.status(404).json({ sucesso: false, message: "Tarefa não encontrada", dados: null });
    }
    const t = rows[0];
    return response.status(200).json({
      sucesso: true,
      message: "Status GitHub da tarefa",
      dados: {
        github_branch: t.github_branch ?? null,
        github_pr_number: t.github_pr_number ?? null,
        github_pr_url: t.github_pr_url ?? null,
        github_pr_status: t.github_pr_status ?? null,
        github_last_activity_at: t.github_last_activity_at ?? null,
        completion_source: t.completion_source ?? null,
        completed_at: t.completed_at ?? null,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /projetos/:projetoId/tarefas/:tarefaId/commits — commits da branch da task (ETAPA 8).
 * Membro/dono.
 */
async function taskCommits(request, response, next) {
  try {
    const { projetoId, tarefaId } = request.params;

    // Resolve a branch da task
    const [taskRows] = await db.query(
      `SELECT t.github_branch, p.github_repository_id AS repository_id
       FROM tarefas t JOIN projetos p ON p.id = t.projeto_id
       WHERE t.id = ? AND t.projeto_id = ? LIMIT 1`,
      [tarefaId, projetoId]
    );
    if (taskRows.length === 0) {
      return response.status(404).json({ sucesso: false, message: "Tarefa não encontrada", dados: null });
    }
    const { github_branch: branch, repository_id: repositoryId } = taskRows[0];

    if (!repositoryId || !branch) {
      return response.status(200).json({ sucesso: true, message: "Sem GitHub vinculado", nItens: 0, dados: [] });
    }

    const [commits] = await db.query(
      `SELECT sha, message, author_name, author_login, author_email, commit_url, committed_at, branch
       FROM github_commits
       WHERE repository_id = ? AND branch = ?
       ORDER BY committed_at DESC
       LIMIT 50`,
      [repositoryId, branch]
    );

    return response.status(200).json({
      sucesso: true,
      message: "Commits da tarefa",
      nItens: commits.length,
      dados: commits.map((c) => ({
        sha: c.sha,
        sha_curto: String(c.sha).slice(0, 7),
        mensagem: c.message,
        autor: c.author_name,
        login: c.author_login,
        email: c.author_email,
        url: c.commit_url,
        commit_em: c.committed_at,
        branch: c.branch,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /projetos/:projetoId/tarefas/:tarefaId/timeline — timeline técnica da task (ETAPA 15).
 * Derivada das tabelas atuais (sem tabela nova): assumida, branch, commits,
 * PR aberto/mergeado, conclusão. Membro/dono.
 */
async function taskTimeline(request, response, next) {
  try {
    const { projetoId, tarefaId } = request.params;

    const [taskRows] = await db.query(
      `SELECT t.id, t.titulo, t.status, t.github_branch, t.assumida_em,
              t.github_pr_number, t.github_pr_status, t.github_last_activity_at,
              t.concluida_via AS completion_source, t.concluida_em AS completed_at, u.nome AS responsavel_nome
       FROM tarefas t
       LEFT JOIN usuarios u ON u.id = t.responsavel_id
       WHERE t.id = ? AND t.projeto_id = ? LIMIT 1`,
      [tarefaId, projetoId]
    );
    if (taskRows.length === 0) {
      return response.status(404).json({ sucesso: false, message: "Tarefa não encontrada", dados: null });
    }
    const t = taskRows[0];

    const eventos = [];

    // 1. Tarefa assumida
    if (t.assumida_em) {
      eventos.push({ tipo: "assumida", titulo: "Tarefa assumida", detalhe: t.responsavel_nome || null, quando: t.assumida_em });
    }

    // 2. Branch vinculada (quando assumida ou criada com github_branch)
    if (t.github_branch) {
      eventos.push({ tipo: "branch", titulo: "Branch vinculada", detalhe: t.github_branch, quando: t.assumida_em || null });
    }

    // 3. Commits (github_commits)
    const [commits] = await db.query(
      `SELECT sha, message, author_name, commit_url, committed_at
       FROM github_commits WHERE tarefa_id = ? ORDER BY committed_at ASC`,
      [tarefaId]
    );
    for (const c of commits) {
      eventos.push({
        tipo: "commit",
        titulo: "Commit",
        detalhe: c.message || null,
        sha: String(c.sha).slice(0, 7),
        autor: c.author_name || null,
        url: c.commit_url || null,
        quando: c.committed_at,
      });
    }

    // 4. PRs (github_pull_requests via tarefa)
    const [prs] = await db.query(
      `SELECT numero, url, estado, mergeado_em
       FROM github_pull_requests WHERE tarefa_id = ? ORDER BY id ASC`,
      [tarefaId]
    );
    for (const pr of prs) {
      if (pr.estado === "merged") {
        eventos.push({ tipo: "pr_merged", titulo: `PR #${pr.numero} mergeado`, detalhe: "Contribuição verificada", url: pr.url, quando: pr.mergeado_em });
      } else if (pr.estado === "closed") {
        eventos.push({ tipo: "pr_closed", titulo: `PR #${pr.numero} fechado sem merge`, detalhe: "Tarefa voltou para Em progresso", url: pr.url, quando: pr.mergeado_em || null });
      } else {
        eventos.push({ tipo: "pr_open", titulo: `PR #${pr.numero} aberto`, detalhe: "Tarefa em revisão", url: pr.url, quando: null });
      }
    }

    // 5. Conclusão
    if (t.completion_source === "github_merge" && t.completed_at) {
      eventos.push({ tipo: "concluida", titulo: "Tarefa concluída via GitHub", detalhe: "Merge verificado", quando: t.completed_at });
    }

    // Ordena por data (null por último)
    eventos.sort((a, b) => {
      if (!a.quando) return 1;
      if (!b.quando) return -1;
      return new Date(a.quando) - new Date(b.quando);
    });

    return response.status(200).json({
      sucesso: true,
      message: "Timeline da tarefa",
      nItens: eventos.length,
      dados: eventos,
    });
  } catch (error) {
    return next(error);
  }
}

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
  me,
  connect,
  callback,
  disconnect,
  trocarCodePorUsuarioGitHub,
  taskGithubStatus,
  taskCommits,
  taskTimeline,
};