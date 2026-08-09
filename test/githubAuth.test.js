import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, setEnvAmbiente } from "./helpers/bootstrap.js";

setEnvAmbiente();
process.env.GITHUB_CLIENT_ID = "client-teste";
process.env.GITHUB_CLIENT_SECRET = "secret-teste";
process.env.GITHUB_AUTH_CALLBACK_URL = "http://localhost:3333/auth/github/callback";
process.env.GITHUB_FRONTEND_SUCCESS_URL = "http://localhost:5173";

// Stub do githubOAuth via Module._load (mesmo padrão dos testes GitHub)
const { Module, createRequire } = await import("node:module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.endsWith("services/githubOAuth")) {
    return {
      buildGitHubAuthorizationUrl: (state) => `https://github.com/login/oauth/authorize?client_id=x&state=${state}`,
      exchangeCodeForAccessToken: async (code) => `token-${code}`,
      fetchGitHubUser: async (token) => githubUserResponse,
      fetchGitHubPrimaryEmail: async () => "gh@email.com",
    };
  }
  return originalLoad.apply(this, arguments);
};

let githubUserResponse = { id: 999, login: "novo-dev", name: "Novo Dev", avatar_url: "https://a" };

function criarPoolComUsuarios({ porGithub = [], porEmail = [], porId = [] } = {}) {
  return criarPoolFake([
    { match: (sql) => /^select \* from usuarios where github_user_id = \? limit 1$/.test(sql), resposta: () => [porGithub, []] },
    { match: (sql) => /^select id, email from usuarios where email = \? limit 1$/.test(sql), resposta: () => [porEmail, []] },
    { match: (sql) => /^insert into usuarios \(nome, email, senha, bio, localizacao, avatar_url/.test(sql), resposta: () => [{ insertId: 77, affectedRows: 1 }, []] },
    { match: (sql) => /^select \* from usuarios where id = \? limit 1$/.test(sql), resposta: () => [porId, []] },
    { match: (sql) => /^update usuarios set /.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
  ]);
}

describe("GitHub Auth — cadastro/login (Evolução ETAPA 1)", () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    githubUserResponse = { id: 999, login: "novo-dev", name: "Novo Dev", avatar_url: "https://a" };
    app = buildApp(criarPoolComUsuarios());
  });

  it("GET /auth/github → retorna URL de autorização com state", async () => {
    const res = await request(app).get("/auth/github");
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.url).toContain("github.com/login/oauth/authorize");
    expect(res.body.dados.state).toBeTruthy();
  });

  it("callback com state inválido → 401", async () => {
    const res = await request(app).get("/auth/github/callback?code=abc&state=invalido");
    expect(res.status).toBe(401);
    expect(res.body.message).toContain("state inválido");
  });

  it("callback sem code/state → 400", async () => {
    const res = await request(app).get("/auth/github/callback");
    expect(res.status).toBe(400);
  });

  it("callback com state válido + usuário novo → cria parcial e redireciona p/ complete-profile", async () => {
    // State real (JWT assinado com o secret do bootstrap)
    const { createRequire: cr } = await import("node:module");
    const jwtMod = cr(import.meta.url)("jsonwebtoken");
    const state = jwtMod.sign({ oauth: "github-auth", uid: null }, process.env.JWT_SECRET, { expiresIn: "10m" });

    app = buildApp(criarPoolComUsuarios({
      porGithub: [],
      porEmail: [],
      porId: [{ id: 77, nome: "Novo Dev", email: "gh@email.com", senha: "hash", tipo: "membro", cadastro_origem: "github", github_login: "novo-dev", github_avatar_url: "https://a" }],
    }));

    const res = await request(app)
      .get("/auth/github/callback")
      .query({ code: "c1", state });
    expect(res.status).toBe(302);
    // M1 (auditoria): token entregue no FRAGMENT (#token), nunca em query string
    expect(res.headers.location).toContain("/auth/github/complete-profile#token=");
    expect(res.headers.location).not.toContain("?token=");
  });

  it("callback com e-mail existente → NÃO vincula automaticamente (redirect email-exists)", async () => {
    const { createRequire: cr } = await import("node:module");
    const jwtMod = cr(import.meta.url)("jsonwebtoken");
    const state = jwtMod.sign({ oauth: "github-auth", uid: null }, process.env.JWT_SECRET, { expiresIn: "10m" });

    app = buildApp(criarPoolComUsuarios({
      porGithub: [],
      porEmail: [{ id: 9, email: "gh@email.com" }],
    }));

    const res = await request(app)
      .get("/auth/github/callback")
      .query({ code: "c1", state });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("/auth/github/email-exists");
  });

  it("callback com github_user_id existente → login direto (redirect success)", async () => {
    const { createRequire: cr } = await import("node:module");
    const jwtMod = cr(import.meta.url)("jsonwebtoken");
    const state = jwtMod.sign({ oauth: "github-auth", uid: null }, process.env.JWT_SECRET, { expiresIn: "10m" });

    app = buildApp(criarPoolComUsuarios({
      porGithub: [{ id: 5, nome: "Dev Existente", email: "dev@x.com", senha: "hash", tipo: "membro", cadastro_origem: "github" }],
    }));

    const res = await request(app)
      .get("/auth/github/callback")
      .query({ code: "c1", state });
    expect(res.status).toBe(302);
    // M1 (auditoria): token entregue no FRAGMENT (#token), nunca em query string
    expect(res.headers.location).toContain("/auth/github/success#token=");
    expect(res.headers.location).not.toContain("?token=");
  });

  it("complete-profile autenticado → atualiza nome/bio e devolve token", async () => {
    const pool = criarPoolComUsuarios({
      porId: [{ id: 77, nome: "Novo Dev", email: "gh@email.com", senha: "hash", tipo: "membro", cadastro_origem: "github", github_login: "novo-dev", github_avatar_url: "https://a" }],
    });
    app = buildApp(pool);
    const token = tokenPara({ id: 77, email: "gh@email.com", nome: "Novo Dev", tipo: "membro" });
    const res = await request(app)
      .post("/auth/github/complete-profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Nome Completado", bio: "Dev backend" });
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.token).toBeTruthy();
    // UPDATE foi disparado com os campos novos
    const updateChamado = pool.chamadas.some((c) => /update usuarios set nome = \?/.test(c.sql));
    expect(updateChamado).toBe(true);
  });

  it("complete-profile sem token → 401", async () => {
    const res = await request(app).post("/auth/github/complete-profile").send({ nome: "X" });
    expect(res.status).toBe(401);
  });

  it("falha do GitHub (exchange token) → erro tratável 502", async () => {
    // Sobrescreve o stub do githubOAuth ANTES de reconstruir o app (require cache)
    const { Module: Mod } = await import("node:module");
    const origLoad = Mod._load;
    Mod._load = function (request, parent, isMain) {
      if (request.endsWith("services/githubOAuth")) {
        return {
          buildGitHubAuthorizationUrl: (state) => `https://github.com/login/oauth/authorize?state=${state}`,
          exchangeCodeForAccessToken: async () => { throw new Error("GitHub indisponível"); },
          fetchGitHubUser: async () => { throw new Error("GitHub indisponível"); },
          fetchGitHubPrimaryEmail: async () => null,
        };
      }
      return origLoad.apply(this, arguments);
    };

    app = buildApp(criarPoolComUsuarios());

    const { createRequire: cr2 } = await import("node:module");
    const jwtMod2 = cr2(import.meta.url)("jsonwebtoken");
    const state = jwtMod2.sign({ oauth: "github-auth", uid: null }, process.env.JWT_SECRET, { expiresIn: "10m" });

    const res = await request(app)
      .get("/auth/github/callback")
      .query({ code: "c-falha", state });
    expect([500, 502]).toContain(res.status);
    expect(res.body.sucesso).toBe(false);
  });
});