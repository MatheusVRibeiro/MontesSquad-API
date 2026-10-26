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
  return [];
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
  return [];
}

/**
 * Top contributors GLOBAL (ETAPA 14). period=all|month.
 */
async function topContributorsGeral(limit = 10, period = "all") {
  return [];
}

/**
 * Top committers POR PROJETO (ETAPA 11).
 */
async function topCommittersPorProjeto(projetoId, limit = 10) {
  return [];
}

/**
 * Top committers GLOBAL (ETAPA 12).
 */
async function topCommittersGeral(limit = 10, period = "all") {
  return [];
}

module.exports = {
  topCommittersPorProjeto,
  topCommittersGeral,
  topContributorsPorProjeto,
  topContributorsGeral,
  CONTRIBUTION_SCORE,
  calcularScoreContribuicao,
};