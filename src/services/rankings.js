// Rankings de commits GitHub (ETAPAS 11-14)
// Conta SOMENTE commits registrados dentro de projetos/tasks do MontesSquad
// (tabela github_commits), nunca commits externos soltos do perfil GitHub.
const db = require("../database/connection");

// ── Fórmula de contribuição (ETAPA 13) — ÚNICO lugar com a pontuação ──
const CONTRIBUTION_SCORE = {
  COMMIT: 1,
  MAX_COMMIT_POINTS_PER_TASK: 20,
  PR_OPENED: 10,
  PR_MERGED: 30,
  VERIFIED_TASK: 50,
};

/**
 * Calcula o score de contribuição de um usuário no projeto.
 * Anti-gaming: commits por task limitados a MAX_COMMIT_POINTS_PER_TASK.
 * @param {{commitCount: number, tasksComCommit: number, prsAbertos: number, prsMergeados: number, tasksVerificadas: number}} ev
 */
function calcularScoreContribuicao({ commitCount = 0, tasksComCommit = 0, prsAbertos = 0, prsMergeados = 0, tasksVerificadas = 0 } = {}) {
  const commits = Number(commitCount) || 0;
  const tasksCom = Number(tasksComCommit) || 0;
  // Anti-gaming: no máximo MAX_COMMIT_POINTS_PER_TASK de commits POR TASK.
  // Como agrupamos por usuário, o cap é aplicado por task — usamos o total de
  // tasks distintas como teto aproximado: commits por task = commits / tasks.
  const pontosCommits = Math.min(commits * CONTRIBUTION_SCORE.COMMIT, tasksCom * CONTRIBUTION_SCORE.MAX_COMMIT_POINTS_PER_TASK);
  return (
    pontosCommits +
    (Number(prsAbertos) || 0) * CONTRIBUTION_SCORE.PR_OPENED +
    (Number(prsMergeados) || 0) * CONTRIBUTION_SCORE.PR_MERGED +
    (Number(tasksVerificadas) || 0) * CONTRIBUTION_SCORE.VERIFIED_TASK
  );
}

/**
 * Busca as evidências agregadas por usuário para um filtro de projeto.
 * Retorna linhas com userId/name/githubLogin/avatarUrl/commitCount/tasksComCommit/
 * prsAbertos/prsMergeados/tasksVerificadas.
 */
async function evidenciasContribuicao({ projetoId = null, periodo = null } = {}) {
  const params = [];
  let filtroProjeto = "";
  let filtroProjetoPr = "";
  let filtroPeriodo = "";
  if (projetoId != null) {
    filtroProjeto = "AND g.projeto_id = ?";
    filtroProjetoPr = "AND t.projeto_id = ?";
    params.push(projetoId, projetoId);
  }
  if (periodo === "month") {
    filtroPeriodo = "AND g.criado_em >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
  }

  // GitHub_commits tem autor por author_github_id; github_pull_requests não tem
  // autor direto, então usamos a task responsável; eventos_xp identifica tasks
  // verificadas (github_merge) com o usuario_id.
  const [rows] = await db.query(
    `SELECT
       u.id AS userId,
       u.nome AS name,
       u.github_login AS githubLogin,
       u.avatar_url AS avatarUrl,
       COALESCE(c.commitCount, 0) AS commitCount,
       COALESCE(c.tasksComCommit, 0) AS tasksComCommit,
       COALESCE(pr.prsAbertos, 0) AS prsAbertos,
       COALESCE(pr.prsMergeados, 0) AS prsMergeados,
       COALESCE(tv.tasksVerificadas, 0) AS tasksVerificadas
     FROM usuarios u
     LEFT JOIN (
       SELECT author_github_id AS gid,
              COUNT(*) AS commitCount,
              COUNT(DISTINCT tarefa_id) AS tasksComCommit
       FROM github_commits g
       WHERE 1=1 ${filtroProjeto} ${filtroPeriodo}
       GROUP BY author_github_id
     ) c ON c.gid = u.github_user_id
     LEFT JOIN (
       SELECT t.responsavel_id AS uid,
              SUM(CASE WHEN pr.estado = 'open' THEN 1 ELSE 0 END) AS prsAbertos,
              SUM(CASE WHEN pr.estado = 'merged' THEN 1 ELSE 0 END) AS prsMergeados
       FROM github_pull_requests pr
       JOIN tarefas t ON t.id = pr.tarefa_id
       WHERE pr.estado IN ('open', 'merged') ${filtroProjetoPr}
       GROUP BY t.responsavel_id
     ) pr ON pr.uid = u.id
     LEFT JOIN (
       SELECT usuario_id AS uid, COUNT(*) AS tasksVerificadas
       FROM eventos_xp e
       WHERE e.tipo = 'github_merge' ${filtroPeriodo}
       GROUP BY usuario_id
     ) tv ON tv.uid = u.id
     WHERE (c.commitCount > 0 OR pr.prsAbertos > 0 OR pr.prsMergeados > 0 OR tv.tasksVerificadas > 0)
     ORDER BY commitCount DESC`,
    params
  );

  return rows.map((r) => ({
    userId: r.userId != null ? String(r.userId) : null,
    name: r.name || r.githubLogin || "Usuário",
    githubLogin: r.githubLogin || null,
    avatarUrl: r.avatarUrl || null,
    commitCount: Number(r.commitCount),
    prsAbertos: Number(r.prsAbertos),
    prsMergeados: Number(r.prsMergeados),
    tasksVerificadas: Number(r.tasksVerificadas),
  }));
}

