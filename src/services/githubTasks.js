// Resolução de tarefas a partir de eventos GitHub (ETAPA 8)
// A branch é a fonte da verdade: task/{id}-{slug} → tarefa id.
const db = require("../database/connection");

/**
 * Encontra a tarefa que corresponde a uma branch do repositório.
 * Prioridade: match exato por github_branch; fallback por padrão task/{id}-.
 */
async function encontrarTaskPorBranch({ repositoryId, branch }) {
  if (!repositoryId || !branch) return null;

  // 1. Match exato (branch registrada na task)
  const [exato] = await db.query(
    `SELECT t.id, t.projeto_id, t.titulo, t.status, t.responsavel_id, t.github_branch
     FROM tarefas t
     JOIN projetos p ON p.id = t.projeto_id
     WHERE p.github_repository_id = ? AND t.github_branch = ?
     LIMIT 1`,
    [repositoryId, branch]
  );
  if (exato.length > 0) return exato[0];

  // 2. Fallback: branch segue o padrão task/{id}-... (mesmo sem github_branch preenchido)
  const match = /^task\/(\d+)(?:-|$)/.exec(branch);
  if (match) {
    const [porId] = await db.query(
      `SELECT t.id, t.projeto_id, t.titulo, t.status, t.responsavel_id, t.github_branch
       FROM tarefas t
       JOIN projetos p ON p.id = t.projeto_id
       WHERE p.github_repository_id = ? AND t.id = ?
       LIMIT 1`,
      [repositoryId, Number(match[1])]
    );
    if (porId.length > 0) return porId[0];
  }

  return null;
}

/**
 * Registra um commit (INSERT IGNORE na unique key repository_id + sha).
 * Schema real: tarefa_id/projeto_id NOT NULL + message + author_login/name/email + commit_url + committed_at.
 * Retorna true se inseriu, false se já existia.
 */
async function salvarCommit({ tarefaId, projetoId, repositoryId, sha, mensagem, autor, login, email, url, horario, branch, conn }) {
  const executor = conn || db;
  const [result] = await executor.query(
    `INSERT IGNORE INTO github_commits
      (tarefa_id, projeto_id, repository_id, sha, message, author_login, author_name, author_email, branch, commit_url, committed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tarefaId, projetoId, repositoryId, sha, mensagem, login || null, autor || null, email || null, branch || null, url || null, horario || null]
  );
  return result.affectedRows > 0;
}

/** Atualiza a atividade recente da task (github_last_activity_at). */
async function atualizarAtividadeTask(taskId, conn) {
  const executor = conn || db;
  await executor.query(
    "UPDATE tarefas SET github_last_activity_at = NOW() WHERE id = ?",
    [taskId]
  );
}

/**
 * Upsert do Pull Request em github_pull_requests (ETAPA 9).
 * Schema real: tarefa_id/projeto_id NOT NULL + github_pr_id/numero/url/head_branch/estado/mergeado_em.
 * INSERT ... ON DUPLICATE KEY UPDATE (unique repository_id + numero).
 */
async function upsertPullRequest({ tarefaId, projetoId, repositoryId, prId, prNumber, prUrl, branch, estado, mergedAt, conn }) {
  const executor = conn || db;
  await executor.query(
    `INSERT INTO github_pull_requests
      (tarefa_id, projeto_id, repository_id, github_pr_id, numero, url, head_branch, estado, mergeado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       github_pr_id = VALUES(github_pr_id),
       url = VALUES(url),
       head_branch = VALUES(head_branch),
       estado = VALUES(estado),
       mergeado_em = VALUES(mergeado_em)`,
    [tarefaId, projetoId, repositoryId, prId, prNumber, prUrl, branch, estado, mergedAt || null]
  );
}

/**
 * Atualiza a task quando um PR abre/reabre/sincroniza (ETAPA 9).
 * opened/reopened → status review; synchronize mantém review.
 */
async function atualizarTaskPorPR({ taskId, prId, prNumber, prUrl, status, conn }) {
  const executor = conn || db;
  await executor.query(
    `UPDATE tarefas SET
       github_pr_id = ?, github_pr_number = ?, github_pr_url = ?,
       github_pr_status = ?, status = 'review', github_last_activity_at = NOW()
     WHERE id = ?`,
    [prId, prNumber, prUrl, status, taskId]
  );
}

/**
 * Conclui a task por merge de PR (ETAPA 9) — transacional e idempotente.
 * Retorna { concluida: true } se concluiu agora; { concluida: false, jaConcluida: true }
 * se já estava concluída pelo mesmo PR.
 */
async function concluirTaskPorMerge({ taskId, prId, prNumber, prUrl, mergedAt, conn }) {
  const executor = conn || db;
  const [rows] = await executor.query(
    `SELECT id, status, completion_source, github_pr_id
     FROM tarefas WHERE id = ? LIMIT 1`,
    [taskId]
  );
  if (rows.length === 0) return { concluida: false, inexistente: true };

  const task = rows[0];
  // Idempotência: já concluída pelo MESMO PR → sem efeitos
  if (task.status === "done" && task.completion_source === "github_merge" && task.github_pr_id === prId) {
    return { concluida: false, jaConcluida: true };
  }

  await executor.query(
    `UPDATE tarefas SET
       github_pr_id = ?, github_pr_number = ?, github_pr_url = ?,
       github_pr_status = 'merged', status = 'done',
       completion_source = 'github_merge', completed_at = ?,
       github_last_activity_at = NOW()
     WHERE id = ?`,
    [prId, prNumber, prUrl, mergedAt || new Date(), taskId]
  );

  return { concluida: true };
}

function getDb() {
  return db;
}

module.exports = {
  encontrarTaskPorBranch,
  salvarCommit,
  atualizarAtividadeTask,
  upsertarPR: upsertPullRequest,
  atualizarTaskPorPR,
  concluirTaskPorMerge,
};