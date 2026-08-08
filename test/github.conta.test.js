import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { buildApp, criarPoolFake, tokenPara, setEnvAmbiente } from "./helpers/bootstrap.js";

// ETAPA 2 — Conectar/desconectar GitHub dentro do sistema (regra de senha)
setEnvAmbiente();
process.env.GITHUB_CLIENT_ID = "client-conta";
process.env.GITHUB_CLIENT_SECRET = "secret-conta";
process.env.GITHUB_CALLBACK_URL = "http://localhost:3333/github/callback";
process.env.GITHUB_FRONTEND_SUCCESS_URL = "http://localhost:5173";

// Stub do githubApp (mesmo padrão dos testes anteriores)
const { Module } = await import("node:module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../services/githubApp" || request.endsWith("services/githubApp")) {
    return {
      getRepositoryById: async () => ({}),
      listInstallationRepositories: async () => [],
    };
  }
  return originalLoad.apply(this, arguments);
};

/**
 * Pool fake configurável:
 * - situacaoDisconnect: "local" (senha definida) | "github-sem-senha" | "github-com-senha"
 * - ghIdJaVinculado: se true, o callback encontra github_user_id de outro usuário → 409
 */
function criarPool({ situacaoDisconnect = "local", ghIdJaVinculado = false } = {}) {
  const mapaDisconnect = {
    local: { cadastro_origem: "local", senha_definida: 1 },
    "github-sem-senha": { cadastro_origem: "github", senha_definida: 0 },
    "github-com-senha": { cadastro_origem: "github", senha_definida: 1 },
  };
  return criarPoolFake([
    {
      // GET /github/me
      match: (sql) => /^select github_user_id, github_login, github_avatar_url, github_connected_at,\s+senha_definida, cadastro_origem from usuarios where id = \? limit 1$/.test(sql),
      resposta: () => [[{ github_user_id: 90573780, github_login: "MatheusVRibeiro", github_avatar_url: "https://a", github_connected_at: new Date(), senha_definida: 1, cadastro_origem: "local" }], []],
    },
    {
      // callback: SELECT duplicado (GitHub ID já vinculado a outra conta)
      match: (sql) => /^select id from usuarios where github_user_id = \? and id != \? limit 1$/.test(sql),
      resposta: () => (ghIdJaVinculado ? [[{ id: 99 }], []] : [[], []]),
    },
    {
      // callback: UPDATE vinculo
      match: (sql) => /^update usuarios set\s+github_user_id = \?, github_login = \?, github_avatar_url = \?, github_connected_at = now\(\)\s+where id = \?$/i.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    {
      // disconnect: SELECT regra de senha (ETAPA 2)
      match: (sql) => /^select cadastro_origem, senha_definida from usuarios where id = \? limit 1$/.test(sql),
      resposta: () => [mapaDisconnect[situacaoDisconnect] ? [mapaDisconnect[situacaoDisconnect]] : [], []],
    },
    {
      // disconnect: UPDATE limpar vinculo
      match: (sql) => /^update usuarios set github_user_id = null, github_login = null, github_avatar_url = null, github_connected_at = null\s+where id = \?$/i.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
  ]);
}

describe("ETAPA 2 — Conectar/desconectar GitHub (regra de senha)", () => {
  let app;
  const token = tokenPara({ id: 5, email: "admin@email.com", nome: "Admin MontesSquad", tipo: "adm" });

  beforeEach(() => {
    app = buildApp(criarPool());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET /github/connect — conta local inicia conexão (200 + URL OAuth)", async () => {
    const res = await request(app).get("/github/connect").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.url).toContain("github.com/login/oauth/authorize");
    expect(res.body.dados.url).toContain("state=");
  });

  it("GET /github/connect sem token → 401", async () => {
    const res = await request(app).get("/github/connect");
    expect(res.status).toBe(401);
  });

  it("GET /github/callback — vincula conta pós-login e redireciona para Configurações (302)", async () => {
    // Stub do fetch: troca code→token e busca usuário do GitHub
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ json: async () => ({ access_token: "tok-conta" }) })
        .mockResolvedValueOnce({
          json: async () => ({ id: 90573780, login: "MatheusVRibeiro", avatar_url: "https://a" }),
        })
    );

    const state = jwt.sign({ oauth: "github", uid: 5 }, process.env.JWT_SECRET, { expiresIn: "10m" });
    const res = await request(app)
      .get(`/github/callback?code=code-teste&state=${encodeURIComponent(state)}`)
      .redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/configuracoes?github=connected");
  });

  it("GET /github/callback — GitHub ID já vinculado a outra conta → 409", async () => {
    app = buildApp(criarPool({ ghIdJaVinculado: true }));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ json: async () => ({ access_token: "tok-conta" }) })
        .mockResolvedValueOnce({
          json: async () => ({ id: 90573780, login: "MatheusVRibeiro", avatar_url: "https://a" }),
        })
    );

    const state = jwt.sign({ oauth: "github", uid: 5 }, process.env.JWT_SECRET, { expiresIn: "10m" });
    const res = await request(app).get(`/github/callback?code=code-teste&state=${encodeURIComponent(state)}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("já vinculada a outro usuário");
  });

  it("DELETE /github/disconnect — conta criada via GitHub SEM senha local → 409", async () => {
    app = buildApp(criarPool({ situacaoDisconnect: "github-sem-senha" }));
    const res = await request(app).delete("/github/disconnect").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Crie uma senha local antes de desconectar o GitHub");
  });

  it("DELETE /github/disconnect — conta GitHub COM senha definida → 200", async () => {
    app = buildApp(criarPool({ situacaoDisconnect: "github-com-senha" }));
    const res = await request(app).delete("/github/disconnect").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });

  it("DELETE /github/disconnect — conta local → 200", async () => {
    const res = await request(app).delete("/github/disconnect").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });

  it("DELETE /github/disconnect sem token → 401", async () => {
    const res = await request(app).delete("/github/disconnect");
    expect(res.status).toBe(401);
  });
});
