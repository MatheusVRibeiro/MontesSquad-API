// Rankings de commits GitHub (ETAPAS 11-12)
// Conta SOMENTE commits registrados dentro de projetos/tasks do MontesSquad
// (tabela github_commits), nunca commits externos soltos do perfil GitHub.
const db = require("../database/connection");

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