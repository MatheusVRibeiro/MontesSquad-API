const db = require("../database/connection");

module.exports = {
  async listarMensagensProjeto(request, response) {
    try {
      const { projetoId } = request.params;

      const sql = `
        SELECT
          m.id,
          m.remetente_id,
          m.projeto_id,
          m.destinatario_id,
          m.conteudo,
          m.criado_em,
          u.nome AS remetente_nome
        FROM mensagens m
        JOIN usuarios u ON m.remetente_id = u.id
        WHERE m.projeto_id = ?
        ORDER BY m.criado_em ASC
      `;

      const [rows] = await db.query(sql, [projetoId]);

      return response.status(200).json({
        sucesso: true,
        message: "Lista de mensagens do projeto",
        nItens: rows.length,
        dados: rows,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro na listagem de mensagens",
        dados: error.message,
      });
    }
  },

  async enviarMensagemProjeto(request, response) {
    try {
      const { projetoId } = request.params;
      const { remetente_id, conteudo } = request.body;

      if (!remetente_id || !conteudo) {
        return response.status(400).json({
          sucesso: false,
          message: "remetente_id e conteudo são obrigatórios",
          dados: null,
        });
      }

      const sql = `
        INSERT INTO mensagens (remetente_id, projeto_id, destinatario_id, conteudo)
        VALUES (?, ?, NULL, ?)
      `;

      const [result] = await db.query(sql, [remetente_id, projetoId, conteudo]);

      return response.status(201).json({
        sucesso: true,
        message: "Mensagem enviada com sucesso",
        dados: {
          id: result.insertId,
          remetente_id,
          projeto_id: projetoId,
          destinatario_id: null,
          conteudo,
        },
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao enviar mensagem",
        dados: error.message,
      });
    }
  },
};