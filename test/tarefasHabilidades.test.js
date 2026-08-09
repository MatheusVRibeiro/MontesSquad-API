import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // somenteMembroOuDonoDoProjeto — projeto existe
    match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
    resposta: () => [[{ criador_id: 1 }], []],
  },
  {
    // somenteMembroOuDonoDoProjeto — usuário é membro
    match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/.test(sql),
    resposta: () => [[{ id: 9 }], []],
  },
  {
    // INSERT INTO tarefas (com dificuldade)
    match: (sql) => /^insert into tarefas \(projeto_id, responsavel_id, titulo, descricao, status, prioridade, data_vencimento, dificuldade\) values \(\?, \?, \?, \?, 'todo', \?, \?, \?\)$/.test(sql),
    resposta: () => [{ insertId: 77, affectedRows: 1 }, []],
  },
  {
    // ETAPA 7: SELECT github_repository_id do projeto (após criar tarefa)
    match: (sql) => /^select github_repository_id from projetos where id = \? limit 1$/.test(sql),
    resposta: () => [[{ github_repository_id: null }], []],
  },
  {
    // ETAPA 7: INSERT INTO habilidades_tarefa (vínculo tarefa ↔ habilidade)
    match: (sql) => /^insert into habilidades_tarefa \(tarefa_id, habilidade_id\) values \(\?, \?\)$/.test(sql),
    resposta: () => [{ insertId: 1, affectedRows: 1 }, []],
  },
  {
    // ETAPA 7: DELETE FROM habilidades_tarefa (substituição na edição)
    match: (sql) => /^delete from habilidades_tarefa where tarefa_id = \?$/.test(sql),
    resposta: () => [{ affectedRows: 2 }, []],
  },
  {
    // ETAPA 7: carregarHabilidadesTarefa (JOIN habilidades_tarefa → habilidades)
    match: (sql) => /^select h\.nome from habilidades_tarefa ht join habilidades h on h\.id = ht\.habilidade_id where ht\.tarefa_id = \? order by h\.nome$/.test(sql),
    resposta: () => [[{ nome: "Node.js" }, { nome: "React" }], []],
  },
  {
    // UPDATE tarefas (edição de dificuldade)
    match: (sql) => /^update tarefas set dificuldade = \? where id = \? and projeto_id = \?$/.test(sql),
    resposta: () => [{ affectedRows: 1 }, []],
  },
  {
    // Busca da tarefa atualizada (atualizarTarefa)
    match: (sql) => /^select \* from tarefas where id = \? and projeto_id = \? limit 1$/.test(sql),
    resposta: () => [[{ id: 8, titulo: "Tarefa editada", descricao: null, status: "todo", prioridade: "medium", dificuldade: "avancada", responsavel_id: null }], []],
  },
  {
    // Subtarefas (listar e atualizar)
    match: (sql) => /^select id, titulo, concluida as done from subtarefas where tarefa_id = \?$/.test(sql),
    resposta: () => [[], []],
  },
  {
    // ETAPA 7: listar — JOIN batch de habilidades de todas as tarefas do projeto
    match: (sql) => /^select ht\.tarefa_id, h\.nome from habilidades_tarefa ht join habilidades h on h\.id = ht\.habilidade_id join tarefas t on t\.id = ht\.tarefa_id where t\.projeto_id = \? order by h\.nome$/.test(sql),
    resposta: () => [[
      { tarefa_id: 1, nome: "Express" },
      { tarefa_id: 1, nome: "Node.js" },
      { tarefa_id: 2, nome: "Docker" },
    ], []],
  },
  {
    // listarTarefas — tarefas do projeto (ETAPA 10: filtro excluida_em IS NULL
    // anexado ao final — prefixo sem $ para casar com a variante atual)
    match: (sql) => /^select t\.\*, u\.nome as responsavel_nome from tarefas t left join usuarios u on t\.responsavel_id = u\.id where t\.projeto_id = \?/.test(sql),
    resposta: () => [[
      { id: 1, titulo: "Criar API de Login", descricao: null, status: "todo", prioridade: "medium", dificuldade: "intermediaria", responsavel_nome: null },
      { id: 2, titulo: "Deploy em staging", descricao: null, status: "doing", prioridade: "high", dificuldade: "avancada", responsavel_nome: "Lucas" },
    ], []],
  },
]);

