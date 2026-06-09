const db = require("../database/connection");

module.exports = {
  async listarMembros(request, response) {
    try {
      const { projetoId } = request.params;

      const sql = `
        SELECT me.id, me.usuario_id, me.funcao, me.entrou_em,
               u.nome AS usuario_nome, u.email AS usuario_email, u.bio AS usuario_bio, u.localizacao AS usuario_localizacao
        FROM membros_equipe me
        JOIN usuarios u ON me.usuario_id = u.id
        WHERE me.projeto_id = ?
      `;

      const [rows] = await db.query(sql, [projetoId]);

      return response.status(200).json({
        sucesso: true,
        message: "Membros do squad",
        nItens: rows.length,
        dados: rows,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao listar membros do squad",
        dados: error.message,
      });
    }
  },

  async removerMembro(request, response) {
    try {
      const { projetoId, usuarioId } = request.params;

      // Impede o dono de remover a si próprio (ele pode encerrar ou gerenciar, mas deve continuar dono)
      const [projRows] = await db.query(
        "SELECT criador_id FROM projetos WHERE id = ? LIMIT 1",
        [projetoId]
      );

      if (projRows.length > 0 && projRows[0].criador_id == usuarioId) {
        return response.status(400).json({
          sucesso: false,
          message: "O proprietário do projeto não pode ser removido da equipe",
          dados: null,
        });
      }

      const sql = `
        DELETE FROM membros_equipe 
        WHERE projeto_id = ? AND usuario_id = ?
      `;

      const [result] = await db.query(sql, [projetoId, usuarioId]);

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Membro não encontrado neste projeto",
          dados: null,
        });
      }

      // Também coloca a candidatura dele como rejeitado/removido para poder se candidatar novamente
      await db.query(
        "UPDATE candidaturas SET status = 'rejeitado' WHERE projeto_id = ? AND usuario_id = ?",
        [projetoId, usuarioId]
      );

      return response.status(200).json({
        sucesso: true,
        message: "Membro removido da equipe com sucesso",
        dados: null,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao remover membro do squad",
        dados: error.message,
      });
    }
  },
};
