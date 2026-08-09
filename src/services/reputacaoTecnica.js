// Reputação técnica do usuário (ETAPA 12) — SEPARADA do XP.
//
// Conceito (docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md #15):
//   - XP          = atividade/engajamento (gamificação) — src/services/xp.js;
//   - Reputação   = evidência de entrega e confiança (qualidade técnica).
//
// Regra de ouro: o score NUNCA é calculado com valores vindos do frontend.
// recalcularReputacao() lê o BANCO e grava o resultado em
// reputacao_tecnica_usuario (UPSERT). Subir XP não altera a reputação técnica
// automaticamente — ela só muda quando um evento de entrega real ocorre
// (merge de PR / conclusão manual) e o backend recalcula.
//
// ── Fórmula ponderada (ÚNICO lugar com a pontuação) ──────────────────────────
//   score = tasks_verificadas * 50   (task concluída por github_merge)
//         + prs_mergeados      * 30   (PR com estado 'merged' em task do usuário)
//         + commits_validos    * 1    (commit com author_github_id = usuário)
//         + projetos_com_entrega * 20 (projetos distintos com task verificada)
//
// Os pesos alinham com src/services/rankings.js (VERIFIED_TASK 50, PR_MERGED 30,
// COMMIT 1) e adicionam 20 por projeto distinto com entrega. Migração
// scripts/migrar_evolucao_etapa12.js usa a mesma fórmula no backfill inicial.
const db = require("../database/connection");

const PESOS_REPUTACAO = {
  TASK_VERIFICADA: 50,
  PR_MERGEADO: 30,
  COMMIT_VALIDO: 1,
  PROJETO_COM_ENTREGA: 20,
};

/**
 * Recalcula a reputação técnica de um usuário DIRETAMENTE do banco e faz o
 * UPSERT em reputacao_tecnica_usuario. Best-effort nos callers: falha aqui
 * NUNCA derruba o fluxo (merge/conclusão) — quem chama envolve em try/catch.
 *
 * @param {number} usuarioId id do usuário (usuarios.id)
 * @param {object} [conn] executor opcional (pool fake em testes / transação)
 * @returns {Promise<{usuarioId, score, tasksVerificadas, prsMergeados, commitsValidos, projetosComEntrega}>}
 */
async function recalcularReputacao(usuarioId, conn) {
  const executor = conn || db;
  if (!usuarioId) {
    throw new Error("recalcularReputacao: usuarioId é obrigatório");
  }

  // 1. Tasks verificadas: concluídas por merge (concluida_via = 'github_merge').
  //    Tasks soft-deletadas (excluida_em) CONTINUAM contando — a ETAPA 10 define
  //    que a evidência de contribuição nunca é apagada fisicamente.
  const [rowsTasks] = await executor.query(
    `SELECT COUNT(*) AS total FROM tarefas
     WHERE responsavel_id = ? AND concluida_via = 'github_merge'`,
    [usuarioId]
  );

  // 2. PRs mergeados: github_pull_requests com estado 'merged' vinculados a
  //    tasks onde o usuário é responsável.
  const [rowsPrs] = await executor.query(
    `SELECT COUNT(*) AS total
     FROM github_pull_requests pr
     JOIN tarefas t ON t.id = pr.tarefa_id
     WHERE t.responsavel_id = ? AND pr.estado = 'merged'`,
    [usuarioId]
  );

  // 3. Commits válidos: github_commits cujo autor GitHub (author_github_id)
  //    pertence ao usuário (match com usuarios.github_user_id).
  const [rowsCommits] = await executor.query(
    `SELECT COUNT(*) AS total
     FROM github_commits gc
     JOIN usuarios u ON u.github_user_id = gc.author_github_id
     WHERE u.id = ?`,
    [usuarioId]
  );

  // 4. Projetos com entrega: projetos distintos com ao menos uma task verificada.
  const [rowsProjetos] = await executor.query(
    `SELECT COUNT(DISTINCT projeto_id) AS total
     FROM tarefas
     WHERE responsavel_id = ? AND concluida_via = 'github_merge'`,
    [usuarioId]
  );

  const tasksVerificadas = Number(rowsTasks[0]?.total) || 0;
  const prsMergeados = Number(rowsPrs[0]?.total) || 0;
  const commitsValidos = Number(rowsCommits[0]?.total) || 0;
  const projetosComEntrega = Number(rowsProjetos[0]?.total) || 0;

  const score =
    tasksVerificadas * PESOS_REPUTACAO.TASK_VERIFICADA +
    prsMergeados * PESOS_REPUTACAO.PR_MERGEADO +
    commitsValidos * PESOS_REPUTACAO.COMMIT_VALIDO +
    projetosComEntrega * PESOS_REPUTACAO.PROJETO_COM_ENTREGA;

  // 5. UPSERT — atualizado_em é mantido pelo ON UPDATE CURRENT_TIMESTAMP
  await executor.query(
    `INSERT INTO reputacao_tecnica_usuario
      (usuario_id, score, tasks_verificadas, prs_mergeados, commits_validos, projetos_com_entrega)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      score = VALUES(score),
      tasks_verificadas = VALUES(tasks_verificadas),
      prs_mergeados = VALUES(prs_mergeados),
      commits_validos = VALUES(commits_validos),
      projetos_com_entrega = VALUES(projetos_com_entrega)`,
    [usuarioId, score, tasksVerificadas, prsMergeados, commitsValidos, projetosComEntrega]
  );

  return {
    usuarioId,
    score,
    tasksVerificadas,
    prsMergeados,
    commitsValidos,
    projetosComEntrega,
  };
}

module.exports = {
  recalcularReputacao,
  PESOS_REPUTACAO,
};
