import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara } from "./helpers/bootstrap.js";

// Perfil técnico — Evolução ETAPA 3: SUÍTE DE SEGURANÇA (autorização + contrato).
//
// Foco deste arquivo (complementar a test/perfilTecnico.test.js):
//   1) Nenhum endpoint do perfil técnico responde SEM token → 401 (verificarToken),
//      incluindo variantes de token malformado/inválido/expirado;
//   2) Contrato do GET /usuarios/me/perfil (shape) e GET /funcoes COM token → 200.
//
// Os handlers do pool fake cobrem APENAS as queries que os controllers de perfil
// executam (SELECT de usuarios/habilidades/funcoes). Os cenários 401 não tocam o
// banco — o middleware rejeita antes — então usam um pool sem handlers.

// Pool fake para os cenários COM token: GET /funcoes (SELECT funcoes) e
// GET /usuarios/me/perfil (3 SELECTs: usuário, habilidades JOIN, funcoes JOIN).
// SQL casado na forma NORMALIZADA (lowercase + espaços colapsados) — ver bootstrap.
function criarPoolPerfil({ usuarioRows } = {}) {
  return criarPoolFake([
    // GET /funcoes — listarFuncoes
    {
      match: (sql) => /^select id, nome from funcoes order by nome$/.test(sql),
      resposta: () => [
        [
          { id: 1, nome: "Backend" },
          { id: 2, nome: "Frontend" },
        ],
        [],
      ],
    },
    // GET /usuarios/me/perfil — SELECT do usuário (CAMPOS_USUARIO_PERFIL)
    {
      match: (sql) =>
        /^select id, nome, email, bio, localizacao, avatar_url, tipo, disponibilidade_horas_semana, objetivo_profissional, perfil_completo from usuarios where id = \? limit 1$/.test(
          sql
        ),
      resposta: () => [
        usuarioRows ?? [
          {
            id: 7,
            nome: "Ana Teste",
            email: "ana@email.com",
            bio: null,
            localizacao: null,
            avatar_url: null,
            tipo: "membro",
            disponibilidade_horas_semana: 10,
            objetivo_profissional: "Backend",
            perfil_completo: 0,
          },
        ],
        [],
      ],
    },
    // GET /usuarios/me/perfil — habilidades com nível
    {
      match: (sql) =>
        /^select h\.id, h\.nome, hu\.nivel from habilidades_usuario hu inner join habilidades h on h\.id = hu\.habilidade_id where hu\.usuario_id = \? order by h\.nome$/.test(
          sql
        ),
      resposta: () => [[], []],
    },
    // GET /usuarios/me/perfil — funcoes com nivel_interesse
    {
      match: (sql) =>
        /^select f\.id, f\.nome, fu\.nivel_interesse from funcoes_usuario fu inner join funcoes f on f\.id = fu\.funcao_id where fu\.usuario_id = \? order by f\.nome$/.test(
          sql
        ),
      resposta: () => [[], []],
    },
  ]);
}

const TOKEN = tokenPara({ id: 7, email: "ana@email.com", nome: "Ana Teste" });

describe("Perfil técnico ETAPA 3 — autorização (401 sem token)", () => {
  // Sem token, TODAS as rotas da ETAPA 3 devem ser barradas pelo verificarToken
  // ANTES de qualquer query (pool sem handlers = qualquer query derruba o teste).
  const app = buildApp(criarPoolFake([]));

  it("GET /funcoes sem token → 401 com shape de erro", async () => {
    const res = await request(app).get("/funcoes");
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });

  it("GET /usuarios/me/perfil sem token → 401", async () => {
    const res = await request(app).get("/usuarios/me/perfil");
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });

  it("PATCH /usuarios/me/perfil sem token → 401 (não executa UPDATE)", async () => {
    const res = await request(app)
      .patch("/usuarios/me/perfil")
      .send({ nome: "X", disponibilidade_horas_semana: 20 });
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });

  it("PUT /usuarios/me/funcoes sem token → 401 (não executa INSERT)", async () => {
    const res = await request(app)
      .put("/usuarios/me/funcoes")
      .send({ funcoes: [{ funcao_id: 1, nivel_interesse: "alto" }] });
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });

  it("PUT /usuarios/me/habilidades sem token → 401 (não executa INSERT)", async () => {
    const res = await request(app)
      .put("/usuarios/me/habilidades")
      .send({ habilidades: [{ habilidade_id: 1, nivel: "avancado" }] });
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });
});

