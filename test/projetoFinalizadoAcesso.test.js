import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara } from "./helpers/bootstrap.js";

describe("Regra de Acesso — Projetos Finalizados", () => {
  const tokenOwner = tokenPara({ id: 1, nome: "Owner", email: "owner@email.com" });
  const tokenMembro = tokenPara({ id: 2, nome: "Membro", email: "membro@email.com" });
  const tokenVisitante = tokenPara({ id: 99, nome: "Visitante", email: "visitante@email.com" });

  it("GET /projetos/:id em projeto finalizado por visitante (não-membro) → 403", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /from projetos p.*where p\.id = \?/i.test(sql),
        resposta: () => [[{
          id: 1,
          criador_id: 1,
          criador_nome: "Owner",
          name: "Squad Alpha",
          description: "Desc",
          longDescription: "Desc",
          status: "finalizado",
          membersLimit: 5,
          visibilidade: "publico",
          permitir_portfolio_publico: 1,
          createdAt: new Date().toISOString(),
          repositorioUrl: null,
          figmaUrl: null,
          discordUrl: null,
          documentacaoUrl: null,
          membersCount: 2,
        }], []],
      },
      {
        match: (sql) => /from habilidades_projeto/i.test(sql),
        resposta: () => [[], []],
      },
      {
        match: (sql) => /from vagas_projeto/i.test(sql),
        resposta: () => [[], []],
      },
      {
        match: (sql) => /from membros_equipe me/i.test(sql),
        resposta: () => [[{ id: 2, nome: "Membro", role: "Membro" }], []],
      },
      {
        match: (sql) => /select h\.nome from habilidades_usuario/i.test(sql),
        resposta: () => [[], []],
      },
      {
        match: (sql) => /select id, status from membros_equipe where projeto_id = \? and usuario_id = \?/i.test(sql),
        resposta: () => [[], []], // Visitante não é membro
      },
    ]);

    const app = buildApp(pool);
    const res = await request(app)
      .get("/projetos/1")
      .set("Authorization", `Bearer ${tokenVisitante}`);

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toContain("apenas participantes que fizeram parte deste squad");
  });

  it("GET /projetos/:id em projeto finalizado pelo criador (owner) → 200", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /from projetos p.*where p\.id = \?/i.test(sql),
        resposta: () => [[{
          id: 1,
          criador_id: 1,
          criador_nome: "Owner",
          name: "Squad Alpha",
          description: "Desc",
          longDescription: "Desc",
          status: "finalizado",
          membersLimit: 5,
          visibilidade: "publico",
          permitir_portfolio_publico: 1,
          createdAt: new Date().toISOString(),
          repositorioUrl: null,
          figmaUrl: null,
          discordUrl: null,
          documentacaoUrl: null,
          membersCount: 2,
        }], []],
      },
      { match: (sql) => /from habilidades_projeto/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /from vagas_projeto/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /from membros_equipe me/i.test(sql), resposta: () => [[{ id: 2, nome: "Membro", role: "Membro" }], []] },
      { match: (sql) => /select h\.nome from habilidades_usuario/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /select id, status from membros_equipe where projeto_id = \? and usuario_id = \?/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /from tarefas t/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /from mensagens m/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /from candidaturas c/i.test(sql), resposta: () => [[], []] },
    ]);

    const app = buildApp(pool);
    const res = await request(app)
      .get("/projetos/1")
      .set("Authorization", `Bearer ${tokenOwner}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.status).toBe("Finalizado");
  });

  it("GET /projetos/:id em projeto finalizado por membro do squad → 200", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /from projetos p.*where p\.id = \?/i.test(sql),
        resposta: () => [[{
          id: 1,
          criador_id: 1,
          criador_nome: "Owner",
          name: "Squad Alpha",
          description: "Desc",
          longDescription: "Desc",
          status: "finalizado",
          membersLimit: 5,
          visibilidade: "publico",
          permitir_portfolio_publico: 1,
          createdAt: new Date().toISOString(),
          repositorioUrl: null,
          figmaUrl: null,
          discordUrl: null,
          documentacaoUrl: null,
          membersCount: 2,
        }], []],
      },
      { match: (sql) => /from habilidades_projeto/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /from vagas_projeto/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /from membros_equipe me/i.test(sql), resposta: () => [[{ id: 2, nome: "Membro", role: "Membro" }], []] },
      { match: (sql) => /select h\.nome from habilidades_usuario/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /select id, status from membros_equipe where projeto_id = \? and usuario_id = \?/i.test(sql), resposta: () => [[{ id: 10, status: "ativo" }], []] },
      { match: (sql) => /from tarefas t/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /from mensagens m/i.test(sql), resposta: () => [[], []] },
      { match: (sql) => /from candidaturas c/i.test(sql), resposta: () => [[], []] },
    ]);

    const app = buildApp(pool);
    const res = await request(app)
      .get("/projetos/1")
      .set("Authorization", `Bearer ${tokenMembro}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.status).toBe("Finalizado");
  });
});

