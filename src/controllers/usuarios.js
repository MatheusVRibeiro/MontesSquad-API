const bcrypt = require("bcryptjs");
const db = require("../database/connection");
const AppError = require("../utils/errors");

module.exports = {
  async listarUsuarios(request, response, next) {
    try {

      // M7 (auditoria): NÃO expor email/tipo na listagem — apenas campos
      // públicos de perfil (id, nome, localizacao, bio, avatar_url).
      const sql = `
          SELECT 
            id, nome, bio, localizacao, avatar_url, criado_em
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

      // Valida formato do e-mail
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return response.status(400).json({
          sucesso: false,
          message: "E-mail inválido",
          dados: null,
        });
      }

      // Valida tamanho mínimo da senha
      if (typeof senha !== "string" || senha.length < 6) {
        return response.status(400).json({
          sucesso: false,
          message: "A senha deve ter no mínimo 6 caracteres",
          dados: null,
        });
      }

      const senhaCriptografada = await bcrypt.hash(senha, 10);
      
      const sql = `
        INSERT INTO usuarios (nome, email, senha, bio, localizacao, senha_definida)
        VALUES (?, ?, ?, ?, ?, 1);

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
      if (error.code === "ER_DUP_ENTRY") {
        return response.status(409).json({
          sucesso: false,
          message: "E-mail já cadastrado",
          dados: null,
        });
      }
      return next(new AppError("Erro no cadastro de usuário", 500, error));
    }
  },
  async editarUsuario(request, response, next) {
    try {
      const { nome, email, bio, localizacao, senha, avatar_url } = request.body;
      const { id } = request.params;

      const fields = [];
      const values = [];

      if (nome !== undefined) { fields.push("nome = ?"); values.push(nome); }
      if (email !== undefined) { fields.push("email = ?"); values.push(email); }
      if (bio !== undefined) { fields.push("bio = ?"); values.push(bio); }
      if (localizacao !== undefined) { fields.push("localizacao = ?"); values.push(localizacao); }
      if (avatar_url !== undefined) { fields.push("avatar_url = ?"); values.push(avatar_url); }
      if (senha !== undefined && senha !== "") {
        const senhaCriptografada = await bcrypt.hash(senha, 10);
        fields.push("senha = ?");
        values.push(senhaCriptografada);
        // Usuário definiu senha utilizável (ex.: conta criada via GitHub) → habilita desconexão do GitHub (ETAPA 2)
        fields.push("senha_definida = 1");
        // Correção A1 (auditoria): troca de senha invalida TODAS as sessões
        // ativas — token_versao incrementa e tokens antigos morrem no
        // verificarToken (payload.token_versao !== banco → 401).
        fields.push("token_versao = token_versao + 1");
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
        "SELECT id, nome, email, bio, localizacao, avatar_url, tipo FROM usuarios WHERE id = ? LIMIT 1",
        [id]
      );

      const dados = userRows[0] || {
        id,
        nome,
        email,
        bio,
        localizacao,
        avatar_url,
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
  async obterUsuarioAutenticado(request, response, next) {
    try {
      const usuarioLogadoId = request.usuarioAutenticado.id;

      const [rows] = await db.query(
        `SELECT id, nome, email, bio, localizacao, avatar_url, tipo, criado_em
         FROM usuarios WHERE id = ? LIMIT 1`,
        [usuarioLogadoId]
      );

      if (rows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Usuário não encontrado",
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: "Usuário autenticado",
        dados: rows[0],
      });
    } catch (error) {
      return next(new AppError("Erro ao obter usuário autenticado", 500, error));
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

