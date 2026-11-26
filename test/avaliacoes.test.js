import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara } from "./helpers/bootstrap.js";

describe("Avaliações de Projeto — POST /projetos/:projetoId/avaliacoes", () => {
  it("sem token → 401", async () => {
    const app = buildApp(criarPoolFake([]));
    const res = await request(app)
      .post("/projetos/1/avaliacoes")
      .send({ avaliado_id: 2, nota: 5 });

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
  });

  it("projeto inexistente → 404", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id, criador_id, titulo, status from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[], []],
      },
    ]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 1, email: "user@email.com", nome: "Dono" });

    const res = await request(app)
      .post("/projetos/999/avaliacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ avaliado_id: 2, nota: 5 });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Projeto não encontrado/i);
  });

  it("projeto não finalizado → 400", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id, criador_id, titulo, status from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ id: 1, criador_id: 1, titulo: "App Teste", status: "em_andamento" }], []],
      },
    ]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 1, email: "user@email.com", nome: "Dono" });

    const res = await request(app)
      .post("/projetos/1/avaliacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ avaliado_id: 2, nota: 5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/após a finalização do projeto/i);
  });

  it("não pode avaliar a si mesmo → 400", async () => {
    const pool = criarPoolFake([]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 1, email: "user@email.com", nome: "Dono" });

    const res = await request(app)
      .post("/projetos/1/avaliacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ avaliado_id: 1, nota: 5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/não pode avaliar a si mesmo/i);
  });

  it("nota inválida (menor que 1 ou maior que 5) → 400", async () => {
    const pool = criarPoolFake([]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 1, email: "user@email.com", nome: "Dono" });

    const res = await request(app)
      .post("/projetos/1/avaliacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ avaliado_id: 2, nota: 6 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nota deve ser um número inteiro entre 1 e 5/i);
  });

  it("avaliador de fora do squad → 403", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id, criador_id, titulo, status from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ id: 1, criador_id: 10, titulo: "App Teste", status: "finalizado" }], []],
      },
      {
        match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and \(status is null or status = 'ativo'\) limit 1$/i.test(sql),
        resposta: () => [[], []],
      },
    ]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 99, email: "intruso@email.com", nome: "Intruso" });

    const res = await request(app)
      .post("/projetos/1/avaliacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ avaliado_id: 2, nota: 5 });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Apenas participantes do squad/i);
  });

  it("duplicação de avaliação no mesmo projeto → 409", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id, criador_id, titulo, status from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ id: 1, criador_id: 1, titulo: "App Teste", status: "finalizado" }], []],
      },
      {
        // Avaliado é membro
        match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and \(status is null or status = 'ativo'\) limit 1$/i.test(sql),
        resposta: () => [[{ id: 12 }], []],
      },
      {
        // Já existe avaliação desse par no projeto
        match: (sql) => /^select id from avaliacoes where projeto_id = \? and avaliador_id = \? and avaliado_id = \? limit 1$/i.test(sql),
        resposta: () => [[{ id: 5 }], []],
      },
    ]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });

    const res = await request(app)
      .post("/projetos/1/avaliacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ avaliado_id: 2, nota: 5 });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/já avaliou este colega neste projeto/i);
  });

  it("membro avalia outro membro com sucesso → 201", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id, criador_id, titulo, status from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ id: 1, criador_id: 10, titulo: "App Teste", status: "finalizado" }], []],
      },
      {
        // Avaliador (2) e avaliado (3) checam membros_equipe
        match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and \(status is null or status = 'ativo'\) limit 1$/i.test(sql),
        resposta: () => [[{ id: 50 }], []],
      },
      {
        // Não existe avaliação prévia
        match: (sql) => /^select id from avaliacoes where projeto_id = \? and avaliador_id = \? and avaliado_id = \? limit 1$/i.test(sql),
        resposta: () => [[], []],
      },
      {
        // Insert avaliacao
        match: (sql) => /^insert into avaliacoes/i.test(sql),
        resposta: () => [{ insertId: 42 }, []],
      },
      {
        // Update usuarios
        match: (sql) => /^update usuarios/i.test(sql),
        resposta: () => [{ affectedRows: 1 }, []],
      },
      {
        // Insert notificacao
        match: (sql) => /^insert into notificacoes/i.test(sql),
        resposta: () => [{ insertId: 99 }, []],
      },
    ]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 2, email: "membro@email.com", nome: "Membro" });

    const res = await request(app)
      .post("/projetos/1/avaliacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ avaliado_id: 3, nota: 5, comentario: "Excelente colaboração!" });

    expect(res.status).toBe(201);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toMatchObject({
      id: 42,
      projeto_id: 1,
      avaliador_id: 2,
      avaliado_id: 3,
      nota: 5,
      comentario: "Excelente colaboração!",
    });
  });

  it("membro avalia o dono do projeto com sucesso → 201", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id, criador_id, titulo, status from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ id: 1, criador_id: 10, titulo: "App Teste", status: "finalizado" }], []],
      },
      {
        // Avaliador (2) checa membros_equipe
        match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and \(status is null or status = 'ativo'\) limit 1$/i.test(sql),
        resposta: () => [[{ id: 50 }], []],
      },
      {
        // Não existe avaliação prévia
        match: (sql) => /^select id from avaliacoes where projeto_id = \? and avaliador_id = \? and avaliado_id = \? limit 1$/i.test(sql),
        resposta: () => [[], []],
      },
      {
        match: (sql) => /^insert into avaliacoes/i.test(sql),
        resposta: () => [{ insertId: 43 }, []],
      },
      {
        match: (sql) => /^update usuarios/i.test(sql),
        resposta: () => [{ affectedRows: 1 }, []],
      },
      {
        match: (sql) => /^insert into notificacoes/i.test(sql),
        resposta: () => [{ insertId: 100 }, []],
      },
    ]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 2, email: "membro@email.com", nome: "Membro" });

    const res = await request(app)
      .post("/projetos/1/avaliacoes")
      .set("Authorization", `Bearer ${token}`)
      .send({ avaliado_id: 10, nota: 4, comentario: "Liderança técnica muito clara!" });

    expect(res.status).toBe(201);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.avaliado_id).toBe(10);
  });
});

describe("Listagem de avaliações do projeto — GET /projetos/:projetoId/avaliacoes", () => {
  it("retorna lista de avaliações e array de avaliadosPorMim", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id, criador_id, status from projetos where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ id: 1, criador_id: 10, status: "finalizado" }], []],
      },
      {
        match: (sql) => /^select a\.id, a\.projeto_id, a\.avaliador_id, u1\.nome as avaliador_nome, a\.avaliado_id, u2\.nome as avaliado_nome, a\.nota, a\.comentario, a\.criado_em from avaliacoes a join usuarios u1 on a\.avaliador_id = u1\.id join usuarios u2 on a\.avaliado_id = u2\.id where a\.projeto_id = \? order by a\.criado_em desc$/i.test(sql),
        resposta: () => [
          [
            {
              id: 1,
              projeto_id: 1,
              avaliador_id: 2,
              avaliador_nome: "Membro",
              avaliado_id: 3,
              avaliado_nome: "Outro Dev",
              nota: 5,
              comentario: "Excelente!",
              criado_em: "2026-03-01T00:00:00.000Z",
            },
          ],
          [],
        ],
      },
    ]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 2, email: "membro@email.com", nome: "Membro" });

    const res = await request(app)
      .get("/projetos/1/avaliacoes")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.avaliacoes).toHaveLength(1);
    expect(res.body.dados.avaliadosPorMim).toEqual([3]);
  });
});

