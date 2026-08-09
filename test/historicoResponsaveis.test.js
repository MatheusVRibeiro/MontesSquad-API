import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// ETAPA 9 — histórico de responsáveis de tarefa:
//   POST /abandonar (responsável atual), POST /remover-responsavel (owner),
//   POST /reatribuir (owner), GET /historico-responsaveis (membro/dono)
//   e registro automático em POST /assumir.

const INSERT_HISTORICO =
  /^insert into historico_responsaveis_tarefa \(tarefa_id, usuario_id, acao, realizado_por\) values \(\?, \?, \?, \?\)$/;

// Pool fake com todos os handlers dos fluxos da ETAPA 9.
function criarPool(opts = {}) {
  const {
    criadorId = 1, // dono do projeto (middleware)
    membro = true, // usuário logado é membro do squad (middleware)
    tarefa = { id: 38, responsavel_id: 2, status: "doing" }, // null → 404
    novoMembroAtivo = true, // reatribuir: novo responsável é membro ativo?
    assumirAfetadas = 1,
    githubRepo = null,
  } = opts;

  return criarPoolFake([
    // Middleware somenteMembroOuDonoDoProjeto / somenteDonoDoProjeto (1)
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: criadorId }], []],
    },
    // Middleware somenteMembroOuDonoDoProjeto (assumir/abandonar) E reatribuir
    // (novo responsável precisa ser membro ATIVO) usam a MESMA query
    // (status='ativo' LIMIT 1) — um único handler cobre as duas:
    // `membro` controla o middleware; `novoMembroAtivo` controla a checagem
    // do controller em POST /reatribuir.
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/.test(sql),
      resposta: () => (membro && novoMembroAtivo ? [[{ id: 9 }], []] : [[], []]),
    },
    // UPDATE assumir (ETAPA 7)
    {
      match: (sql) => /^update tarefas set responsavel_id = \?, status = 'doing', assumida_em = now\(\) where id = \? and projeto_id = \? and responsavel_id is null$/i.test(sql),
      resposta: () => [{ affectedRows: assumirAfetadas }, []],
    },
    // SELECT tarefa — distinção 404/409 (assumir) e reatribuir
    {
      match: (sql) => /^select id, responsavel_id from tarefas where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => (tarefa ? [[{ id: tarefa.id, responsavel_id: tarefa.responsavel_id }], []] : [[], []]),
    },
    // SELECT tarefa — abandonar/remover (inclui status)
    {
      match: (sql) => /^select id, responsavel_id, status from tarefas where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => (tarefa ? [[{ id: tarefa.id, responsavel_id: tarefa.responsavel_id, status: tarefa.status }], []] : [[], []]),
    },
    // UPDATE abandonar
    {
      match: (sql) => /^update tarefas set responsavel_id = null, status = 'todo' where id = \? and projeto_id = \? and responsavel_id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // UPDATE remover responsável
    {
      match: (sql) => /^update tarefas set responsavel_id = null where id = \? and projeto_id = \? and responsavel_id is not null$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // UPDATE reatribuir
    {
      match: (sql) => /^update tarefas set responsavel_id = \? where id = \? and projeto_id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // SELECT tarefa final (reatribuir)
    {
      match: (sql) => /^select id, titulo, status, responsavel_id from tarefas where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 38, titulo: "Tarefa X", status: "doing", responsavel_id: 7 }], []],
    },
    // INSERT no histórico (ETAPA 9)
    {
      match: (sql) => INSERT_HISTORICO.test(sql),
      resposta: () => [{ insertId: 1, affectedRows: 1 }, []],
    },
    // SELECT do histórico (GET historico-responsaveis)
    {
      match: (sql) => /^select h\.id, h\.tarefa_id, h\.usuario_id, h\.acao, h\.realizado_por, h\.criado_em, u\.nome as usuario_nome/.test(sql),
      resposta: () => [
        [
          {
            id: 10,
            tarefa_id: 38,
            usuario_id: 2,
            acao: "assumiu",
            realizado_por: 2,
            criado_em: "2026-08-08T10:00:00.000Z",
            usuario_nome: "Lucas",
            realizado_por_nome: "Lucas",
          },
        ],
        [],
      ],
    },
    // assumir: projeto sem GitHub (não gera branch)
    {
      match: (sql) => /^select github_repository_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ github_repository_id: githubRepo }], []],
    },
    // assumir: SELECT final da task
    {
      match: (sql) => /^select t\.id, t\.titulo, t\.status, t\.github_branch/.test(sql),
      resposta: () => [[{ id: 38, titulo: "T", status: "doing", github_branch: null, responsavel_nome: "Lucas" }], []],
    },
  ]);
}

