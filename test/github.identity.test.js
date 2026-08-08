import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { buildApp, criarPoolFake, tokenPara, setEnvAmbiente } from "./helpers/bootstrap.js";

setEnvAmbiente();
process.env.GITHUB_APP_ID = "123";
process.env.GITHUB_PRIVATE_KEY = "key-mock";
process.env.GITHUB_WEBHOOK_SECRET = "segredo-teste";
process.env.GITHUB_CLIENT_ID = "client-teste";
process.env.GITHUB_CLIENT_SECRET = "secret-teste";
process.env.GITHUB_CALLBACK_URL = "http://localhost:3333/github/callback";

// Stub do githubApp (mesmo padrão Module._load dos testes anteriores)
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

function criarPool() {
  return criarPoolFake([
    {
      // GET /github/me — SELECT github_* FROM usuarios
      match: (sql) => /^select github_user_id, github_login, github_avatar_url, github_connected_at from usuarios where id = \? limit 1$/.test(sql),
      resposta: () => [[{ github_user_id: 90573780, github_login: "MatheusVRibeiro", github_avatar_url: "https://a", github_connected_at: new Date() }], []],
    },
    {
      // callback: SELECT duplicado
      match: (sql) => /^select id from usuarios where github_user_id = \? and id != \? limit 1$/.test(sql),
      resposta: () => [[], []],
    },
    {
      // callback: UPDATE vinculo
      match: (sql) => /^update usuarios set\s+github_user_id = \?, github_login = \?, github_avatar_url = \?, github_connected_at = now\(\)\s+where id = \?$/i.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    {
      // disconnect: UPDATE limpar vinculo
      match: (sql) => /^update usuarios set github_user_id = null, github_login = null, github_avatar_url = null, github_connected_at = null\s+where id = \?$/i.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
  ]);
}

describe("Identidade GitHub do usuário (ETAPA 6)", () => {
  let app;
  const token = tokenPara({ id: 5, email: "admin@email.com", nome: "Admin MontesSquad", tipo: "adm" });

  beforeEach(() => {
    app = buildApp(criarPool());
  });

  it("GET /github/me retorna estado conectado", async () => {
    const res = await request(app).get("/github/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.conectado).toBe(true);
    expect(res.body.dados.github_login).toBe("MatheusVRibeiro");
  });

  it("GET /github/me sem token → 401", async () => {
    const res = await request(app).get("/github/me");
    expect(res.status).toBe(401);
  });

  it("GET /github/connect gera URL OAuth com state anti-CSRF", async () => {
    const res = await request(app).get("/github/connect").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.url).toContain("github.com/login/oauth/authorize");
    expect(res.body.dados.url).toContain("state=");
    expect(res.body.dados.state).toBeTruthy();
    // state é JWT assinado (anti-CSRF)
    const decoded = jwt.verify(res.body.dados.state, process.env.JWT_SECRET);
    expect(decoded.oauth).toBe("github");
  });

  it("GET /github/callback com state inválido → 401", async () => {
    const res = await request(app).get("/github/callback?code=abc&state=invalido");
    expect(res.status).toBe(401);
    expect(res.body.message).toContain("state");
  });

  it("GET /github/callback sem code/state → 400", async () => {
    const res = await request(app).get("/github/callback");
    expect(res.status).toBe(400);
  });

  it("DELETE /github/disconnect remove vínculo (200)", async () => {
    const res = await request(app).delete("/github/disconnect").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });
});