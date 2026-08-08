// Controller GitHub Auth — cadastro/login com GitHub (Evolução ETAPA 1)
// Fluxos: A) Continuar com GitHub (primeiro acesso → onboarding; existente → login)
//         B) Cadastro normal por e-mail/senha (inalterado)
//         C) Conta existente conecta GitHub posteriormente (ETAPA 2 do plano)
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../database/connection");
const githubOAuth = require("../services/githubOAuth");
const AppError = require("../utils/errors");

function gerarTokenLogin(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, nome: usuario.nome, tipo: usuario.tipo },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

function gerarStateOAuth(usuarioId = null) {
  return jwt.sign({ oauth: "github-auth", uid: usuarioId || null }, process.env.JWT_SECRET, { expiresIn: "10m" });
}

function validarStateOAuth(state) {
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET);
    if (!payload || payload.oauth !== "github-auth") return null;
    return payload;
  } catch {
    return null;
  }
}

function montarDadosUsuario(u) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    tipo: u.tipo,
    bio: u.bio ?? null,
    localizacao: u.localizacao ?? null,
    avatar_url: u.avatar_url ?? null,
    github_login: u.github_login ?? null,
    github_avatar_url: u.github_avatar_url ?? null,
    cadastro_origem: u.cadastro_origem ?? "local",
  };
}

/**
 * GET /auth/github — inicia o fluxo de cadastro/login com GitHub.
 * Público. Gera state anti-CSRF e redireciona para o GitHub.
 */
async function iniciarAuthGitHub(request, response, next) {
  try {
    const state = gerarStateOAuth();
    const url = githubOAuth.buildGitHubAuthorizationUrl(state);
    return response.status(200).json({ sucesso: true, message: "URL de autorização", dados: { url, state } });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /auth/github/callback — recebe code+state do GitHub.
 * Público (GitHub redireciona). Regras de negócio (ETAPA 1):
 * 1. github_user_id encontrado → login direto;
 * 2. não encontrado → verifica conta por e-mail (não vincula automaticamente);
 * 3. sem conta → cria registro parcial (cadastro_origem='github') → onboarding.
 */
async function callbackAuthGitHub(request, response, next) {
  try {
    const { code, state } = request.query || {};
    if (!code || !state) {
      return response.status(400).json({ sucesso: false, message: "code e state são obrigatórios", dados: null });
    }
    const payloadState = validarStateOAuth(String(state));
    if (!payloadState) {
      return response.status(401).json({ sucesso: false, message: "state inválido ou expirado", dados: null });
    }

    const accessToken = await githubOAuth.exchangeCodeForAccessToken(String(code));
    const gh = await githubOAuth.fetchGitHubUser(accessToken);
    if (!gh || !gh.id) {
      return response.status(502).json({ sucesso: false, message: "Não foi possível obter o usuário do GitHub", dados: null });
    }
    const ghEmail = await githubOAuth.fetchGitHubPrimaryEmail(accessToken);

    // 1. Conta existente por github_user_id → login
    const [porGithub] = await db.query(
      "SELECT * FROM usuarios WHERE github_user_id = ? LIMIT 1",
      [gh.id]
    );
    if (porGithub.length > 0) {
      const usuario = porGithub[0];
      const token = gerarTokenLogin(usuario);
      const frontendUrl = process.env.GITHUB_FRONTEND_SUCCESS_URL || "http://localhost:5173";
      return response.redirect(`${frontendUrl}/auth/github/success?token=${encodeURIComponent(token)}`);
    }

    // 2. Conta existente por e-mail? NÃO vincula automaticamente (regra de negócio)
    if (ghEmail) {
      const [porEmail] = await db.query("SELECT id, email FROM usuarios WHERE email = ? LIMIT 1", [ghEmail]);
      if (porEmail.length > 0) {
        const frontendUrl = process.env.GITHUB_FRONTEND_SUCCESS_URL || "http://localhost:5173";
        return response.redirect(`${frontendUrl}/auth/github/email-exists?email=${encodeURIComponent(ghEmail)}`);
      }
    }

    // 3. Novo usuário → registro parcial (senha aleatória, cadastro_origem=github)
    const senhaAleatoria = crypto.randomBytes(24).toString("hex");
    const senhaHash = await bcrypt.hash(senhaAleatoria, 10);
    const nome = gh.name || gh.login || "Usuário GitHub";
    const email = ghEmail || `${gh.login}@users.noreply.github.com`;

    const [insertResult] = await db.query(
      `INSERT INTO usuarios (nome, email, senha, bio, localizacao, avatar_url,
         github_user_id, github_login, github_avatar_url, github_connected_at, cadastro_origem)
       VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, NOW(), 'github')`,
      [nome, email, senhaHash, gh.avatar_url || null, gh.id, gh.login || null, gh.avatar_url || null]
    );

    const [novo] = await db.query("SELECT * FROM usuarios WHERE id = ? LIMIT 1", [insertResult.insertId]);
    const usuario = novo[0];
    const token = gerarTokenLogin(usuario);
    const frontendUrl = process.env.GITHUB_FRONTEND_SUCCESS_URL || "http://localhost:5173";
    return response.redirect(`${frontendUrl}/auth/github/complete-profile?token=${encodeURIComponent(token)}`);
  } catch (error) {
    return next(new AppError("Erro no callback GitHub", 500, error));
  }
}

/**
 * POST /auth/github/complete-profile — autenticado (token do callback),
 * completa o perfil do usuário criado via GitHub (nome/bio/localização).
 * Também permite definir senha local (para poder desconectar GitHub depois).
 */
async function completarPerfilGitHub(request, response, next) {
  try {
    const usuarioId = request.usuarioAutenticado.id;
    const { nome, bio, localizacao, senha } = request.body || {};

    const fields = [];
    const values = [];
    if (nome !== undefined && String(nome).trim() !== "") { fields.push("nome = ?"); values.push(String(nome).trim()); }
    if (bio !== undefined) { fields.push("bio = ?"); values.push(bio || null); }
    if (localizacao !== undefined) { fields.push("localizacao = ?"); values.push(localizacao || null); }
    if (senha !== undefined && String(senha).length >= 6) {
      const hash = await bcrypt.hash(String(senha), 10);
      fields.push("senha = ?"); values.push(hash);
    }

    if (fields.length > 0) {
      values.push(usuarioId);
      await db.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    const [rows] = await db.query("SELECT * FROM usuarios WHERE id = ? LIMIT 1", [usuarioId]);
    const usuario = rows[0];
    const token = gerarTokenLogin(usuario);

    return response.status(200).json({
      sucesso: true,
      message: "Perfil completado",
      token,
      dados: montarDadosUsuario(usuario),
    });
  } catch (error) {
    return next(new AppError("Erro ao completar perfil GitHub", 500, error));
  }
}

module.exports = { iniciarAuthGitHub, callbackAuthGitHub, completarPerfilGitHub, gerarStateOAuth, validarStateOAuth };