const app = buildApp(pool);

describe("Tarefas — ETAPA 7 (habilidades e dificuldade)", () => {
  it("criar tarefa com dificuldade e habilidades → 200 + INSERT habilidades_tarefa disparado", async () => {
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
    const res = await request(app)
      .post("/projetos/10/tarefas")
      .set("Authorization", `Bearer ${token}`)
      .send({ titulo: "Criar API de Login", dificuldade: "avancada", habilidades: [1, 7] });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.id).toBe(77);
    expect(res.body.dados.dificuldade).toBe("avancada");
    expect(res.body.dados.habilidades).toEqual(["Node.js", "React"]);

    // INSERT INTO habilidades_tarefa foi disparado para cada habilidade
    const vinculos = pool.chamadas.filter((c) => /^insert into habilidades_tarefa/.test(c.sql));
    expect(vinculos.length).toBe(2);
    expect(vinculos[0].params).toEqual([77, 1]);
    expect(vinculos[1].params).toEqual([77, 7]);
  });

  it("criar tarefa sem dificuldade → default 'intermediaria' no INSERT", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app)
      .post("/projetos/10/tarefas")
      .set("Authorization", `Bearer ${token}`)
      .send({ titulo: "Tarefa sem dificuldade" });

    expect(res.status).toBe(200);
    expect(res.body.dados.dificuldade).toBe("intermediaria");

    // Última chamada de INSERT INTO tarefas (o pool acumula chamadas dos testes anteriores)
    const inserts = pool.chamadas.filter((c) => /^insert into tarefas/.test(c.sql));
    expect(inserts[inserts.length - 1].params[inserts[inserts.length - 1].params.length - 1]).toBe("intermediaria");
  });

  it("criar tarefa com dificuldade inválida → 400", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app)
      .post("/projetos/10/tarefas")
      .set("Authorization", `Bearer ${token}`)
      .send({ titulo: "X", dificuldade: "extrema" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Dificuldade inválida");
  });

  it("editar tarefa substitui as habilidades (DELETE + INSERT)", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app)
      .patch("/projetos/10/tarefas/8")
      .set("Authorization", `Bearer ${token}`)
      .send({ dificuldade: "avancada", habilidades: [2, 3] });

    expect(res.status).toBe(200);
    expect(res.body.dados.dificuldade).toBe("avancada");
    expect(res.body.dados.habilidades).toEqual(["Node.js", "React"]);

    // DELETE antiga lista + INSERT da nova (tarefaId vem de req.params → string)
    const del = buscarChamada(pool, /^delete from habilidades_tarefa/);
    expect(del).toBeDefined();
    expect(del.params).toEqual(["8"]);

    const inserts = pool.chamadas.filter((c) => /^insert into habilidades_tarefa/.test(c.sql) && c.params[0] === "8");
    expect(inserts.length).toBe(2);
    expect(inserts[0].params).toEqual(["8", 2]);
    expect(inserts[1].params).toEqual(["8", 3]);

    // UPDATE da tarefa carrega a dificuldade no params
    const upd = buscarChamada(pool, /^update tarefas set dificuldade/);
    expect(upd).toBeDefined();
    expect(upd.params[0]).toBe("avancada");
  });

  it("listar tarefas retorna dificuldade + habilidades (array de nomes)", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app)
      .get("/projetos/10/tarefas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nItens).toBe(2);
    expect(res.body.dados[0].dificuldade).toBe("intermediaria");
    expect(res.body.dados[0].habilidades).toEqual(["Express", "Node.js"]);
    expect(res.body.dados[1].dificuldade).toBe("avancada");
    expect(res.body.dados[1].habilidades).toEqual(["Docker"]);
  });

  it("sem token → 401", async () => {
    const res = await request(app)
      .post("/projetos/10/tarefas")
      .send({ titulo: "X", dificuldade: "iniciante", habilidades: [1] });

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
  });
});
