import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Perfil técnico completo — Evolução ETAPA 3
// Endpoints: GET /funcoes, GET /usuarios/me/perfil, PATCH /usuarios/me/perfil,
// PUT /usuarios/me/funcoes, PUT /usuarios/me/habilidades.
//
// SQL normalizado casado por regex (ordem dos handlers importa: específicos primeiro).
function criarPoolComPerfil({
  usuarioRows = [
    {
      id: 1,
      nome: "Lucas Mendes",
      email: "lucas@email.com",
      bio: "Dev Backend focado em APIs.",
      localizacao: "São Paulo, SP",
      avatar_url: null,
      tipo: "membro",
      disponibilidade_horas_semana: 20,
      objetivo_profissional: "Crescer como líder técnico",
      perfil_completo: 1,
    },
  ],
  habilidadesRows = [{ id: 1, nome: "Node.js", nivel: "avancado" }],
  funcoesUsuarioRows = [{ id: 1, nome: "Backend", nivel_interesse: "alto" }],
  funcoesRows = [
    { id: 1, nome: "Backend" },
    { id: 2, nome: "Frontend" },
  ],
  qtdHabilidades = 1,
} = {}) {
  return criarPoolFake([
    // GET /funcoes
    { match: (sql) => /^select id, nome from funcoes order by nome$/.test(sql), resposta: () => [funcoesRows, []] },
    // SELECT do usuário (GET perfil e PATCH final)
    { match: (sql) => /^select id, nome, email, bio, localizacao, avatar_url, tipo, disponibilidade_horas_semana/.test(sql), resposta: () => [usuarioRows, []] },
    // JOIN habilidades com nível
    { match: (sql) => /^select h\.id, h\.nome, hu\.nivel/.test(sql), resposta: () => [habilidadesRows, []] },
    // JOIN funcoes com nivel_interesse
    { match: (sql) => /^select f\.id, f\.nome, fu\.nivel_interesse/.test(sql), resposta: () => [funcoesUsuarioRows, []] },
    // UPDATE perfil_completo (PATCH e PUT habilidades) — ANTES de updates genéricos
    { match: (sql) => /^update usuarios set perfil_completo = \? where id = \?$/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    // UPDATE principal do PATCH
    { match: (sql) => /^update usuarios set nome/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    // Contagem de habilidades (recalcula perfil_completo)
    { match: (sql) => /^select count\(\*\) as total from habilidades_usuario where usuario_id = \?$/.test(sql), resposta: () => [[{ total: qtdHabilidades }], []] },
    // SELECT nome (PUT habilidades)
    { match: (sql) => /^select nome from usuarios where id = \? limit 1$/.test(sql), resposta: () => [[{ nome: "Lucas Mendes" }], []] },
    // Upsert funcoes_usuario
    { match: (sql) => /^insert into funcoes_usuario \(usuario_id, funcao_id, nivel_interesse\)/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    // Upsert habilidades_usuario
    { match: (sql) => /^insert into habilidades_usuario \(usuario_id, habilidade_id, nivel\)/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
  ]);
}

const TOKEN = tokenPara({ id: 1 });

describe("Perfil técnico completo (Evolução ETAPA 3)", () => {
  let app;

  beforeEach(() => {
    app = buildApp(criarPoolComPerfil());
  });

  // ---------- GET /funcoes ----------
  it("GET /funcoes → 200 com lista de funções", async () => {
    const res = await request(app).get("/funcoes").set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(2);
    expect(res.body.dados).toEqual([
      { id: 1, nome: "Backend" },
      { id: 2, nome: "Frontend" },
    ]);
  });

  it("GET /funcoes sem token → 401", async () => {
    const res = await request(app).get("/funcoes");
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
  });

  // ---------- GET /usuarios/me/perfil ----------
  it("GET /usuarios/me/perfil → 200 com shape completo (básico + habilidades com nível + funções)", async () => {
    const res = await request(app)
      .get("/usuarios/me/perfil")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toMatchObject({
      id: 1,
      nome: "Lucas Mendes",
      email: "lucas@email.com",
      bio: "Dev Backend focado em APIs.",
      localizacao: "São Paulo, SP",
      disponibilidade_horas_semana: 20,
      objetivo_profissional: "Crescer como líder técnico",
      perfil_completo: 1,
    });
    expect(res.body.dados.habilidades).toEqual([{ id: 1, nome: "Node.js", nivel: "avancado" }]);
    expect(res.body.dados.funcoes).toEqual([{ id: 1, nome: "Backend", nivel_interesse: "alto" }]);
  });

  it("GET /usuarios/me/perfil sem token → 401", async () => {
    const res = await request(app).get("/usuarios/me/perfil");
    expect(res.status).toBe(401);
  });

  it("GET /usuarios/me/perfil usuário inexistente → 404", async () => {
    app = buildApp(criarPoolComPerfil({ usuarioRows: [] }));
    const res = await request(app)
      .get("/usuarios/me/perfil")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
  });

  // ---------- PATCH /usuarios/me/perfil ----------
  it("PATCH /usuarios/me/perfil → 200 atualiza campos e recalcula perfil_completo", async () => {
    const pool = criarPoolComPerfil({
      usuarioRows: [
        {
          id: 1,
          nome: "Novo Nome",
          email: "lucas@email.com",
          bio: "Dev Backend focado em APIs.",
          localizacao: "São Paulo, SP",
          avatar_url: null,
          tipo: "membro",
          disponibilidade_horas_semana: 30,
          objetivo_profissional: "Tech Lead",
          perfil_completo: 1,
        },
      ],
    });
    app = buildApp(pool);

    const res = await request(app)
      .patch("/usuarios/me/perfil")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ nome: "Novo Nome", disponibilidade_horas_semana: 30, objetivo_profissional: "Tech Lead" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.nome).toBe("Novo Nome");
    expect(res.body.dados.disponibilidade_horas_semana).toBe(30);
    expect(res.body.dados.objetivo_profissional).toBe("Tech Lead");
    expect(res.body.dados.perfil_completo).toBe(1);

    // UPDATE principal com os campos na ordem fixa do controller + id do usuário
    const update = buscarChamada(pool, /^update usuarios set nome/);
    expect(update.params).toEqual(["Novo Nome", 30, "Tech Lead", 1]);

    // perfil_completo recalculado (nome + 1 habilidade → 1)
    const perfilUpdate = buscarChamada(pool, /^update usuarios set perfil_completo/);
    expect(perfilUpdate.params).toEqual([1, 1]);
  });

  it("PATCH /usuarios/me/perfil sem token → 401", async () => {
    const res = await request(app).patch("/usuarios/me/perfil").send({ nome: "X" });
    expect(res.status).toBe(401);
  });

  it("PATCH /usuarios/me/perfil body vazio → 400 sem nenhuma query", async () => {
    const pool = criarPoolComPerfil();
    app = buildApp(pool);
    const res = await request(app)
      .patch("/usuarios/me/perfil")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Nenhum campo");
    expect(pool.chamadas).toHaveLength(0);
  });

  it("PATCH /usuarios/me/perfil disponibilidade inválida → 400", async () => {
    const res = await request(app)
      .patch("/usuarios/me/perfil")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ disponibilidade_horas_semana: 999 });
    expect(res.status).toBe(400);
  });

  // ---------- PUT /usuarios/me/funcoes ----------
  it("PUT /usuarios/me/funcoes → 200 faz upsert (INSERT ... ON DUPLICATE KEY UPDATE)", async () => {
    const pool = criarPoolComPerfil();
    app = buildApp(pool);

    const res = await request(app)
      .put("/usuarios/me/funcoes")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({
        funcoes: [
          { funcao_id: 1, nivel_interesse: "alto" },
          { funcao_id: 2, nivel_interesse: "baixo" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.funcoes).toEqual([
      { funcao_id: 1, nivel_interesse: "alto" },
      { funcao_id: 2, nivel_interesse: "baixo" },
    ]);

    const inserts = pool.chamadas.filter((c) => /^insert into funcoes_usuario/.test(c.sql));
    expect(inserts).toHaveLength(2);
    expect(inserts[0].params).toEqual([1, 1, "alto"]);
    expect(inserts[1].params).toEqual([1, 2, "baixo"]);
    expect(inserts[0].sql).toContain("on duplicate key update nivel_interesse");
  });

  it("PUT /usuarios/me/funcoes funcao_id inválido → 400", async () => {
    const res = await request(app)
      .put("/usuarios/me/funcoes")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ funcoes: [{ funcao_id: "abc", nivel_interesse: "alto" }] });
    expect(res.status).toBe(400);
  });

  it("PUT /usuarios/me/funcoes sem token → 401", async () => {
    const res = await request(app).put("/usuarios/me/funcoes").send({ funcoes: [] });
    expect(res.status).toBe(401);
  });

  // ---------- PUT /usuarios/me/habilidades ----------
  it("PUT /usuarios/me/habilidades → 200 faz upsert com nível e recalcula perfil_completo", async () => {
    const pool = criarPoolComPerfil();
    app = buildApp(pool);

    const res = await request(app)
      .put("/usuarios/me/habilidades")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ habilidades: [{ habilidade_id: 1, nivel: "avancado" }] });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.habilidades).toEqual([{ habilidade_id: 1, nivel: "avancado" }]);
    expect(res.body.dados.perfil_completo).toBe(true);

    const inserts = pool.chamadas.filter((c) => /^insert into habilidades_usuario/.test(c.sql));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].params).toEqual([1, 1, "avancado"]);
    expect(inserts[0].sql).toContain("on duplicate key update nivel");

    // perfil_completo recalculado (nome + 1 habilidade → 1)
    const perfilUpdate = buscarChamada(pool, /^update usuarios set perfil_completo/);
    expect(perfilUpdate.params).toEqual([1, 1]);
  });

  it("PUT /usuarios/me/habilidades nivel inválido → 400", async () => {
    const res = await request(app)
      .put("/usuarios/me/habilidades")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ habilidades: [{ habilidade_id: 1, nivel: "mestre" }] });
    expect(res.status).toBe(400);
  });

  it("PUT /usuarios/me/habilidades sem token → 401", async () => {
    const res = await request(app).put("/usuarios/me/habilidades").send({ habilidades: [] });
    expect(res.status).toBe(401);
  });
});
