// Processador de eventos GitHub (ETAPA 8 — push/commits; ETAPA 9 — pull_request)
// Recebe eventos já validados (assinatura + idempotência) pelo controller.
const githubTasks = require("./githubTasks");
const { criarNotificacao } = require("../controllers/notificacoes");
const db = require("../database/connection");

/**
 * Processa o evento push: registra commits de branches conhecidas.
 * Regras (spec ETAPA 8):
 * - branch conhecida → commit salvo (INSERT IGNORE, sem duplicar)
 * - branch desconhecida → delivery processado sem task alterada
 * - NÃO gera XP; NÃO conclui task.
 */
async function processarPush(payload, context = {}) {
  const { deliveryId } = context;
  const repositoryId = payload?.repository?.id ?? null;
  const branch = payload?.ref ? String(payload.ref).replace(/^refs\/heads\//, "") : null;

  if (!repositoryId || !branch) {
    return { processado: false, motivo: "push_sem_repo_ou_branch", deliveryId };
  }

  // Branch conhecida? (task/{id}-... ou github_branch registrado)
  const task = await githubTasks.encontrarTaskPorBranch({ repositoryId, branch });
  if (!task) {
    return { processado: true, motivo: "branch_desconhecida", deliveryId, branch };
  }

  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  let salvos = 0;
  for (const c of commits) {
    if (!c || !c.id) continue;
    const inserido = await githubTasks.salvarCommit({
      repositoryId,
      sha: c.id,
      mensagem: c.message || "",
      autor: c.author?.name || c.committer?.name || "Desconhecido",
      login: c.author?.username || c.committer?.username || null,
      email: c.author?.email || c.committer?.email || null,
      url: c.url || null,
      horario: c.timestamp || c.author?.date || null,
      branch,
    });
    if (inserido) salvos += 1;
  }

  if (salvos > 0) {
    await githubTasks.atualizarAtividadeTask(task.id);
  }

  return {
    processado: true,
    motivo: "commits_salvos",
    deliveryId,
    taskId: task.id,
    branch,
    commitsSalvos: salvos,
  };
}

/**
 * Processa o evento pull_request (ETAPA 9).
 * opened/reopened → review; synchronize → mantém review; closed sem merge → doing;
 * closed com merged=true → done (transacional, idempotente, XP na ETAPA 10).
 */
async function processarPullRequest(payload, context = {}) {
  const { deliveryId } = context;
  const action = payload?.action ?? null;
  const pr = payload?.pull_request ?? {};
  const repositoryId = payload?.repository?.id ?? null;
  const branch = pr?.head?.ref ?? null;

  if (!repositoryId || !branch || !pr?.number) {
    return { processado: false, motivo: "pr_sem_dados", deliveryId };
  }

  // Localiza a task pela branch do PR
  const task = await githubTasks.encontrarTaskPorBranch({ repositoryId, branch });
  if (!task) {
    return { processado: true, motivo: "pr_branch_desconhecida", deliveryId, branch };
  }

  const prId = pr.id;
  const prNumber = pr.number;
  const prUrl = pr.html_url || null;
  const mergedAt = pr.merged_at || null;

  if (action === "opened" || action === "reopened") {
    await githubTasks.upsertarPR({
      repositoryId, prId, prNumber, prUrl, branch,
      estado: "open", mergedAt: null,
    });
    await githubTasks.atualizarTaskPorPR({
      taskId: task.id, prId, prNumber, prUrl, status: "open",
    });
    return { processado: true, motivo: "pr_aberto", deliveryId, taskId: task.id, prNumber };
  }

  if (action === "synchronize") {
    await githubTasks.upsertarPR({
      repositoryId, prId, prNumber, prUrl, branch,
      estado: "open", mergedAt: null,
    });
    await githubTasks.atualizarAtividadeTask(task.id);
    return { processado: true, motivo: "pr_sincronizado", deliveryId, taskId: task.id, prNumber };
  }

  if (action === "closed") {
    if (pr.merged === true) {
      // MERGE → conclui a task (transacional + idempotente)
      const resultado = await githubTasks.concluirTaskPorMerge({
        taskId: task.id, prId, prNumber, prUrl, mergedAt,
      });
      if (resultado.concluida) {
        // Notificação (ETAPA 9; XP entra na ETAPA 10)
        try {
          await criarNotificacao(db, {
            usuario_id: task.responsavel_id,
            tipo: "task",
            titulo: "Tarefa concluída via GitHub",
            descricao: `PR #${prNumber} foi mergeado — tarefa concluída`,
            link: `/projetos/${task.projeto_id}`,
          });
        } catch {
          // notificação não deve derrubar o processamento
        }
      }
      return {
        processado: true,
        motivo: resultado.jaConcluida ? "pr_merge_ja_concluido" : "pr_merge_concluiu",
        deliveryId, taskId: task.id, prNumber,
      };
    }

    // closed sem merge → review volta para doing (MVP)
    await githubTasks.upsertarPR({
      repositoryId, prId, prNumber, prUrl, branch,
      estado: "closed", mergedAt: null,
    });
    await db.query(
      `UPDATE tarefas SET github_pr_status = 'closed', status = 'doing', github_last_activity_at = NOW()
       WHERE id = ?`,
      [task.id]
    );
    return { processado: true, motivo: "pr_closed_sem_merge", deliveryId, taskId: task.id, prNumber };
  }

  return { processado: true, motivo: "pr_acao_ignorada", deliveryId, action };
}

/**
 * Roteia o evento para o processador específico.
 */
async function processGitHubEvent(eventName, payload, context = {}) {
  if (eventName === "push") {
    return processarPush(payload, context);
  }
  if (eventName === "pull_request") {
    return processarPullRequest(payload, context);
  }
  // ping e outros eventos: aceitos sem efeitos
  return { processado: true, motivo: "evento_sem_acao", deliveryId: context.deliveryId };
}

module.exports = { processGitHubEvent, processarPush, processarPullRequest };