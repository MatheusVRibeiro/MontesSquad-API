const db = require("../database/connection");

module.exports = {
  async listarHabilidadesUsuario(request, response) {
    try {

      const sql = `
          SELECT 
            usuario_id, habilidade_id, nivel
            FROM habilidades_usuario 
        `;

      const [row] = await db.query(sql);
      const nItens = row.length;

      return response.status(200).json({
        sucesso: true,
        message: "Lista de habilidades do usuário",
        nItens,
        dados: row,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro na listagem de habilidades do usuário ",
        dados: error.message,
      });
    }
  },
  async cadastrarHabilidadesUsuario(request, response) {
    try {
      const { usuario_id, habilidade_id, nivel } = request.body;
      
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
      return response.status(500).json({
        sucesso: false,
        message: "Erro no cadastro de habilidades do usuário",
        dados: error.message,
      });
    }
  },
  async editarHabilidadesUsuario(request, response) {
    try {

        const { usuario_id, habilidade_id, nivel } = request.body;
        const { id } = request.params;

        const sql = `
        UPDATE habilidades_usuario
        SET usuario_id = ?, habilidade_id = ?, nivel = ?
        WHERE usuario_id = ? AND habilidade_id = ?;
        `;
        const values = [usuario_id, habilidade_id, nivel, usuario_id, habilidade_id];
        const [result] = await db.query(sql, values);

        const atualizaDados = await db.query(sql, values);
        
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
      return response.status(500).json({
        sucesso: false,
        message: "Erro na edição de habilidades do usuário",
        dados: error.message,
      });
    }
  },
  async apagarHabilidadesUsuario(request, response) {
    try {
      const { id } = request.params;

      const sql = `DELETE FROM habilidades_usuario WHERE usuario_id = ?`;

      const [result] = await db.query(sql, [id]);

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: `Habilidades do usuário ${id} não encontradas!`,
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: `Habilidades do usuário ${id} deletada com sucesso!`,
        dados: null,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao deletar habilidades do usuário",
        dados: error.message,
      });
    }
  },
};
