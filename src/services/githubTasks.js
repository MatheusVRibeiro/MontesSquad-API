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
 * Retorna true se inseriu, false se já existia.
 */
async function salvarCommit({ repositoryId, sha, mensagem, autor, login, email, url, horario, branch, conn }) {
  const executor = conn || db;
  const [result] = await executor.query(
    `INSERT IGNORE INTO github_commits
      (repository_id, sha, mensagem, autor, login, email, url, commit_em, branch)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [repositoryId, sha, mensagem, autor, login || null, email || null, url || null, horario, branch || null]
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

module.exports = { encontrarTaskPorBranch, salvarCommit, atualizarAtividadeTask: atualizarAtividadeTask };