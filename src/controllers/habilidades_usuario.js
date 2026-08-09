const db = require("../database/connection");
const AppError = require("../utils/errors");

module.exports = {
  async listarHabilidadesUsuario(request, response, next) {
    try {
      const { usuario_id } = request.query;

      let sql = `
          SELECT 
            usuario_id, habilidade_id, nivel
            FROM habilidades_usuario 
      `;
      const values = [];

      if (usuario_id) {
        sql += ` WHERE usuario_id = ?`;
        values.push(usuario_id);
      }

      const [row] = await db.query(sql, values);
      const nItens = row.length;

      return response.status(200).json({
        sucesso: true,
        message: "Lista de habilidades do usuário",
        nItens,
        dados: row,
      });
    } catch (error) {
      return next(new AppError("Erro na listagem de habilidades do usuário", 500, error));
    }
  },
  async cadastrarHabilidadesUsuario(request, response, next) {
    try {
      const { habilidade_id, nivel } = request.body;
      // A4 (IDOR): usuario_id vem SEMPRE do token — o usuário só gerencia as
      // PRÓPRIAS habilidades (nunca aceitar usuario_id do body).
      const usuario_id = request.usuarioAutenticado.id;
      
      const sql = `
        INSERT INTO habilidades_usuario (usuario_id, habilidade_id, nivel)
        VALUES (?, ?, ?);

      `;

      const values = [usuario_id, habilidade_id, nivel];

      const [result] = await db.query(sql, values);

      const dados = {
        usuario_id,
        habilidade_id,
        nivel,
      };
      return response.status(200).json({
        sucesso: true,
        message: "Cadastro de habilidades do usuário",
        dados
      });
    } catch (error) {
      return next(new AppError("Erro no cadastro de habilidades do usuário", 500, error));
    }
  },
  async editarHabilidadesUsuario(request, response, next) {
    try {
      // A4 (IDOR): usuario_id vem SEMPRE do token (nunca do body/query).
      const usuario_id = request.usuarioAutenticado.id;
      const habilidade_id = request.body.habilidade_id || request.query.habilidade_id;
      const nivel = request.body.nivel;

      if (!usuario_id || !habilidade_id) {
        return response.status(400).json({
          sucesso: false,
          message: "usuario_id e habilidade_id são obrigatórios",
          dados: null,
        });
      }

      const sql = `
        UPDATE habilidades_usuario
        SET nivel = ?
        WHERE usuario_id = ? AND habilidade_id = ?
      `;
      const values = [nivel, usuario_id, habilidade_id];
      const [result] = await db.query(sql, values);

      const dados = {
        usuario_id,
        habilidade_id,
        nivel,
      };
  
      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: `Habilidades do usuário não encontrada!`,
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: `Habilidades do usuário atualizada com sucesso!`,
        dados
      });
    } catch (error) {
      return next(new AppError("Erro na edição de habilidades do usuário", 500, error));
    }
  },
  async apagarHabilidadesUsuario(request, response, next) {
    try {
      // A4 (IDOR): usuario_id vem SEMPRE do token (nunca do body/query).
      const usuario_id = request.usuarioAutenticado.id;
      const habilidade_id = request.body.habilidade_id || request.query.habilidade_id;

      if (!usuario_id || !habilidade_id) {
        return response.status(400).json({
          sucesso: false,
          message: "usuario_id e habilidade_id são obrigatórios",
          dados: null,
        });
      }

      const sql = `DELETE FROM habilidades_usuario WHERE usuario_id = ? AND habilidade_id = ?`;

      const [result] = await db.query(sql, [usuario_id, habilidade_id]);

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: `Habilidades do usuário não encontradas!`,
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: `Habilidades do usuário deletada com sucesso!`,
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao deletar habilidades do usuário", 500, error));
    }
  },
};