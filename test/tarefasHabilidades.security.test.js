// test/tarefasHabilidades.security.test.js — ETAPA 7 (tasks com habilidades e dificuldade)
//
// Contract-first (skill montesquad-development, testes-seguranca-etapas.md):
// este arquivo codifica o CONTRATO da ETAPA 7 (spec: scripts/migrar_evolucao_etapa7.js
// + docs/api.md) e roda contra o controller ATUAL (src/controllers/tarefas.js).
//
// Histórico honesto:
//   - Antes da implementação: 2 passam (401) / 3 falham (dificuldade/habilidades
//     ausentes no body, validação inexistente, agregação inexistente).
//   - Com a implementação da ETAPA 7 no controller (subagente backend, em
//     paralelo): os mocks abaixo foram alinhados aos SQLs novos (INSERT com
//     dificuldade, INSERT habilidades_tarefa, SELECT h.nome de agregação) e o
//     arquivo passou a ser o GATE do contrato.
// Contrato verificado:
//   - POST/PATCH aceitam { dificuldade, habilidades:[ids] } e validam
//     dificuldade em 'iniciante'|'intermediaria'|'avancada' → 400 se inválida;
//   - POST/PATCH/GET retornam dificuldade + habilidades (array de NOMES);
//   - habilidades persistem em habilidades_tarefa (PK tarefa_id+habilidade_id).

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Factory do pool da ETAPA 7 — mocka o fluxo ATUAL do controller (regra 3 do
// skill): a falha honesta é mismatch de status/body, não crash de query não mapeada.
function criarPoolEtapa7({ criadorId = 1, linhasTarefas = [], habilidadesDaTarefa = [] } = {}) {
  return criarPoolFake([
    // somenteMembroOuDonoDoProjeto — dono do projeto
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: criadorId }], []],
    },
    // somenteMembroOuDonoDoProjeto — vínculo de squad (usuário 5 não é membro)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? limit 1$/.test(sql),
      resposta: (params) => (params[1] === 5 ? [[], []] : [[{ id: 9 }], []]),
    },
    // POST — INSERT da tarefa (ETAPA 7: com coluna dificuldade)
    {
      match: (sql) =>
        /^insert into tarefas \(projeto_id, responsavel_id, titulo, descricao, status, prioridade, data_vencimento, dificuldade\) values \(\?, \?, \?, \?, 'todo', \?, \?, \?\)$/.test(
          sql
        ),
      resposta: () => [{ insertId: 55, affectedRows: 1 }, []],
    },
    // POST/PATCH — vínculo de habilidades (uma INSERT por habilidade)
    {
      match: (sql) => /^insert into habilidades_tarefa \(tarefa_id, habilidade_id\) values \(\?, \?\)$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // POST — checagem de repositório GitHub (fluxo atual, após o INSERT)
    {
      match: (sql) => /^select github_repository_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ github_repository_id: null }], []],
    },
    // POST/PATCH — carregarHabilidadesTarefa (nomes de UMA tarefa)
    {
      match: (sql) =>
        /^select h\.nome from habilidades_tarefa ht join habilidades h on h\.id = ht\.habilidade_id where ht\.tarefa_id = \? order by h\.nome$/.test(
          sql
        ),
      resposta: () => [habilidadesDaTarefa, []],
    },
    // GET — listagem com LEFT JOIN usuarios (t.*: passthrough de dificuldade).
    // ETAPA 10: o filtro 'AND t.excluida_em IS NULL' foi anexado ao final —
    // prefixo sem $ para casar com a variante atual do contrato.
    {
      match: (sql) =>
        /^select t\.\*, u\.nome as responsavel_nome from tarefas t left join usuarios u on t\.responsavel_id = u\.id where t\.projeto_id = \?/.test(
          sql
        ),
      resposta: () => [linhasTarefas, []],
    },
    // GET — subtarefas de cada tarefa
    {
      match: (sql) => /^select id, titulo, concluida as done from subtarefas where tarefa_id = \?$/.test(sql),
      resposta: () => [[], []],
    },
    // GET — agregação de habilidades do projeto (ETAPA 7: JOIN habilidades_tarefa)
    {
      match: (sql) =>
        /^select ht\.tarefa_id, h\.nome from habilidades_tarefa ht join habilidades h on h\.id = ht\.habilidade_id join tarefas t on t\.id = ht\.tarefa_id where t\.projeto_id = \? order by h\.nome$/.test(
          sql
        ),
      resposta: () => [
        [
          { tarefa_id: 38, nome: "Node.js" },
          { tarefa_id: 38, nome: "SQL" },
        ],
        [],
      ],
    },
    // Fallback SELECT (regra 6) — SELECTs de checagem não crasham;
    // INSERT/UPDATE/DELETE continuam estritos (falha alta em write inesperado).
    { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
  ]);
}