const tokenResponsavel = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
const tokenOutro = tokenPara({ id: 3, email: "roberto@email.com", nome: "Roberto" });
const tokenOwner = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });

describe("ETAPA 9 — histórico de responsáveis de tarefa", () => {
  it("assumir registra histórico com acao='assumiu'", async () => {
    const pool = criarPool();
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/tarefas/38/assumir")
      .set("Authorization", `Bearer ${tokenResponsavel}`);
    expect(res.status).toBe(200);

    const hist = buscarChamada(pool, INSERT_HISTORICO);
    expect(hist).toBeDefined();
    expect(hist.params).toEqual(["38", 2, "assumiu", 2]);
  });

  it("responsável atual abandona → 200, status 'todo' + histórico 'abandonou'", async () => {
    const pool = criarPool();
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/tarefas/38/abandonar")
      .set("Authorization", `Bearer ${tokenResponsavel}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.responsavel_id).toBeNull();
    expect(res.body.dados.status).toBe("todo");

    const hist = buscarChamada(pool, INSERT_HISTORICO);
    expect(hist).toBeDefined();
    expect(hist.params).toEqual(["38", 2, "abandonou", 2]);
  });

  it("não-responsável tenta abandonar → 403", async () => {
    const pool = criarPool({ tarefa: { id: 38, responsavel_id: 2, status: "doing" } });
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/tarefas/38/abandonar")
      .set("Authorization", `Bearer ${tokenOutro}`); // usuário 3 ≠ responsável 2
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("responsável");
    expect(buscarChamada(pool, INSERT_HISTORICO)).toBeUndefined();
  });

  it("abandonar tarefa sem responsável → 409", async () => {
    const pool = criarPool({ tarefa: { id: 38, responsavel_id: null, status: "todo" } });
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/tarefas/38/abandonar")
      .set("Authorization", `Bearer ${tokenResponsavel}`);
    expect(res.status).toBe(409);
    expect(buscarChamada(pool, INSERT_HISTORICO)).toBeUndefined();
  });

  it("owner remove responsável → 200 + histórico 'removido' (realizado_por=owner)", async () => {
    const pool = criarPool();
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/tarefas/38/remover-responsavel")
      .set("Authorization", `Bearer ${tokenOwner}`);
    expect(res.status).toBe(200);
    expect(res.body.dados.responsavel_id).toBeNull();

    const hist = buscarChamada(pool, INSERT_HISTORICO);
    expect(hist).toBeDefined();
    expect(hist.params).toEqual(["38", 2, "removido", 1]);
  });

  it("membro (não-owner) tenta remover responsável → 403", async () => {
    const pool = criarPool();
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/tarefas/38/remover-responsavel")
      .set("Authorization", `Bearer ${tokenResponsavel}`);
    expect(res.status).toBe(403);
    expect(buscarChamada(pool, INSERT_HISTORICO)).toBeUndefined();
  });

  it("owner reatribui a membro ativo → 200 + histórico 'reatribuido'", async () => {
    const pool = criarPool();
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/tarefas/38/reatribuir")
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ usuario_id: 7 });
    expect(res.status).toBe(200);
    expect(res.body.dados.responsavel_id).toBe(7);

    const hist = buscarChamada(pool, INSERT_HISTORICO);
    expect(hist).toBeDefined();
    expect(hist.params).toEqual(["38", 7, "reatribuido", 1]);
  });

  it("reatribuir a membro NÃO ativo → 400", async () => {
    const pool = criarPool({ novoMembroAtivo: false });
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/tarefas/38/reatribuir")
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ usuario_id: 7 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("membro ativo");
    expect(buscarChamada(pool, INSERT_HISTORICO)).toBeUndefined();
  });

  it("reatribuir sem usuario_id → 400", async () => {
    const pool = criarPool();
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/tarefas/38/reatribuir")
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("GET histórico → 200 com nomes (JOIN usuarios) e shape correto", async () => {
    const pool = criarPool();
    const app = buildApp(pool);
    const res = await request(app)
      .get("/projetos/1/tarefas/38/historico-responsaveis")
      .set("Authorization", `Bearer ${tokenResponsavel}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(1);
    expect(res.body.dados).toHaveLength(1);
    expect(res.body.dados[0]).toMatchObject({
      tarefa_id: 38,
      usuario_id: 2,
      acao: "assumiu",
      usuario_nome: "Lucas",
      realizado_por_nome: "Lucas",
    });
  });

  it("sem token → 401", async () => {
    const pool = criarPool();
    const app = buildApp(pool);
    const res = await request(app).get("/projetos/1/tarefas/38/historico-responsaveis");
    expect(res.status).toBe(401);
  });
});
