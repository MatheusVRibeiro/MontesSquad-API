// Serviço de XP autoritativo (ETAPA 10)
// Todo XP é concedido AQUI (server-side), nunca pelo navegador.
// Idempotência: INSERT IGNORE com chave_idempotencia unique — se o evento
// já foi registrado, não concede novamente.
const db = require("../database/connection");

const XP_GITHUB_MERGE = 150;
const XP_CONCLUSAO_MANUAL = 100;

/** Chave de idempotência padrão para merge de PR. */
function chaveMergeGithub(taskId, prNumber) {
  return `task:${taskId}:github-merge:pr:${prNumber}`;
}

/** Chave de idempotência padrão para conclusão manual. */
function chaveConclusaoManual(taskId) {
  return `task:${taskId}:manual-completion`;
}

/**
 * Concede XP de forma idempotente.
 * - Insere em eventos_xp (INSERT IGNORE na chave_idempotencia)
 * - Se já existir (affectedRows=0), NÃO concede de novo
 * - Atualiza estatisticas_usuario (xp += valor; recalcula nível)
 *
 * @returns {Promise<{concedido: boolean, xpAtual: number, nivel: number}>}
 */
async function awardXp({ usuarioId, tarefaId = null, tipo, xp, idempotencyKey, conn }) {
  const executor = conn || db;
  if (!usuarioId || !tipo || !idempotencyKey) {
    throw new Error("awardXp: usuarioId, tipo e idempotencyKey são obrigatórios");
  }
  const valorXp = Number(xp) || 0;

  // 1. INSERT IGNORE — unique key evita duplicidade
  const [insertResult] = await executor.query(
    `INSERT IGNORE INTO eventos_xp (usuario_id, tarefa_id, tipo, xp, chave_idempotencia)
     VALUES (?, ?, ?, ?, ?)`,
    [usuarioId, tarefaId, tipo, valorXp, idempotencyKey]
  );

  if (!insertResult || insertResult.affectedRows === 0) {
    // Já concedido (webhook repetido, clique duplicado...) — sem efeitos
    const [atual] = await executor.query(
      `SELECT xp, nivel FROM estatisticas_usuario WHERE usuario_id = ? LIMIT 1`,
      [usuarioId]
    );
    const linha = atual[0] || { xp: 0, nivel: 1 };
    return { concedido: false, xpAtual: linha.xp, nivel: linha.nivel };
  }

  // 2. Upsert em estatisticas_usuario (xp += valor; recalc nível)
  await executor.query(
    `INSERT INTO estatisticas_usuario (usuario_id, xp, nivel)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE xp = xp + VALUES(xp)`,
    [usuarioId, valorXp]
  );

  // 3. Recalcula nível (regra atual: +1 nível a cada 250 xp, base 1)
  await executor.query(
    `UPDATE estatisticas_usuario
     SET nivel = FLOOR(xp / 250) + 1, xp_para_proximo = 250 - (xp % 250)
     WHERE usuario_id = ?`,
    [usuarioId]
  );

  const [estado] = await executor.query(
    `SELECT xp, nivel FROM estatisticas_usuario WHERE usuario_id = ? LIMIT 1`,
    [usuarioId]
  );
  const linha = estado[0] || { xp: valorXp, nivel: 1 };

  return { concedido: true, xpAtual: linha.xp, nivel: linha.nivel };
}

/** Concede XP por merge de PR (etapa 9 → 10). */
async function awardXpPorMerge({ usuarioId, tarefaId, prNumber, conn }) {
  return awardXp({
    usuarioId,
    tarefaId,
    tipo: "github_merge",
    xp: XP_GITHUB_MERGE,
    idempotencyKey: chaveMergeGithub(tarefaId, prNumber),
    conn,
  });
}

/** Concede XP por conclusão manual (kanban → done). */
async function awardXpPorConclusaoManual({ usuarioId, tarefaId, conn }) {
  return awardXp({
    usuarioId,
    tarefaId,
    tipo: "manual_completion",
    xp: XP_CONCLUSAO_MANUAL,
    idempotencyKey: chaveConclusaoManual(tarefaId),
    conn,
  });
}

module.exports = {
  awardXp,
  awardXpPorMerge,
  awardXpPorConclusaoManual,
  chaveMergeGithub,
  chaveConclusaoManual,
  XP_GITHUB_MERGE,
  XP_CONCLUSAO_MANUAL,
};