// Processador de eventos GitHub (ETAPA 8 — push/commits; ETAPA 9 adiciona pull_request)
// Recebe eventos já validados (assinatura + idempotência) pelo controller.
const githubTasks = require("./githubTasks");

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
 * Roteia o evento para o processador específico.
 */
async function processGitHubEvent(eventName, payload, context = {}) {
  if (eventName === "push") {
    return processarPush(payload, context);
  }
  if (eventName === "pull_request") {
    // ETAPA 9 implementa; por ora aceito sem efeitos
    return { processado: true, motivo: "pull_request_pendente_etapa9", deliveryId: context.deliveryId };
  }
  // ping e outros eventos: aceitos sem efeitos
  return { processado: true, motivo: "evento_sem_acao", deliveryId: context.deliveryId };
}

module.exports = { processGitHubEvent, processarPush };