const db = require("../database/connection");
const AppError = require("../utils/errors");
const { criarNotificacao } = require("./notificacoes");

module.exports = {
  async listarMensagensProjeto(request, response, next) {
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
      return next(new AppError("Erro na listagem de mensagens", 500, error));
    }
  },

  async enviarMensagemProjeto(request, response, next) {
    try {
      const { projetoId } = request.params;
      const conteudo = request.body.conteudo || request.body.content;
      const remetente_id = request.usuarioAutenticado ? request.usuarioAutenticado.id : request.body.remetente_id;

      if (!remetente_id || !conteudo || !conteudo.trim()) {
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

      // Notifica os demais membros do projeto sobre a nova mensagem
      const [membros] = await db.query(
        "SELECT usuario_id FROM membros_equipe WHERE projeto_id = ? AND usuario_id != ?",
        [projetoId, remetente_id]
      );
      const nomeRemetente = request.usuarioAutenticado
        ? request.usuarioAutenticado.nome
        : "Um membro";
      for (const m of membros) {
        await criarNotificacao(db, {
          usuario_id: m.usuario_id,
          tipo: "message",
          titulo: "Nova mensagem no projeto",
          descricao: `${nomeRemetente}: ${conteudo.slice(0, 80)}`,
          link: `/projetos/${projetoId}`,
        });
      }

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
      return next(new AppError("Erro ao enviar mensagem", 500, error));
    }
  },
};
