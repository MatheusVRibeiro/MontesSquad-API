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
      `SELECT xp, nivel FROM usuarios WHERE id = ? LIMIT 1`,
      [usuarioId]
    );
    const linha = atual[0] || { xp: 0, nivel: 1 };
    return { concedido: false, xpAtual: linha.xp, nivel: linha.nivel };
  }

  // 2. Atualiza xp e recalcula nível na tabela usuarios (meta do próximo nível = nivel * 250)
  await executor.query(
    `UPDATE usuarios
     SET xp = xp + ?,
         nivel = FLOOR((xp + ?) / 250) + 1,
         xp_para_proximo = (FLOOR((xp + ?) / 250) + 1) * 250
     WHERE id = ?`,
    [valorXp, valorXp, valorXp, usuarioId]
  );

  const [estado] = await executor.query(
    `SELECT xp, nivel FROM usuarios WHERE id = ? LIMIT 1`,
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

/**
 * Reverte o XP de conclusão manual quando uma tarefa sai de 'done' para outro status (reabertura).
 * Garante que o usuário não retenha XP indevido de tarefas não concluídas.
 *
 * @param {object} params
 * @param {number} params.usuarioId
 * @param {number} params.tarefaId
 * @param {object} [params.conn]
 * @returns {Promise<{revertido: boolean, xpAtual: number, nivel: number}>}
 */
async function reverterXpPorConclusaoManual({ usuarioId, tarefaId, conn }) {
  const executor = conn || db;
  if (!usuarioId || !tarefaId) {
    throw new Error("reverterXpPorConclusaoManual: usuarioId e tarefaId são obrigatórios");
  }

  const idempotencyKey = chaveConclusaoManual(tarefaId);

  // 1. Remove o registro do evento de XP se ele existir
  const [deleteResult] = await executor.query(
    `DELETE FROM eventos_xp WHERE usuario_id = ? AND chave_idempotencia = ?`,
    [usuarioId, idempotencyKey]
  );

  if (!deleteResult || deleteResult.affectedRows === 0) {
    // Não havia registro de XP manual dessa tarefa para o usuário
    const [atual] = await executor.query(
      `SELECT xp, nivel FROM usuarios WHERE id = ? LIMIT 1`,
      [usuarioId]
    );
    const linha = atual[0] || { xp: 0, nivel: 1 };
    return { revertido: false, xpAtual: linha.xp, nivel: linha.nivel };
  }

  // 2. Subtrai o valor do XP e recalcula nível
  await executor.query(
    `UPDATE usuarios
     SET xp = GREATEST(xp - ?, 0),
         nivel = FLOOR(GREATEST(xp - ?, 0) / 250) + 1,
         xp_para_proximo = (FLOOR(GREATEST(xp - ?, 0) / 250) + 1) * 250
     WHERE id = ?`,
    [XP_CONCLUSAO_MANUAL, XP_CONCLUSAO_MANUAL, XP_CONCLUSAO_MANUAL, usuarioId]
  );

  const [estado] = await executor.query(
    `SELECT xp, nivel FROM usuarios WHERE id = ? LIMIT 1`,
    [usuarioId]
  );
  const linha = estado[0] || { xp: 0, nivel: 1 };

  return { revertido: true, xpAtual: linha.xp, nivel: linha.nivel };
}

module.exports = {
  awardXp,
  awardXpPorMerge,
  awardXpPorConclusaoManual,
  reverterXpPorConclusaoManual,
  chaveMergeGithub,
  chaveConclusaoManual,
  XP_GITHUB_MERGE,
  XP_CONCLUSAO_MANUAL,
};