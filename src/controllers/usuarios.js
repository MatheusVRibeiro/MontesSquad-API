const bcrypt = require("bcryptjs");
const db = require("../database/connection");
const AppError = require("../utils/errors");

module.exports = {
  async listarUsuarios(request, response, next) {
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
      return next(new AppError("Erro na listagem de usuários", 500, error));
    }
  },
  async cadastrarUsuario(request, response, next) {
    try {
      const { nome, email, senha, bio, localizacao } = request.body;

      if (!nome || !email || !senha) {
        return response.status(400).json({
          sucesso: false,
          message: "nome, email e senha são obrigatórios",
          dados: null,
        });
      }

      const senhaCriptografada = await bcrypt.hash(senha, 10);
      
      const sql = `
        INSERT INTO usuarios (nome, email, senha, bio, localizacao)
        VALUES (?, ?, ?, ?, ?);

      `;

      const values = [nome, email, senhaCriptografada, bio, localizacao];

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
      return next(new AppError("Erro no cadastro de usuário", 500, error));
    }
  },
  async editarUsuario(request, response, next) {
    try {
      const { nome, email, bio, localizacao, senha } = request.body;
      const { id } = request.params;

      const fields = [];
      const values = [];

      if (nome !== undefined) { fields.push("nome = ?"); values.push(nome); }
      if (email !== undefined) { fields.push("email = ?"); values.push(email); }
      if (bio !== undefined) { fields.push("bio = ?"); values.push(bio); }
      if (localizacao !== undefined) { fields.push("localizacao = ?"); values.push(localizacao); }
      if (senha !== undefined && senha !== "") {
        const senhaCriptografada = await bcrypt.hash(senha, 10);
        fields.push("senha = ?");
        values.push(senhaCriptografada);
      }

      if (fields.length > 0) {
        values.push(id);
        const sql = `UPDATE usuarios SET ${fields.join(", ")} WHERE id = ?;`;
        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
          return response.status(404).json({
            sucesso: false,
            message: `Usuário não encontrado!`,
            dados: null,
          });
        }
      }

      // Busca dados atuais do usuário para responder com o objeto atualizado
      const [userRows] = await db.query(
        "SELECT id, nome, email, bio, localizacao, tipo FROM usuarios WHERE id = ? LIMIT 1",
        [id]
      );

      const dados = userRows[0] || {
        id,
        nome,
        email,
        bio,
        localizacao,
      };

      return response.status(200).json({
        sucesso: true,
        message: `Usuário atualizado com sucesso!`,
        dados
      });
    } catch (error) {
      return next(new AppError("Erro na edição de usuário", 500, error));
    }
  },
  async apagarUsuario(request, response, next) {
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
      return next(new AppError("Erro ao deletar usuário", 500, error));
    }
  },
};

