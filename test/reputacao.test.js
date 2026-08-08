import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // 1. Verifica se o usuário existe
    match: (sql) => /^select id, nome from usuarios where id = \? limit 1$/.test(sql),
    resposta: () => [[{ id: 2, nome: "Lucas" }], []],
  },
  {
    // 2. Estatísticas — sem linha → defaults (level 1, xp 0, xpToNext 100)
    match: (sql) => /^select nivel, xp, xp_para_proximo, projetos_concluidos from estatisticas_usuario where usuario_id = \? limit 1$/.test(sql),
    resposta: () => [[], []],
  },
  {
    // 3. Avaliações (rating)
    match: (sql) => /^select avg\(nota\) as media, count\(\*\) as total from avaliacoes where avaliado_id = \?$/.test(sql),
    resposta: () => [[{ media: 4.5, total: 2 }], []],
  },
  {
    // 4. Conquistas
    match: (sql) => /^select c\.id, c\.titulo, c\.icone, c\.descricao from conquistas_usuario cu join conquistas c on c\.id = cu\.conquista_id where cu\.usuario_id = \? order by cu\.conquistado_em desc$/.test(sql),
    resposta: () => [[{ id: 1, titulo: "Primeiro projeto", icone: "trophy", descricao: "Criou o primeiro projeto" }], []],
  },
  {
    // 5. Reviews recebidas
    match: (sql) => /^select a\.id, u\.nome as author, p\.titulo as projectname, a\.nota, a\.comentario, a\.criado_em from avaliacoes a join usuarios u on u\.id = a\.avaliador_id left join projetos p on p\.id = a\.projeto_id where a\.avaliado_id = \? order by a\.criado_em desc$/.test(sql),
    resposta: () => [[{ id: 1, author: "Fernanda", projectName: "Squad X", nota: 5, comentario: "Ótimo trabalho", criado_em: "2026-01-10T00:00:00.000Z" }], []],
  },
  {
    // 6. Histórico de projetos (membros_equipe) — ETAPA 6: expõe membro_status
    match: (sql) => /^select p\.id as projeto_id, p\.titulo, p\.status, p\.criador_id, me\.funcao, me\.entrou_em, me\.status as membro_status from membros_equipe me join projetos p on p\.id = me\.projeto_id where me\.usuario_id = \? order by me\.entrou_em desc$/.test(sql),
    resposta: () => [[{ projeto_id: 10, titulo: "Squad X", status: "em_andamento", criador_id: 2, funcao: "Membro", entrou_em: "2026-01-05T00:00:00.000Z", membro_status: "ativo" }], []],
  },
]);

const app = buildApp(pool);

describe("Reputação — GET /usuarios/me/reputacao", () => {
  it("→ 200 com shape completo do contrato do frontend", async () => {
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
    const res = await request(app).get("/usuarios/me/reputacao").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);

    const d = res.body.dados;
    expect(d.level).toBe(1); // default sem linha em estatisticas_usuario
    expect(d.xp).toBe(0);
    expect(d.xpToNext).toBe(100);
    expect(d.rating).toBe(4.5);
    expect(d.reviewsCount).toBe(2);
    expect(d.projectsCompleted).toBe(0);

    expect(Array.isArray(d.achievements)).toBe(true);
    expect(d.achievements[0]).toEqual({
      id: "1",
      label: "Primeiro projeto",
      description: "Criou o primeiro projeto",
      icon: "trophy",
    });

    expect(Array.isArray(d.reviews)).toBe(true);
    expect(d.reviews[0]).toMatchObject({ id: "1", author: "Fernanda", rating: 5 });

    expect(Array.isArray(d.history)).toBe(true);
    expect(d.history[0]).toMatchObject({
      id: "10",
      projectName: "Squad X",
      role: "Owner", // criador_id === usuarioId
      status: "Em andamento",
      technologies: [],
    });
  });

  it("usuário inexistente → 404", async () => {
    // handler de usuarios retorna vazio quando o id não é 2
    const pool404 = criarPoolFake([
      {
        match: (sql) => /^select id, nome from usuarios where id = \? limit 1$/.test(sql),
        resposta: () => [[], []],
      },
    ]);
    const app404 = buildApp(pool404);
    const token = tokenPara({ id: 2 });
    const res = await request(app404).get("/usuarios/999/reputacao").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
