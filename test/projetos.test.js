import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // INSERT INTO projetos (...) — retorna o id 99
    match: (sql) => /^insert into projetos \(criador_id, titulo, descricao, status, limite_membros, repositorio_url, figma_url, discord_url, documentacao_url\) values/.test(sql),
    resposta: () => [{ insertId: 99, affectedRows: 1 }, []],
  },
  {
    // Vínculo do criador em membros_equipe (FASE-03 fix)
    match: (sql) => /^insert into membros_equipe \(projeto_id, usuario_id\) values \(\?, \?\)$/.test(sql),
    resposta: () => [{ insertId: 1, affectedRows: 1 }, []],
  },
  {
    // SELECT de listagem com GROUP_CONCAT de tecnologias
    match: (sql) => /^select p\.id, p\.criador_id, u\.nome as criador_nome,.*from projetos p left join usuarios u on p\.criador_id = u\.id$/.test(sql),
    resposta: () => [[
      {
        id: 1, criador_id: 2, criador_nome: "Lucas", titulo: "Squad QA", descricao: "desc",
        status: "aberto", limite_membros: 5, criado_em: "2026-01-01T00:00:00.000Z",
        repositorio_url: null, figma_url: null, discord_url: null, documentacao_url: null,
        total_membros: 1, tecnologias: "React||Node.js",
      },
      {
        id: 2, criador_id: 3, criador_nome: "Fernanda", titulo: "Squad Mobile", descricao: "",
        status: "em_andamento", limite_membros: 4, criado_em: "2026-02-01T00:00:00.000Z",
        repositorio_url: null, figma_url: null, discord_url: null, documentacao_url: null,
        total_membros: 2, tecnologias: null,
      },
    ], []],
  },
]);

const app = buildApp(pool);

describe("Projetos", () => {
  it("POST /projetos → 200 e vincula o criador em membros_equipe", async () => {
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
    const res = await request(app)
      .post("/projetos")
      .set("Authorization", `Bearer ${token}`)
      .send({ titulo: "Squad Teste FASE-05", descricao: "teste" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.id).toBe(99);
    expect(res.body.dados.criador_id).toBe(2);

    const vinculo = buscarChamada(pool, /^insert into membros_equipe \(projeto_id, usuario_id\)/);
    expect(vinculo).toBeDefined();
    expect(vinculo.params).toEqual([99, 2]);
  });

  it("POST /projetos sem título → 400 (sem consultar o banco)", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app).post("/projetos").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("título");
  });

  it("GET /projetos → 200 com tecnologias em ARRAY", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app).get("/projetos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(2);
    expect(Array.isArray(res.body.dados[0].tecnologias)).toBe(true);
    expect(res.body.dados[0].tecnologias).toEqual(["React", "Node.js"]);
    // tecnologias NULL → array vazio
    expect(res.body.dados[1].tecnologias).toEqual([]);
  });
});

// B1 do QA: membersCount do GET /projetos/:id somava COUNT+1 — o criador JÁ
// está em membros_equipe desde a FASE-03, então mostrava sempre 1 a mais.
// Correção: GREATEST(COUNT, 1) — sem +1 e com mínimo de 1 (dono) para
// projetos antigos sem vínculo do criador na tabela.
describe("Projetos — GET /projetos/:id (B1 do QA)", () => {
  it("membersCount usa GREATEST(COUNT, 1) e NÃO soma +1 ao COUNT", async () => {
    const pool = criarPoolFake([
      {
        // SELECT principal do projeto — row com membersCount = 1 (dono JÁ no COUNT)
        match: (sql) => /^select p\.id, p\.criador_id, u\.nome as criador_nome/.test(sql),
        resposta: () => [[
          {
            id: 1, criador_id: 2, criador_nome: "Lucas", name: "Squad QA",
            description: "desc", status: "aberto", visibilidade: "publico",
            permitirPortfolioPublico: 1, membersLimit: 5,
            repositorioUrl: null, figmaUrl: null, discordUrl: null, documentacaoUrl: null,
            createdAt: "2026-01-01T00:00:00.000Z", membersCount: 1,
          },
        ], []],
      },
      // tecnologias necessárias
      { match: (sql) => /from habilidades_projeto hp join habilidades h/.test(sql), resposta: () => [[], []] },
      // vagas do projeto
      { match: (sql) => /from vagas_projeto v join funcoes f/.test(sql), resposta: () => [[], []] },
      // membros do squad (sem outros membros — só o dono, já no COUNT)
      { match: (sql) => /from membros_equipe me join usuarios/.test(sql), resposta: () => [[], []] },
      // checagem de privacidade: dono/membro? (SELECT id ... AND usuario_id = ?)
      { match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \?$/.test(sql), resposta: () => [[{ id: 1 }], []] },
      // habilidades por membro (dono)
      { match: (sql) => /from habilidades_usuario hu join habilidades h/.test(sql), resposta: () => [[], []] },
      // tasks do kanban (dono → branch privada)
      { match: (sql) => /from tarefas t left join usuarios u on t\.responsavel_id = u\.id/.test(sql), resposta: () => [[], []] },
      // mensagens do mural (dono → branch privada)
      { match: (sql) => /from mensagens m join usuarios u on m\.remetente_id = u\.id/.test(sql), resposta: () => [[], []] },
      // candidaturas (dono vê todas)
      { match: (sql) => /from candidaturas c join usuarios u on c\.usuario_id = u\.id/.test(sql), resposta: () => [[], []] },
    ]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 2 });

    const res = await request(app).get("/projetos/1").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Dono único na equipe → membersCount 1 (sem o +1 que daria 2)
    expect(res.body.dados.membersCount).toBe(1);
    expect(res.body.dados.members).toHaveLength(1);

    const sqlProj = buscarChamada(pool, /^select p\.id, p\.criador_id, u\.nome as criador_nome/);
    expect(sqlProj).toBeDefined();
    expect(/\+ 1 as memberscount/.test(sqlProj.sql)).toBe(false);
    expect(/greatest\(\(select count\(\*\) from membros_equipe where projeto_id = p\.id\), 1\) as memberscount/.test(sqlProj.sql)).toBe(true);
  });
});
