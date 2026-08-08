const db = require("../database/connection");
const AppError = require("../utils/errors");

/**
 * Função utilitária (NÃO é middleware) para criar uma notificação.
 * Usada por outros controllers (candidaturas, mensagens, tarefas) para disparar eventos.
 * Recebe o pool como parâmetro para funcionar também dentro de transações.
 * Falhas NUNCA derrubam o fluxo principal — apenas logam e retornam null.
 */
async function criarNotificacao(pool, { usuario_id, tipo, titulo, descricao, link }) {
  try {
    const sql = `
      INSERT INTO notificacoes (usuario_id, tipo, titulo, descricao, link)
      VALUES (?, ?, ?, ?, ?);
    `;
    const values = [usuario_id, tipo, titulo, descricao || null, link || null];

    const [result] = await pool.query(sql, values);

    const [linhas] = await pool.query(
      `SELECT id, usuario_id, tipo, titulo, descricao, lida, link, criado_em
       FROM notificacoes
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return linhas[0] || null;
  } catch (error) {
    console.error("[notificacoes] Erro ao criar notificação:", error.message);
    return null;
  }
}

module.exports = {
  criarNotificacao,

  async listarNotificacoes(request, response, next) {
    try {
      const usuarioId = request.usuarioAutenticado.id;

      const sql = `
        SELECT id, tipo, titulo, descricao, lida, link, criado_em
        FROM notificacoes
        WHERE usuario_id = ?
        ORDER BY criado_em DESC
        LIMIT 50;
      `;

      const [rows] = await db.query(sql, [usuarioId]);

      const dados = rows.map((n) => ({
        id: n.id,
        type: n.tipo,
        title: n.titulo,
        description: n.descricao,
        createdAt: n.criado_em,
        read: Boolean(n.lida),
        link: n.link,
      }));

      return response.status(200).json({
        sucesso: true,
        message: "Lista de notificações",
        nItens: dados.length,
        dados,
      });
    } catch (error) {
      return next(new AppError("Erro na listagem de notificações", 500, error));
    }
  },

  async marcarTodasLidas(request, response, next) {
    try {
      const usuarioId = request.usuarioAutenticado.id;

      const sql = `
        UPDATE notificacoes
        SET lida = TRUE
        WHERE usuario_id = ? AND lida = FALSE;
      `;

      await db.query(sql, [usuarioId]);

      return response.status(200).json({
        sucesso: true,
        message: "Notificações marcadas como lidas",
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao marcar notificações como lidas", 500, error));
    }
  },
};
