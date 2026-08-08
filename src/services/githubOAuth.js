// GitHub OAuth — fluxo de CADASTRO/LOGIN (Evolução ETAPA 1)
// Diferente do githubApp.js (GitHub App para repositórios) e do fluxo de
// vínculo em github.js (ETAPA 2 do plano). Aqui o OAuth é usado para criar
// conta ou logar com GitHub.
const GITHUB_OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_OAUTH_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_API_USER = "https://api.github.com/user";
const GITHUB_API_EMAILS = "https://api.github.com/user/emails";

function envObrigatoria(nome) {
  const v = process.env[nome];
  if (!v || v.trim() === "") {
    throw new Error(`GITHUB env ausente: ${nome} (configure no .env)`);
  }
  return v.trim();
}

function getClientId() {
  return envObrigatoria("GITHUB_CLIENT_ID");
}

function getClientSecret() {
  return envObrigatoria("GITHUB_CLIENT_SECRET");
}

/** Monta a URL de autorização do GitHub com state anti-CSRF. */
function buildGitHubAuthorizationUrl(state) {
  const clientId = getClientId();
  const callbackUrl = process.env.GITHUB_AUTH_CALLBACK_URL || "http://localhost:3333/auth/github/callback";
  return (
    `${GITHUB_OAUTH_AUTHORIZE}?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&state=${encodeURIComponent(state)}&scope=read:user user:email`
  );
}

/** Troca o code do GitHub pelo access token (fica SOMENTE no backend). */
async function exchangeCodeForAccessToken(code) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const callbackUrl = process.env.GITHUB_AUTH_CALLBACK_URL || "http://localhost:3333/auth/github/callback";

  const res = await fetch(GITHUB_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "MontesSquad" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl }),
  });
  const data = await res.json();
  if (!data.access_token) {
    const err = new Error("Falha ao obter token do GitHub");
    err.githubError = data;
    throw err;
  }
  return data.access_token;
}

/** Busca o usuário do GitHub (id, login, avatar_url, name). */
async function fetchGitHubUser(accessToken) {
  const res = await fetch(GITHUB_API_USER, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "User-Agent": "MontesSquad" },
  });
  if (!res.ok) throw new Error(`GitHub API user falhou: HTTP ${res.status}`);
  return res.json();
}

/** Busca o e-mail primário do GitHub (user:email scope). */
async function fetchGitHubPrimaryEmail(accessToken) {
  const res = await fetch(GITHUB_API_EMAILS, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "User-Agent": "MontesSquad" },
  });
  if (!res.ok) return null;
  const emails = await res.json();
  if (!Array.isArray(emails)) return null;
  const primario = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0];
  return primario?.email || null;
}

module.exports = {
  buildGitHubAuthorizationUrl,
  exchangeCodeForAccessToken,
  fetchGitHubUser,
  fetchGitHubPrimaryEmail,
  envObrigatoria,
};