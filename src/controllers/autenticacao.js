const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const db = require("../database/connection");
const AppError = require("../utils/errors");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado");
}

// Hash fixo usado apenas para igualar o tempo de resposta quando o usuário não existe (anti-enumeração por timing)
const DUMMY_HASH = "$2b$10$ESJhfBKm3xVE5ZuBgn08GuEDNKkN1CXFIMZTIGMRHEew1zDXzu5hu";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const RESET_SECRET = process.env.JWT_RESET_SECRET || JWT_SECRET;
const RESET_EXPIRES_IN = process.env.JWT_RESET_EXPIRES_IN || "15m";

function gerarTokenLogin(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      tipo: usuario.tipo,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function gerarTokenReset(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
    },
    RESET_SECRET,
    { expiresIn: RESET_EXPIRES_IN }
  );
}

function criarTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user,
      pass,
    },
  });
}

// Sempre compara com bcrypt — nunca aceita senha em texto puro armazenada no banco
async function compararSenha(senhaDigitada, senhaArmazenada) {
  if (!senhaDigitada || !senhaArmazenada) {
    return false;
  }

  return bcrypt.compare(senhaDigitada, senhaArmazenada);
}

module.exports = {
  async login(request, response, next) {
    try {
      const { email, senha } = request.body;

      if (!email || !senha) {
        return response.status(400).json({
          sucesso: false,
          message: "Email e senha são obrigatórios",
          dados: null,
        });
      }

      const sql = `
        SELECT id, nome, email, senha, tipo, bio, localizacao, avatar_url
        FROM usuarios
        WHERE email = ?
        LIMIT 1
      `;

      const [rows] = await db.query(sql, [email]);

      if (rows.length === 0) {
        // Anti-enumeração: mesma resposta de credenciais inválidas + comparação dummy
        // contra hash fixo para igualar o tempo de resposta (não revela se o e-mail existe)
        await bcrypt.compare(senha, DUMMY_HASH);
        return response.status(401).json({
          sucesso: false,
          message: "Credenciais inválidas",
          dados: null,
        });
      }

      const usuario = rows[0];
      const senhaValida = await compararSenha(senha, usuario.senha);

      if (!senhaValida) {
        return response.status(401).json({
          sucesso: false,
          message: "Credenciais inválidas",
          dados: null,
        });
      }

      const token = gerarTokenLogin(usuario);

      return response.status(200).json({
        sucesso: true,
        message: "Login realizado com sucesso",
        token,
        dados: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          tipo: usuario.tipo,
          bio: usuario.bio ?? null,
          localizacao: usuario.localizacao ?? null,
          avatar_url: usuario.avatar_url ?? null,
        },
      });
    } catch (error) {
      return next(new AppError("Erro no login", 500, error));
    }
  },

  async recuperarSenha(request, response, next) {
    try {
      const { email } = request.body;

      if (!email) {
        return response.status(400).json({
          sucesso: false,
          message: "Email é obrigatório",
          dados: null,
        });
      }

      const sql = `
        SELECT id, nome, email
        FROM usuarios
        WHERE email = ?
        LIMIT 1
      `;

      const [rows] = await db.query(sql, [email]);

      if (rows.length === 0) {
        // Anti-enumeração: resposta genérica idêntica ao sucesso — não revela se o e-mail existe
        return response.status(200).json({
          sucesso: true,
          message: "Se o e-mail existir, enviaremos um link",
          dados: null,
        });
      }

      const usuario = rows[0];
      const token = gerarTokenReset(usuario);
      const resetUrl = process.env.RESET_PASSWORD_URL || `http://localhost:5173/resetar-senha?token=${token}`;
      const transporter = criarTransporter();

      if (!transporter) {
        // Anti-enumeração: responde igual ao caso genérico — não revela se o e-mail existe.
        // O problema de configuração fica registrado apenas no log do servidor.
        console.error("Configuração SMTP ausente para envio do e-mail de recuperação");
        return response.status(200).json({
          sucesso: true,
          message: "Se o e-mail existir, enviaremos um link",
          dados: null,
        });
      }

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: usuario.email,
        subject: "Recuperação de senha - MontesSquad",
        html: `
          <p>Olá, ${usuario.nome}!</p>
          <p>Recebemos uma solicitação para redefinir sua senha.</p>
          <p>Use este link para criar uma nova senha:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Esse link expira em alguns minutos.</p>
        `,
      });

      return response.status(200).json({
        sucesso: true,
        message: "Se o e-mail existir, enviaremos um link",
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao recuperar senha", 500, error));
    }
  },

  async resetarSenha(request, response, next) {
    try {
      const { token, novaSenha } = request.body;

      if (!token || !novaSenha) {
        return response.status(400).json({
          sucesso: false,
          message: "Token e novaSenha são obrigatórios",
          dados: null,
        });
      }

      const payload = jwt.verify(token, RESET_SECRET);
      const senhaCriptografada = await bcrypt.hash(novaSenha, 10);

      const sql = `
        UPDATE usuarios
        SET senha = ?
        WHERE id = ?
      `;

      const [result] = await db.query(sql, [senhaCriptografada, payload.id]);

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Usuário não encontrado",
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: "Senha atualizada com sucesso",
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Token inválido ou expirado", 400, error));
    }
  },
};