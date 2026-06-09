const db = require("../database/connection");

module.exports = {
  async listarProjetos(request, response) {
    try {
      const sql = `
        SELECT 
          p.id, 
          p.criador_id, 
          u.nome AS criador_nome, 
          p.titulo, 
          p.descricao, 
          p.status, 
          p.limite_membros, 
          p.criado_em,
          (SELECT COUNT(*) FROM membros_equipe WHERE projeto_id = p.id) AS total_membros
        FROM projetos p
        LEFT JOIN usuarios u ON p.criador_id = u.id
      `;

      const [row] = await db.query(sql);
      const nItens = row.length;

      return response.status(200).json({
        sucesso: true,
        message: "Lista de projetos",
        nItens,
        dados: row,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro na listagem de projetos ",
        dados: error.message,
      });
    }
  },
  async cadastrarProjeto(request, response) {
    try {
      const criador_id = request.usuarioAutenticado ? request.usuarioAutenticado.id : request.body.criador_id;
      const titulo = request.body.titulo || request.body.name;
      const descricao = request.body.descricao || request.body.description;
      const status = request.body.status || "aberto";
      const limite_membros = request.body.limite_membros || request.body.membersLimit || 5;

      if (!titulo) {
        return response.status(400).json({
          sucesso: false,
          message: "O título do projeto é obrigatório",
          dados: null,
        });
      }

      const sql = `
        INSERT INTO projetos (criador_id, titulo, descricao, status, limite_membros)
        VALUES (?, ?, ?, ?, ?);
      `;

      const values = [criador_id, titulo, descricao, status, limite_membros];

      const [result] = await db.query(sql, values);

      const dados = {
        id: result.insertId,
        criador_id,
        titulo,
        descricao,
        status,
        limite_membros,
      };
      return response.status(200).json({
        sucesso: true,
        message: "Cadastro de projeto realizado com sucesso",
        dados
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro no cadastro de projeto",
        dados: error.message,
      });
    }
  },
  async editarProjeto(request, response) {
    try {
      const { criador_id, titulo, descricao, status, limite_membros } = request.body;
      const { id } = request.params;

      const fields = [];
      const values = [];

      if (criador_id !== undefined) { fields.push("criador_id = ?"); values.push(criador_id); }
      if (titulo !== undefined) { fields.push("titulo = ?"); values.push(titulo); }
      if (descricao !== undefined) { fields.push("descricao = ?"); values.push(descricao); }
      if (status !== undefined) { fields.push("status = ?"); values.push(status); }
      if (limite_membros !== undefined) { fields.push("limite_membros = ?"); values.push(limite_membros); }

      if (fields.length > 0) {
        values.push(id);
        const sql = `UPDATE projetos SET ${fields.join(", ")} WHERE id = ?;`;
        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
          return response.status(404).json({
            sucesso: false,
            message: `Projeto não encontrado!`,
            dados: null,
          });
        }
      }

      // Busca dados atuais do projeto para responder com o objeto completo
      const [projRows] = await db.query(
        "SELECT id, criador_id, titulo, descricao, status, limite_membros FROM projetos WHERE id = ? LIMIT 1",
        [id]
      );

      const dados = projRows[0] || {
        id,
        criador_id,
        titulo,
        descricao,
        status,
        limite_membros,
      };

      return response.status(200).json({
        sucesso: true,
        message: `Projeto atualizado com sucesso!`,
        dados
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro na edição de projeto",
        dados: error.message,
      });
    }
  },
  async apagarProjeto(request, response) {
    try {
      const { id } = request.params;

      const sql = `DELETE FROM projetos WHERE id = ?`;

      const [result] = await db.query(sql, [id]);

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: `Projeto ${id} não encontrado!`,
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: `Projeto ${id} deletado com sucesso!`,
        dados: null,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao deletar projeto",
        dados: error.message,
      });
    }
  },
};
