// Timeline de atividade do projeto — Evolução de produto ETAPA 15.
//
// Histórico legível das principais ações do squad (visão de produto para
// usuários — NÃO substitui logs técnicos; critério de aceite da ETAPA 15).
//
// Tipos de evento suportados:
//   membro_entrou / membro_saiu / task_criada / task_assumida /
//   task_abandonada / commit_detectado / pr_aberto / pr_mergeado /
//   task_concluida / reavaliacao
//
// ⚠️ 'reavaliacao' é suportado pelo service (INSERT/leitura), mas NÃO possui
// disparo automático: ainda não existe fluxo de reavaliação no produto. Quando
// o fluxo for criado, basta chamar registrarEvento({ tipo: 'reavaliacao', ... }).
//
// registrarEvento é BEST-EFFORT (mesmo padrão da criarNotificacao): falhas NUNCA
// derrubam o fluxo principal — apenas logam e retornam null. Os disparos ficam
// nos pontos reais (candidaturas, projetos, membros, tarefas, githubTasks,
// githubEvents) SEMpre fora de transações críticas (o INSERT usa o pool global,
// então nunca reverte junto com um commit/PR em andamento).
const db = require("../database/connection");

/**
 * Registra um evento na timeline do projeto.
 * NUNCA lança: qualquer falha (inclusive metadados não serializáveis) é
 * absorvida — o evento não pode derrubar a ação principal que o gerou.
 *
 * @param {object} params
 * @param {number} params.projeto_id  ID do projeto (obrigatório)
 * @param {number|null} [params.usuario_id] Usuário que executou a ação (nullable)
 * @param {string} params.tipo       Tipo do evento (lista acima)
 * @param {string} [params.entidade_tipo] Tipo da entidade relacionada (ex.: 'tarefa', 'pull_request')
 * @param {string|number} [params.entidade_id] ID da entidade relacionada
 * @param {string} params.titulo     Texto legível do evento (ex.: 'Lucas assumiu a task X')
 * @param {object} [params.metadados] Dados extras serializados em JSON
 * @returns {Promise<number|null>} insertId do evento ou null em falha
 */
async function registrarEvento({
  projeto_id,
  usuario_id,
  tipo,
  entidade_tipo,
  entidade_id,
  titulo,
  metadados,
}) {
  try {
    let metadadosJson = null;
    if (metadados !== undefined && metadados !== null) {
      try {
        metadadosJson = JSON.stringify(metadados);
      } catch (serializeError) {
        // Metadados não serializáveis (ex.: objeto circular) não podem derrubar
        // o evento — grava objeto vazio e segue.
        metadadosJson = JSON.stringify({});
      }
    }

    const sql = `
      INSERT INTO eventos_projeto
        (projeto_id, usuario_id, tipo, entidade_tipo, entidade_id, titulo, metadados)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    const values = [
      projeto_id,
      usuario_id || null,
      tipo,
      entidade_tipo || null,
      entidade_id !== undefined && entidade_id !== null ? String(entidade_id) : null,
      titulo,
      metadadosJson,
    ];

    const [result] = await db.query(sql, values);
    return result.insertId ?? null;
  } catch (error) {
    console.error("[eventosProjeto] Erro ao registrar evento:", error.message);
    return null;
  }
}

/**
 * Lista os eventos de um projeto, mais recentes primeiro (criado_em DESC,
 * id DESC como desempate — eventos do mesmo segundo ficam em ordem estável).
 * Metadados JSON são convertidos para objeto (try/catch: valor corrompido
 * vira null em vez de derrubar a listagem).
 *
 * @param {number} projetoId
 * @param {object} [opcoes]
 * @param {number} [opcoes.limite=50]
 * @returns {Promise<Array<object>>}
 */
async function listarEventos(projetoId, { limite = 50 } = {}) {
  const sql = `
    SELECT e.*, u.nome AS usuario_nome
    FROM eventos_projeto e
    LEFT JOIN usuarios u ON u.id = e.usuario_id
    WHERE e.projeto_id = ?
    ORDER BY e.criado_em DESC, e.id DESC
    LIMIT ?;
  `;

  const [rows] = await db.query(sql, [projetoId, limite]);

  return rows.map((evento) => {
    let metadados = null;
    if (evento.metadados !== null && evento.metadados !== undefined) {
      try {
        metadados =
          typeof evento.metadados === "string"
            ? JSON.parse(evento.metadados)
            : evento.metadados;
      } catch (parseError) {
        metadados = null;
      }
    }
    return { ...evento, metadados };
  });
}

module.exports = { registrarEvento, listarEventos };
