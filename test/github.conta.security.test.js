// test/github.conta.security.test.js
// ETAPA 2 — superfície GitHub da conta (me/connect/disconnect): casos negativos.
// Regras sob teste:
//   - sem token → 401 em GET /github/me, GET /github/connect, DELETE /github/disconnect;
//   - DELETE /github/disconnect com cadastro_origem='github' e senha_definida=0 → 409
//     (força definição de senha local antes de desconectar);
//   - DELETE /github/disconnect com senha definida → 200;
//   - GET /github/me com token → 200 com shape {sucesso, dados:{conectado, ...}}.
//
// NOTA: se a regra de 409 ainda não estiver implementada em src/controllers/github.js
// (outro subagent está implementando a ETAPA 2), o teste do 409 FALHA por design —
// o código atual desconecta direto com 200. Os handlers do pool fake cobrem AMBAS as
// queries (a atual e a da ETAPA 2) para o teste falhar na asserção, não no mock.
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, setEnvAmbiente } from "./helpers/bootstrap.js";

setEnvAmbiente();
process.env.GITHUB_CLIENT_ID = "client-conta-seg";
process.env.GITHUB_CLIENT_SECRET = "secret-conta-seg";
process.env.GITHUB_CALLBACK_URL = "http://localhost:3333/github/callback";
process.env.GITHUB_FRONTEND_SUCCESS_URL = "http://localhost:5173";

// Stub do githubApp (mesmo padrão dos testes existentes) — github.js o requer no load.
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

// Situações possíveis para DELETE /github/disconnect (regra da ETAPA 2).
const MAPA_DISCONNECT = {
  local: { cadastro_origem: "local", senha_definida: 1 },
  "github-sem-senha": { cadastro_origem: "github", senha_definida: 0 },
  "github-com-senha": { cadastro_origem: "github", senha_definida: 1 },
};

function criarPool({ situacaoDisconnect = "local" } = {}) {
  return criarPoolFake([
    {
      // GET /github/me — casa a query ATUAL e a da ETAPA 2 (senha_definida, cadastro_origem)
      match: (sql) =>
        /^select github_user_id, github_login, github_avatar_url, github_connected_at(, senha_definida, cadastro_origem)? from usuarios where id = \? limit 1$/.test(sql),
      resposta: () => [
        [
          {
            github_user_id: 90573780,
            github_login: "MatheusVRibeiro",
            github_avatar_url: "https://avatars.example/a.png",
            github_connected_at: new Date("2026-08-08T00:00:00Z"),
            senha_definida: 1,
            cadastro_origem: "local",
          },
        ],
        [],
      ],
    },
    {
      // DELETE /github/disconnect — SELECT da regra de senha (ETAPA 2)
      match: (sql) => /^select cadastro_origem, senha_definida from usuarios where id = \? limit 1$/.test(sql),
      resposta: (params) => {
        const linha = MAPA_DISCONNECT[situacaoDisconnect];
        return [linha ? [linha] : [], []];
      },
    },
    {
      // DELETE /github/disconnect — UPDATE que limpa o vínculo (histórico preservado)
      match: (sql) =>
        /^update usuarios set github_user_id = null, github_login = null, github_avatar_url = null, github_connected_at = null where id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
  ]);
}

describe("Segurança da conta GitHub (ETAPA 2) — me/connect/disconnect", () => {
  let app;
  const token = tokenPara({ id: 5, email: "admin@email.com", nome: "Admin MontesSquad", tipo: "adm" });

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp(criarPool());
  });

  it("GET /github/me sem token → 401", async () => {
    const res = await request(app).get("/github/me");
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
  });

  it("GET /github/connect sem token → 401", async () => {
    const res = await request(app).get("/github/connect");
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
  });

  it("DELETE /github/disconnect sem token → 401", async () => {
    const res = await request(app).delete("/github/disconnect");
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
  });

  it("DELETE /github/disconnect — cadastro_origem='github' e senha_definida=0 → 409", async () => {
    app = buildApp(criarPool({ situacaoDisconnect: "github-sem-senha" }));
    const res = await request(app).delete("/github/disconnect").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Crie uma senha local antes de desconectar o GitHub");
    expect(res.body.dados).toBeNull();
  });

  it("DELETE /github/disconnect — cadastro_origem='github' e senha_definida=1 → 200", async () => {
    app = buildApp(criarPool({ situacaoDisconnect: "github-com-senha" }));
    const res = await request(app).delete("/github/disconnect").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });

  it("GET /github/me com token → 200 com shape {sucesso, dados:{conectado, ...}}", async () => {
    const res = await request(app).get("/github/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toBeDefined();
    expect(typeof res.body.dados.conectado).toBe("boolean");
    expect(res.body.dados.conectado).toBe(true);
    expect(res.body.dados.github_login).toBe("MatheusVRibeiro");
    expect(res.body.dados.github_user_id).toBe(90573780);
  });
});
