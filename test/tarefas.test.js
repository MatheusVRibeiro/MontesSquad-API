import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // somenteMembroOuDonoDoProjeto
    match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
    resposta: () => [[{ criador_id: 1 }], []],
  },
  {
    // somenteMembroOuDonoDoProjeto
    match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? limit 1$/.test(sql),
    resposta: (params) => (params[1] === 5 ? [[], []] : [[{ id: 9 }], []]),
  },
  {
    // INSERT INTO tarefas (... status 'todo', prioridade, data_vencimento, dificuldade)
    match: (sql) => /^insert into tarefas \(projeto_id, responsavel_id, titulo, descricao, status, prioridade, data_vencimento, dificuldade\) values \(\?, \?, \?, \?, 'todo', \?, \?, \?\)$/.test(sql),
    resposta: () => [{ insertId: 55, affectedRows: 1 }, []],
  },
  {
    // ETAPA 7: carregarHabilidadesTarefa (JOIN habilidades_tarefa → habilidades)
    match: (sql) => /^select h\.nome from habilidades_tarefa ht join habilidades h on h\.id = ht\.habilidade_id where ht\.tarefa_id = \? order by h\.nome$/.test(sql),
    resposta: () => [[], []],
  },
  {
    // ETAPA 7: SELECT github_repository_id do projeto (após criar tarefa)
    match: (sql) => /^select github_repository_id from projetos where id = \? limit 1$/.test(sql),
    resposta: () => [[{ github_repository_id: null }], []],
  },
  {
    // criarNotificacao — INSERT (tipo task)
    match: (sql) => /^insert into notificacoes \(usuario_id, tipo, titulo, descricao, link\) values \(\?, \?, \?, \?, \?\)$/.test(sql),
    resposta: () => [{ insertId: 7, affectedRows: 1 }, []],
  },
  {
    // criarNotificacao — SELECT da notificação criada
    match: (sql) => /^select id, usuario_id, tipo, titulo, descricao, lida, link, criado_em from notificacoes where id = \? limit 1$/.test(sql),
    resposta: () => [[{ id: 7, usuario_id: 3, tipo: "task", titulo: "Nova tarefa atribuída", descricao: "Você recebeu uma nova tarefa", lida: 0, link: "/projetos/10", criado_em: "2026-01-01T00:00:00.000Z" }], []],
  },
]);

const app = buildApp(pool);

describe("Tarefas — POST /projetos/:projetoId/tarefas", () => {
  it("membro do squad cria tarefa → 200", async () => {
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
    const res = await request(app)
      .post("/projetos/10/tarefas")
      .set("Authorization", `Bearer ${token}`)
      .send({ titulo: "Implementar testes", prioridade: "high" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.id).toBe(55);
    expect(res.body.dados.titulo).toBe("Implementar testes");
    expect(res.body.dados.status).toBe("todo");
  });

  it("tarefa com responsavel_id dispara notificação tipo 'task'", async () => {
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
    await request(app)
      .post("/projetos/10/tarefas")
      .set("Authorization", `Bearer ${token}`)
      .send({ titulo: "Tarefa atribuída", responsavel_id: 3 });

    const notif = buscarChamada(pool, /^insert into notificacoes \(usuario_id, tipo, titulo, descricao, link\)/);
    expect(notif).toBeDefined();
    expect(notif.params[0]).toBe(3); // responsável
    expect(notif.params[1]).toBe("task");
  });

  it("não-membro → 403", async () => {
    const token = tokenPara({ id: 5 });
    const res = await request(app)
      .post("/projetos/10/tarefas")
      .set("Authorization", `Bearer ${token}`)
      .send({ titulo: "X" });

    expect(res.status).toBe(403);
  });

  it("sem título → 400", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app)
      .post("/projetos/10/tarefas")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("título");
  });
});
