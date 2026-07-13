const db = require("../database/connection");
const AppError = require("../utils/errors");

module.exports = {
  async listarHabilidades(request, response, next) {
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
      return next(new AppError("Erro na listagem de habilidades", 500, error));
    }
  },
  async cadastrarHabilidade(request, response, next) {
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
      return next(new AppError("Erro no cadastro de habilidade", 500, error));
    }
  },
  async editarHabilidade(request, response, next) {
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
      return next(new AppError("Erro na edição de habilidade", 500, error));
    }
  },
  async apagarHabilidade(request, response, next) {
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
      return next(new AppError("Erro ao deletar habilidade", 500, error));
    }
  },
};