describe("ETAPA 7 — autorização (sem token)", () => {
  it("POST /projetos/1/tarefas sem token → 401", async () => {
    const app = buildApp(criarPoolEtapa7());
    const res = await request(app)
      .post("/projetos/1/tarefas")
      .send({ titulo: "Tarefa sem token" });

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
  });

  it("PATCH /projetos/1/tarefas/38 sem token → 401", async () => {
    const app = buildApp(criarPoolEtapa7());
    const res = await request(app)
      .patch("/projetos/1/tarefas/38")
      .send({ status: "done" });

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
  });
});

describe("ETAPA 7 — contrato (dificuldade/habilidades)", () => {
  it("membro cria tarefa com dificuldade/habilidades → 200 e body reflete (ETAPA 7)", async () => {
    const pool = criarPoolEtapa7({
      habilidadesDaTarefa: [{ nome: "Node.js" }, { nome: "SQL" }],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });

    const res = await request(app)
      .post("/projetos/1/tarefas")
      .set("Authorization", `Bearer ${token}`)
      .send({ titulo: "Integrar habilidades", dificuldade: "intermediaria", habilidades: [3, 5] });

    expect(res.status).toBe(200);
    expect(res.body.dados.dificuldade).toBe("intermediaria");
    // habilidades retorna como array de NOMES (contrato ETAPA 7)
    expect(res.body.dados.habilidades).toEqual(["Node.js", "SQL"]);

    // Persistência: cada habilidade vai para habilidades_tarefa
    // (PK composta tarefa_id + habilidade_id, conforme migrar_evolucao_etapa7.js)
    const insertHab = buscarChamada(pool, /^insert into habilidades_tarefa/);
    expect(insertHab).toBeDefined();
    expect(insertHab.params[0]).toBe(55); // tarefa_id recém-criada
    expect(insertHab.params[1]).toBe(3); // primeira habilidade
  });

  it("POST com dificuldade inválida → 400 (validação ETAPA 7)", async () => {
    const app = buildApp(criarPoolEtapa7());
    const token = tokenPara({ id: 2 });

    const res = await request(app)
      .post("/projetos/1/tarefas")
      .set("Authorization", `Bearer ${token}`)
      .send({ titulo: "Tarefa inválida", dificuldade: "invalida" });

    // Valores válidos: 'iniciante' | 'intermediaria' | 'avancada'
    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toContain("Dificuldade inválida");
  });

  it("GET /projetos/1/tarefas com token → 200 e shape com dificuldade + habilidades (ETAPA 7)", async () => {
    const pool = criarPoolEtapa7({
      linhasTarefas: [
        {
          id: 38,
          projeto_id: 1,
          titulo: "Task com dificuldade",
          status: "todo",
          dificuldade: "intermediaria",
          responsavel_nome: "Lucas",
        },
      ],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 2 });

    const res = await request(app)
      .get("/projetos/1/tarefas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toBeInstanceOf(Array);
    expect(res.body.dados[0].dificuldade).toBe("intermediaria"); // passthrough de t.*
    // Agregação ETAPA 7: habilidades como array de nomes (JOIN habilidades_tarefa)
    expect(res.body.dados[0].habilidades).toEqual(["Node.js", "SQL"]);
  });
});
