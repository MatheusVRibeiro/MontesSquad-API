const db = require("../database/connection");

module.exports = {
  async listarProjetos(request, response) {
    try {

      const sql = `
          SELECT 
            id, criador_id, titulo, descricao, status, criado_em
            FROM projetos 
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
      const { criador_id, titulo, descricao, status } = request.body;
      
      const sql = `
        INSERT INTO projetos (criador_id, titulo, descricao, status)
        VALUES (?, ?, ?, ?);

      `;

      const values = [criador_id, titulo, descricao, status];

      const [result] = await db.query(sql, values);

      const dados = {
        id: result.insertId,
        criador_id,
        titulo,
        descricao,
        status,
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

        const { criador_id, titulo, descricao, status } = request.body;
        const { id } = request.params;

        const sql = `
        UPDATE projetos
        SET criador_id = ?, titulo = ?, descricao = ?, status = ?
        WHERE id = ?;
        `;
        const values = [criador_id, titulo, descricao, status, id];
        const [result] = await db.query(sql, values);

        const dados = {
          id,
          criador_id,
          titulo,
          descricao,
          status,
        };
    
        if (result.affectedRows === 0) {
          return response.status(404).json({
            sucesso: false,
            message: `Projeto não encontrado!`,
            dados: null,
          });
        }

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
