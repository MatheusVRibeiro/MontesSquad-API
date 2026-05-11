const db = require("../database/connection");

module.exports = {
  async listarUsuarios(request, response) {
    try {

      const sql = `
          SELECT 
            id, nome, email, bio, localizacao, criado_em
            FROM usuarios 
        `;

      const [row] = await db.query(sql);
      const nItens = row.length;

      return response.status(200).json({
        sucesso: true,
        message: "Lista de usuários",
        nItens,
        dados: row,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro na listagem de usuários ",
        dados: error.message,
      });
    }
  },
  async cadastrarUsuario(request, response) {
    try {
      const { nome, email, senha, bio, localizacao } = request.body;
      
      const sql = `
        INSERT INTO usuarios (nome, email, senha, bio, localizacao)
        VALUES (?, ?, ?, ?, ?);

      `;

      const values = [nome, email, senha, bio, localizacao];

      const [result] = await db.query(sql, values);

      const dados = {
        id: result.insertId,
        nome,
        email,
        bio,
        localizacao,
      };
      return response.status(200).json({
        sucesso: true,
        message: "Cadastro de usuário realizado com sucesso",
        dados
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro no cadastro de usuário",
        dados: error.message,
      });
    }
  },
  async editarUsuario(request, response) {
    try {

        const { nome, email, bio, localizacao } = request.body;
        const { id } = request.params;

        const sql = `
        UPDATE usuarios
        SET nome = ?, email = ?, bio = ?, localizacao = ?
        WHERE id = ?;
        `;
        const values = [nome, email, bio, localizacao, id];
        const [result] = await db.query(sql, values);

        const dados = {
          id,
          nome,
          email,
          bio,
          localizacao,
        };
    
        if (result.affectedRows === 0) {
          return response.status(404).json({
            sucesso: false,
            message: `Usuário não encontrado!`,
            dados: null,
          });
        }

        return response.status(200).json({
        sucesso: true,
        message: `Usuário atualizado com sucesso!`,
        dados
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro na edição de usuário",
        dados: error.message,
      });
    }
  },
  async apagarUsuario(request, response) {
    try {
      const { id } = request.params;

      const sql = `DELETE FROM usuarios WHERE id = ?`;

      const [result] = await db.query(sql, [id]);

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: `Usuário ${id} não encontrado!`,
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: `Usuário ${id} deletado com sucesso!`,
        dados: null,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao deletar usuário",
        dados: error.message,
      });
    }
  },
};
