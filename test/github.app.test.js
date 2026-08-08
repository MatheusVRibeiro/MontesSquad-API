import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stub via Module._load (padrão validado no repo — intercepta o require
//    do serviço CJS, que o vi.mock de ESM NÃO intercepta de forma confiável).
const { Module, createRequire } = await import("node:module");
const { pathToFileURL } = await import("node:url");
const requireModulo = createRequire(import.meta.url);

const fakeRequest = vi.fn();

function stubarOctokit() {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "@octokit/app") {
      return {
        App: class FakeApp {
          constructor(opts) {
            this.opts = opts;
          }
          async getInstallationOctokit(installationId) {
            return { request: fakeRequest, _installationId: installationId };
          }
        },
      };
    }
    if (request === "@octokit/rest") {
      return { Octokit: class FakeOctokit {} };
    }
    return originalLoad.apply(this, arguments);
  };
  return () => {
    Module._load = originalLoad;
  };
}

function carregarServico() {
  const caminho = pathToFileURL(
    requireModulo.resolve("../src/services/githubApp.js")
  ).href;
  // Query string única força o módulo a ser reavaliado (evita cache entre testes)
  return import(`${caminho}?etapa3=${Date.now()}`);
}

describe("githubApp service", () => {
  let githubApp;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.GITHUB_APP_ID = "123456";
    process.env.GITHUB_PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\\nsegredo\\n-----END RSA PRIVATE KEY-----";
    process.env.GITHUB_WEBHOOK_SECRET = "segredo-webhook";
    stubarOctokit();
    githubApp = await carregarServico();
  });

  it("envObrigatoria lança se a env faltar", () => {
    delete process.env.GITHUB_APP_ID;
    expect(() => githubApp.envObrigatoria("GITHUB_APP_ID")).toThrow(/GITHUB env ausente/);
  });

  it("getInstallationClient retorna um cliente com request", async () => {
    const client = await githubApp.getInstallationClient(42);
    expect(client).toBeTruthy();
    expect(typeof client.request).toBe("function");
  });

  it("getRepositoryById consulta o GitHub com o repository_id correto", async () => {
    fakeRequest.mockResolvedValueOnce({ data: { id: 7, full_name: "empresa/repo", default_branch: "main" } });
    const repo = await githubApp.getRepositoryById(1, 7);
    expect(fakeRequest).toHaveBeenCalledWith("GET /repositories/{repository_id}", { repository_id: 7 });
    expect(repo.full_name).toBe("empresa/repo");
  });

  it("listInstallationRepositories devolve array de repos", async () => {
    fakeRequest.mockResolvedValueOnce({ data: { repositories: [{ id: 1 }, { id: 2 }] } });
    const repos = await githubApp.listInstallationRepositories(9);
    expect(fakeRequest).toHaveBeenCalledWith("GET /installation/repositories", {});
    expect(repos).toHaveLength(2);
  });

  it("getGitHubApp instancia o App sem lançar com a key mockada", () => {
    const app = githubApp.getGitHubApp();
    expect(app).toBeTruthy();
  });
});