describe("Perfil técnico ETAPA 3 — autorização (token malformado/inválido)", () => {
  const app = buildApp(criarPoolFake([]));

  it("GET /usuarios/me/perfil com scheme errado (não-Bearer) → 401", async () => {
    const res = await request(app).get("/usuarios/me/perfil").set("Authorization", `Token ${TOKEN}`);
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Formato de token inválido");
  });

  it("GET /usuarios/me/perfil com token inválido → 401", async () => {
    const res = await request(app).get("/usuarios/me/perfil").set("Authorization", "Bearer nao-e-um-jwt");
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
  });

  it("GET /usuarios/me/perfil com token assinado por outro segredo → 401", async () => {
    const jwt = await import("jsonwebtoken");
    const tokenOutroSegredo = jwt.sign({ id: 7 }, "segredo-diferente", { expiresIn: "1h" });
    const res = await request(app).get("/usuarios/me/perfil").set("Authorization", `Bearer ${tokenOutroSegredo}`);
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
  });

  it("GET /usuarios/me/perfil com token expirado → 401", async () => {
    const jwt = await import("jsonwebtoken");
    const tokenExpirado = jwt.sign({ id: 7 }, process.env.JWT_SECRET, { expiresIn: "-1h" });
    const res = await request(app).get("/usuarios/me/perfil").set("Authorization", `Bearer ${tokenExpirado}`);
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
  });
});

describe("Perfil técnico ETAPA 3 — contrato com token válido (200)", () => {
  it("GET /funcoes → 200 com {sucesso, nItens, dados[]}", async () => {
    const app = buildApp(criarPoolPerfil());
    const res = await request(app).get("/funcoes").set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(2);
    expect(res.body.dados).toEqual([
      { id: 1, nome: "Backend" },
      { id: 2, nome: "Frontend" },
    ]);
  });

  it("GET /usuarios/me/perfil → 200 com shape {sucesso, dados:{nome, email, habilidades[], funcoes[], disponibilidade_horas_semana, objetivo_profissional, perfil_completo}}", async () => {
    const app = buildApp(criarPoolPerfil());
    const res = await request(app)
      .get("/usuarios/me/perfil")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Perfil técnico do usuário");
    // Shape: campos básicos do usuário + arrays de habilidades/funcoes
    expect(res.body.dados).toMatchObject({
      id: 7,
      nome: "Ana Teste",
      email: "ana@email.com",
      disponibilidade_horas_semana: 10,
      objetivo_profissional: "Backend",
      perfil_completo: 0,
    });
    // Contrato da ETAPA 3: habilidades e funcoes são SEMPRE arrays (vazios no perfil novo)
    expect(Array.isArray(res.body.dados.habilidades)).toBe(true);
    expect(Array.isArray(res.body.dados.funcoes)).toBe(true);
    expect(res.body.dados.habilidades).toEqual([]);
    expect(res.body.dados.funcoes).toEqual([]);
  });

  it("GET /usuarios/me/perfil → 200 com habilidades/funcoes preenchidas quando existem", async () => {
    const app = buildApp(
      criarPoolPerfil({
        usuarioRows: [
          {
            id: 7,
            nome: "Ana Teste",
            email: "ana@email.com",
            bio: "Dev Backend",
            localizacao: "SP",
            avatar_url: null,
            tipo: "membro",
            disponibilidade_horas_semana: 30,
            objetivo_profissional: "Tech Lead",
            perfil_completo: 1,
          },
        ],
      })
    );
    // Sobrescreve os handlers de habilidades/funcoes para retornar itens
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id, nome, email/.test(sql),
        resposta: () => [
          [
            {
              id: 7,
              nome: "Ana Teste",
              email: "ana@email.com",
              bio: "Dev Backend",
              localizacao: "SP",
              avatar_url: null,
              tipo: "membro",
              disponibilidade_horas_semana: 30,
              objetivo_profissional: "Tech Lead",
              perfil_completo: 1,
            },
          ],
          [],
        ],
      },
      {
        match: (sql) => /^select h\.id, h\.nome, hu\.nivel/.test(sql),
        resposta: () => [[{ id: 1, nome: "Node.js", nivel: "avancado" }], []],
      },
      {
        match: (sql) => /^select f\.id, f\.nome, fu\.nivel_interesse/.test(sql),
        resposta: () => [[{ id: 1, nome: "Backend", nivel_interesse: "alto" }], []],
      },
    ]);
    const app2 = buildApp(pool);
    const res = await request(app2)
      .get("/usuarios/me/perfil")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.perfil_completo).toBe(1);
    expect(res.body.dados.habilidades).toEqual([{ id: 1, nome: "Node.js", nivel: "avancado" }]);
    expect(res.body.dados.funcoes).toEqual([{ id: 1, nome: "Backend", nivel_interesse: "alto" }]);
  });
});
