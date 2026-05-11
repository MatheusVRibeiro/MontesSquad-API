const db = require("../database/connection");

module.exports = {
  async listarHabilidades(request, response) {
    try {

      const sql = `
          SELECT 
            id, nome
            FROM habilidades 
        `;

      const [row] = await db.query(sql);
      const nItens = row.length;

      return response.status(200).json({
        sucesso: true,
        message: "Lista de habilidades",
        nItens,
        dados: row,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro na listagem de habilidades ",
        dados: error.message,
      });
    }
  },
  async cadastrarHabilidade(request, response) {
    try {
      const { nome } = request.body;
      
      const sql = `
        INSERT INTO habilidades (nome)
        VALUES (?);

      `;

      const values = [nome];

      const [result] = await db.query(sql, values);

      const dados = {
        id: result.insertId,
        nome,
      };
      return response.status(200).json({
        sucesso: true,
        message: "Cadastro de habilidade realizado com sucesso",
        dados
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro no cadastro de habilidade",
        dados: error.message,
      });
    }
  },
  async editarHabilidade(request, response) {
    try {

        const { nome } = request.body;
        const { id } = request.params;

        const sql = `
        UPDATE habilidades
        SET nome = ?
        WHERE id = ?;
        `;
        const values = [nome, id];
        const [result] = await db.query(sql, values);

        const dados = {
          id,
          nome,
        };
    
        if (result.affectedRows === 0) {
          return response.status(404).json({
            sucesso: false,
            message: `Habilidade não encontrada!`,
            dados: null,
          });
        }

        return response.status(200).json({
        sucesso: true,
        message: `Habilidade atualizada com sucesso!`,
        dados
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro na edição de habilidade",
        dados: error.message,
      });
    }
  },
  async apagarHabilidade(request, response) {
    try {
      const { id } = request.params;

      const sql = `DELETE FROM habilidades WHERE id = ?`;

      const [result] = await db.query(sql, [id]);

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: `Habilidade ${id} não encontrada!`,
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: `Habilidade ${id} deletada com sucesso!`,
        dados: null,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao deletar habilidade",
        dados: error.message,
      });
    }
  },
};
