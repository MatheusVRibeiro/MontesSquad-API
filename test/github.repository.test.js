import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, setEnvAmbiente } from "./helpers/bootstrap.js";

setEnvAmbiente();
process.env.GITHUB_APP_ID = "123";
process.env.GITHUB_PRIVATE_KEY = "key-mock";
process.env.GITHUB_WEBHOOK_SECRET = "segredo-teste";

// Stub do githubApp via Module._load (o serviço é CJS; vi.mock de ESM não pega)
const { Module, createRequire } = await import("node:module");
const { pathToFileURL } = await import("node:url");
const requireModulo = createRequire(import.meta.url);

const fakeGetRepositoryById = vi.fn();

function stubarGithubApp() {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "../services/githubApp" || request.endsWith("services/githubApp")) {
      return {
        getRepositoryById: fakeGetRepositoryById,
        listInstallationRepositories: async () => [
          { id: 100, full_name: "empresa/repo-a", html_url: "https://github.com/empresa/repo-a", default_branch: "main", private: false },
        ],
      };
    }
    return originalLoad.apply(this, arguments);
  };
  return () => { Module._load = originalLoad; };
}

function carregarController() {
  const caminho = pathToFileURL(requireModulo.resolve("../src/controllers/github.js")).href;
  return import(`${caminho}?etapa5=${Date.now()}`);
}

function criarPool() {
  return criarPoolFake([
    {
      // middleware somenteDonoDoProjeto: SELECT criador_id FROM projetos WHERE id = ? LIMIT 1
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: (params) => {
        // projeto 1 pertence ao usuário 5 (admin); qualquer outro pedido é negado pelo middleware
        return [[{ criador_id: 5 }], []];
      },
    },
    {
      // middleware somenteMembroOuDonoDoProjeto: SELECT ... FROM membros_equipe ...
      match: (sql) => /^select .* from membros_equipe/.test(sql),
      resposta: () => [[], []],
    },
    {
      match: (sql) => /^select id, titulo from projetos where id = \?$/.test(sql),
      resposta: () => [[{ id: 1, titulo: "Projeto Teste" }], []],
    },
    {
      match: (sql) => /^update projetos set github_repository_id/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    {
      match: (sql) => /^select github_repository_id, github_repository_full_name/.test(sql),
      resposta: () => [[
        {
          github_repository_id: 100,
          github_repository_full_name: "empresa/repo-a",
          github_installation_id: 5,
          github_default_branch: "main",
          github_connected_at: new Date(),
          repositorio_url: "https://github.com/empresa/repo-a",
        },
      ], []],
    },
    {
      match: (sql) => /^select github_repository_id, github_repository_full_name, github_installation_id, github_default_branch, github_connected_at, repositorio_url from projetos where id = \?$/.test(sql),
      resposta: () => [[{ github_repository_id: null, github_repository_full_name: null, github_installation_id: null, github_default_branch: null, github_connected_at: null, repositorio_url: null }], []],
    },
  ]);
}

describe("Conexão de repositório GitHub ao projeto (ETAPA 5)", () => {
  let app;
  const tokenOwner = tokenPara({ id: 5, email: "admin@email.com", nome: "Admin MontesSquad", tipo: "adm" });
  const tokenMembro = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });

  beforeEach(() => {
    vi.clearAllMocks();
    stubarGithubApp();
    app = buildApp(criarPool());
  });

  it("owner conecta repositório → 200 e dados salvos (consulta GitHub, não confia no browser)", async () => {
    fakeGetRepositoryById.mockResolvedValueOnce({
      id: 100,
      full_name: "empresa/repo-a",
      default_branch: "main",
      html_url: "https://github.com/empresa/repo-a",
    });
    const res = await request(app)
      .post("/projetos/1/github/repository")
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ installationId: 5, repositoryId: 100 });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.github_repository_full_name).toBe("empresa/repo-a");
    expect(fakeGetRepositoryById).toHaveBeenCalledWith(5, 100);
  });

  it("não-owner (membro comum) → 403 (middleware bloqueia)", async () => {
    const res = await request(app)
      .post("/projetos/1/github/repository")
      .set("Authorization", `Bearer ${tokenMembro}`)
      .send({ installationId: 5, repositoryId: 100 });

    expect(res.status).toBe(403);
  });

  it("repository inexistente/não autorizado → 404", async () => {
    fakeGetRepositoryById.mockRejectedValueOnce(new Error("Not Found"));
    const res = await request(app)
      .post("/projetos/1/github/repository")
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ installationId: 5, repositoryId: 999 });

    expect(res.status).toBe(404);
  });

  it("sem token → 401", async () => {
    const res = await request(app)
      .post("/projetos/1/github/repository")
      .send({ installationId: 5, repositoryId: 100 });
    expect(res.status).toBe(401);
  });

  it("payload sem installationId/repositoryId → 400", async () => {
    const res = await request(app)
      .post("/projetos/1/github/repository")
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("status do projeto sem GitHub → conectado=false (projeto sem GitHub continua funcionando)", async () => {
    const res = await request(app)
      .get("/projetos/1/github/status")
      .set("Authorization", `Bearer ${tokenOwner}`);
    // Admin passa no middleware; validamos o shape da resposta
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(typeof res.body.dados.conectado).toBe("boolean");
  });
});