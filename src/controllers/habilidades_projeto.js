const db = require("../database/connection");
const AppError = require("../utils/errors");

module.exports = {
  async listarHabilidadesProjeto(request, response, next) {
    try {

      const sql = `
          SELECT 
            projeto_id, habilidade_id
            FROM habilidades_projeto 
        `;

      const [row] = await db.query(sql);
      const nItens = row.length;

      return response.status(200).json({
        sucesso: true,
        message: "Lista de habilidades do projeto",
        nItens,
        dados: row,
      });
    } catch (error) {
      return next(new AppError("Erro na listagem de habilidades do projeto", 500, error));
    }
  },
  async cadastrarHabilidadesProjeto(request, response, next) {
    try {
      const { projeto_id, habilidade_id } = request.body;
      
      const sql = `
        INSERT INTO habilidades_projeto (projeto_id, habilidade_id)
        VALUES (?, ?);

      `;

      const values = [projeto_id, habilidade_id];

      const [result] = await db.query(sql, values);

      const dados = {
        projeto_id,
        habilidade_id,
      };
      return response.status(200).json({
        sucesso: true,
        message: "Cadastro de habilidades do projeto",
        dados
      });
    } catch (error) {
      return next(new AppError("Erro no cadastro de habilidades do projeto", 500, error));
    }
  },
  async editarHabilidadesProjeto(request, response, next) {
    try {

        const { projeto_id, habilidade_id } = request.body;
        const { id } = request.params;

        const sql = `
        UPDATE habilidades_projeto
        SET projeto_id = ?, habilidade_id = ?
        WHERE projeto_id = ? AND habilidade_id = ?;
        `;
        const values = [projeto_id, habilidade_id, projeto_id, habilidade_id];
        const [result] = await db.query(sql, values);

        const atualizaDados = await db.query(sql, values);
        
        const dados = {
          projeto_id,
          habilidade_id,
        };
    
        if (result.affectedRows === 0) {
          return response.status(404).json({
            sucesso: false,
            message: `Habilidades do projeto não encontrada!`,
            dados: null,
          });
        }

        return response.status(200).json({
        sucesso: true,
        message: `Habilidades do projeto atualizada com sucesso!`,
        dados
      });
    } catch (error) {
      return next(new AppError("Erro na edição de habilidades do projeto", 500, error));
    }
  },
  async apagarHabilidadesProjeto(request, response, next) {
    try {
      const { id } = request.params;

      const sql = `DELETE FROM habilidades_projeto WHERE projeto_id = ?`;

      const [result] = await db.query(sql, [id]);

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: `Habilidades do projeto ${id} não encontradas!`,
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: `Habilidades do projeto ${id} deletada com sucesso!`,
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao deletar habilidades do projeto", 500, error));
    }
  },
};