/** Aplica a fórmula e ordena por score desc. */
function pontuarContribuicoes(evidencias) {
  return evidencias
    .map((e) => ({ ...e, score: calcularScoreContribuicao(e) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Top contributors POR PROJETO (ETAPA 13).
 */
async function topContributorsPorProjeto(projetoId, limit = 10) {
  const evidencias = await evidenciasContribuicao({ projetoId });
  return pontuarContribuicoes(evidencias).slice(0, Math.min(Number(limit) || 10, 50));
}

/**
 * Top contributors GLOBAL (ETAPA 14). period=all|month.
 */
async function topContributorsGeral(limit = 10, period = "all") {
  const evidencias = await evidenciasContribuicao({ periodo: period === "month" ? "month" : null });
  return pontuarContribuicoes(evidencias).slice(0, Math.min(Number(limit) || 10, 50));
}

module.exports = { topCommittersPorProjeto, topCommittersGeral, topContributorsPorProjeto, topContributorsGeral, CONTRIBUTION_SCORE, calcularScoreContribuicao };

/**
 * Top committers POR PROJETO (ETAPA 11).
 * Conta commits de github_commits vinculados a tasks do projeto, agrupados
 * pelo autor (JOIN usuarios por github_user_id quando o autor tem conta).
 */
async function topCommittersPorProjeto(projetoId, limit = 10) {
  const [rows] = await db.query(
    `SELECT
       u.id AS userId,
       u.nome AS name,
       u.github_login AS githubLogin,
       u.avatar_url AS avatarUrl,
       COUNT(c.id) AS commitCount
     FROM github_commits c
     LEFT JOIN usuarios u ON u.github_user_id = c.author_github_id
     WHERE c.projeto_id = ?
     GROUP BY u.id, u.nome, u.github_login, u.avatar_url
     ORDER BY commitCount DESC
     LIMIT ?`,
    [projetoId, Math.min(Number(limit) || 10, 50)]
  );
  return rows.map((r) => ({
    userId: r.userId != null ? String(r.userId) : null,
    name: r.name || r.githubLogin || "GitHub não vinculado",
    githubLogin: r.githubLogin || null,
    avatarUrl: r.avatarUrl || null,
    commitCount: Number(r.commitCount),
  }));
}

/**
 * Top committers GLOBAL (ETAPA 12).
 * ?period=month filtra commits do último mês; all (padrão) sem filtro.
 */
async function topCommittersGeral(limit = 10, period = "all") {
  const limite = Math.min(Number(limit) || 10, 50);
  const params = [];
  let filtroPeriodo = "";
  if (period === "month") {
    filtroPeriodo = "AND c.committed_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
  }

  const [rows] = await db.query(
    `SELECT
       u.id AS userId,
       u.nome AS name,
       u.github_login AS githubLogin,
       u.avatar_url AS avatarUrl,
       COUNT(c.id) AS commitCount
     FROM github_commits c
     LEFT JOIN usuarios u ON u.github_user_id = c.author_github_id
     WHERE 1=1 ${filtroPeriodo}
     GROUP BY u.id, u.nome, u.github_login, u.avatar_url
     ORDER BY commitCount DESC
     LIMIT ?`,
    [...params, limite]
  );
  return rows.map((r) => ({
    userId: r.userId != null ? String(r.userId) : null,
    name: r.name || r.githubLogin || "GitHub não vinculado",
    githubLogin: r.githubLogin || null,
    avatarUrl: r.avatarUrl || null,
    commitCount: Number(r.commitCount),
  }));
}

module.exports = { topCommittersPorProjeto, topCommittersGeral };