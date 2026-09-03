const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const db = require("../database/connection");
const AppError = require("../utils/errors");
const { revogarToken, extrairJti } = require("../services/sessao");
const { gerarTemplateRecuperacaoSenha } = require("../utils/emailTemplate");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado");
}

// Hash fixo usado apenas para igualar o tempo de resposta quando o usuário não existe (anti-enumeração por timing)
const DUMMY_HASH = "$2b$10$ESJhfBKm3xVE5ZuBgn08GuEDNKkN1CXFIMZTIGMRHEew1zDXzu5hu";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const RESET_SECRET = process.env.JWT_RESET_SECRET || JWT_SECRET;
const RESET_EXPIRES_IN = process.env.JWT_RESET_EXPIRES_IN || "15m";

// Token de sessão com jti (revogação pontual via denylist) e token_versao
// (invalidação em massa na troca de senha) — correção A1 da auditoria.
function gerarTokenLogin(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      tipo: usuario.tipo,
      jti: crypto.randomUUID(),
      token_versao: usuario.token_versao ?? 0,
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
        SELECT id, nome, email, senha, tipo, bio, localizacao, avatar_url, token_versao
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

  // POST /logout (verificarToken) — revoga o token atual pelo jti na denylist
  // tokens_revogados. Correção A1 da auditoria: sessão JWT sem revogação.
  async logout(request, response, next) {
    try {
      const authorization = request.headers.authorization || "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
      // O token já foi validado pelo verificarToken — jwt.decode aqui serve
      // apenas para extrair o jti (não valida assinatura, e não precisa).
      const jti = token ? extrairJti(token) : null;
      if (jti) {
        await revogarToken(jti);
      }
      return response.status(200).json({
        sucesso: true,
        message: "Sessão encerrada",
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao encerrar sessão", 500, error));
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
      const codigo = Math.floor(100000 + Math.random() * 900000).toString();
      const expiraEm = new Date(Date.now() + 15 * 60 * 1000);
      const resetUrl = process.env.RESET_PASSWORD_URL || `http://localhost:5173/resetar-senha?token=${token}`;

      // Registra o código de 6 dígitos no banco com expiração de 15 minutos
      try {
        await db.query(
          `INSERT INTO codigos_recuperacao (usuario_id, email, codigo, token_reset, expira_em)
           VALUES (?, ?, ?, ?, ?)`,
          [usuario.id, usuario.email, codigo, token, expiraEm]
        );
      } catch (dbErr) {
        console.error("[recuperarSenha] Aviso ao registrar código no banco:", dbErr.message);
      }

      const emailHtml = gerarTemplateRecuperacaoSenha({ nome: usuario.nome, codigo, resetUrl });

      // Envio via Mailtrap API ou fallback para SMTP (Nodemailer)
      if (process.env.MAILTRAP_API_TOKEN) {
        try {
          const mailtrapRes = await fetch("https://send.api.mailtrap.io/api/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: {
                email: process.env.MAILTRAP_FROM_EMAIL || "hello@demomailtrap.co",
                name: process.env.MAILTRAP_FROM_NAME || "MontesSquad",
              },
              to: [{ email: usuario.email }],
              subject: `Código de Recuperação: ${codigo} - MontesSquad`,
              html: emailHtml,
              category: "Recuperação de Senha",
            }),
          });

          if (!mailtrapRes.ok) {
            const errText = await mailtrapRes.text();
            console.error(`[Mailtrap API] Falha no envio: HTTP ${mailtrapRes.status} - ${errText}`);
          }
        } catch (mailtrapErr) {
          console.error("[Mailtrap API] Erro ao conectar:", mailtrapErr.message);
        }
      } else {
        const transporter = criarTransporter();

        if (!transporter) {
          // Anti-enumeração: responde igual ao caso genérico — não revela se o e-mail existe.
          // O problema de configuração fica registrado apenas no log do servidor.
          console.error("Configuração de e-mail ausente (configure MAILTRAP_API_TOKEN ou SMTP)");
        } else {
          try {
            await transporter.sendMail({
              from: process.env.SMTP_FROM || process.env.SMTP_USER,
              to: usuario.email,
              subject: `Código de Recuperação: ${codigo} - MontesSquad`,
              html: emailHtml,
            });
          } catch (smtpErr) {
            console.error("[SMTP] Erro ao enviar e-mail:", smtpErr.message);
          }
        }
      }

      return response.status(200).json({
        sucesso: true,
        message: "Se o e-mail existir, enviaremos um código de recuperação",
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao recuperar senha", 500, error));
    }
  },

  /**
   * POST /verificar-codigo-recuperacao
   * Valida o código de 6 dígitos recebido por e-mail e devolve o token para alteração de senha.
   */
  async verificarCodigoRecuperacao(request, response, next) {
    try {
      const { email, codigo } = request.body;

      if (!email || !codigo) {
        return response.status(400).json({
          sucesso: false,
          message: "Email e código são obrigatórios",
          dados: null,
        });
      }

      const codigoLimpo = String(codigo).trim();

      const [rows] = await db.query(
        `SELECT id, usuario_id, token_reset, expira_em, utilizado
         FROM codigos_recuperacao
         WHERE email = ? AND codigo = ?
         ORDER BY id DESC
         LIMIT 1`,
        [email, codigoLimpo]
      );

      if (rows.length === 0) {
        return response.status(400).json({
          sucesso: false,
          message: "Código de confirmação inválido",
          dados: null,
        });
      }

      const registro = rows[0];

      if (registro.utilizado === 1) {
        return response.status(400).json({
          sucesso: false,
          message: "Este código já foi utilizado. Solicite um novo.",
          dados: null,
        });
      }

      if (new Date() > new Date(registro.expira_em)) {
        return response.status(400).json({
          sucesso: false,
          message: "Código expirado. O código tem validade de 15 minutos. Solicite um novo.",
          dados: null,
        });
      }

      // Marca como verificado para evitar reuso
      await db.query("UPDATE codigos_recuperacao SET utilizado = 1 WHERE id = ?", [registro.id]);

      return response.status(200).json({
        sucesso: true,
        message: "Código verificado com sucesso! Você já pode alterar sua senha.",
        dados: {
          token: registro.token_reset,
          email,
        },
      });
    } catch (error) {
      return next(new AppError("Erro ao verificar código de recuperação", 500, error));
    }
  },

  async resetarSenha(request, response, next) {
    try {
      const { token, novaSenha, email, codigo } = request.body;

      if (!novaSenha || (!token && (!email || !codigo))) {
        return response.status(400).json({
          sucesso: false,
          message: "Token e novaSenha são obrigatórios",
          dados: null,
        });
      }

      let userId;

      if (token) {
        try {
          const payload = jwt.verify(token, RESET_SECRET);
          userId = payload.id;
        } catch (error) {
          // B3 (QA): token inválido/expirado → resposta genérica com dados:null
          return response.status(400).json({
            sucesso: false,
            message: "Token inválido ou expirado",
            dados: null,
          });
        }
      } else {
        // Validação direta por código caso o token não tenha sido fornecido
        const [rows] = await db.query(
          `SELECT id, usuario_id, expira_em, utilizado
           FROM codigos_recuperacao
           WHERE email = ? AND codigo = ?
           ORDER BY id DESC
           LIMIT 1`,
          [email, String(codigo).trim()]
        );

        if (rows.length === 0 || rows[0].utilizado === 1 || new Date() > new Date(rows[0].expira_em)) {
          return response.status(400).json({
            sucesso: false,
            message: "Código inválido ou expirado",
            dados: null,
          });
        }

        userId = rows[0].usuario_id;
        await db.query("UPDATE codigos_recuperacao SET utilizado = 1 WHERE id = ?", [rows[0].id]);
      }

      const senhaCriptografada = await bcrypt.hash(novaSenha, 10);

      const sql = `
        UPDATE usuarios
        SET senha = ?, senha_definida = 1, token_versao = token_versao + 1
        WHERE id = ?
      `;

      const [result] = await db.query(sql, [senhaCriptografada, userId]);

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