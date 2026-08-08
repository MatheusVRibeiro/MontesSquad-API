// GitHub App — camada única de autenticação com GitHub (ETAPA 3)
// Encapsula Octokit; nunca loga secrets; nunca envia installation token ao frontend.
const { App } = require("@octokit/app");
const { Octokit } = require("@octokit/rest");

function envObrigatoria(nome) {
  const v = process.env[nome];
  if (!v || v.trim() === "") {
    throw new Error(`GITHUB env ausente: ${nome} (configure no .env)`);
  }
  return v.trim();
}

function getGitHubApp() {
  const appId = envObrigatoria("GITHUB_APP_ID");
  const privateKey = envObrigatoria("GITHUB_PRIVATE_KEY");
  return new App({
    appId,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  });
}

/**
 * Cliente autenticado como installation (permissões do app na instalação).
 * O token de instalação é efêmero e NUNCA deve sair deste módulo.
 */
async function getInstallationClient(installationId) {
  const app = getGitHubApp();
  const octokit = await app.getInstallationOctokit(Number(installationId));
  return octokit;
}

/** Busca um repositório autorizado pela instalação. Retorna dados do GitHub (nunca confiar no browser). */
async function getRepositoryById(installationId, repositoryId) {
  const octokit = await getInstallationClient(installationId);
  const { data } = await octokit.request("GET /repositories/{repository_id}", {
    repository_id: Number(repositoryId),
  });
  return data;
}

/** Lista repositórios acessíveis pela instalação. */
async function listInstallationRepositories(installationId) {
  const octokit = await getInstallationClient(installationId);
  const { data } = await octokit.request("GET /installation/repositories", {});
  return data.repositories || [];
}

module.exports = {
  getGitHubApp,
  getInstallationClient,
  getRepositoryById,
  listInstallationRepositories,
  envObrigatoria,
  Octokit,
};