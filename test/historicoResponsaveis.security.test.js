// test/historicoResponsaveis.security.test.js — ETAPA 9 (histórico de responsáveis)
//
// Contract-first (skill montesquad-development, references/testes-seguranca-etapas.md):
// este arquivo codifica o CONTRATO da ETAPA 9 e roda contra o controller ATUAL
// (src/controllers/tarefas.js) + rotas atuais (src/routes/routes.js).
//
// Contrato da ETAPA 9 (fonte: docs/api.md + scripts/migrar_evolucao_etapa9.js +
// implementação do subagente backend em src/controllers/tarefas.js):
//   - POST /projetos/:projetoId/tarefas/:tarefaId/abandonar
//       (verificarToken + somenteMembroOuDonoDoProjeto; controller exige que o
//       logado SEJA o responsavel_id da tarefa):
//       sem token → 401; não-responsável → 403 ("Apenas o responsável atual
//       pode abandonar a tarefa"); responsável → 200 com
//       UPDATE tarefas SET responsavel_id = NULL, status = 'todo'
//       (guard atômico AND responsavel_id = ?) + INSERT no histórico
//       (acao='abandonou').
//   - POST /projetos/:projetoId/tarefas/:tarefaId/remover-responsavel
//       (verificarToken + somenteDonoDoProjeto): não-owner → 403.
//   - POST /projetos/:projetoId/tarefas/:tarefaId/reatribuir
//       (verificarToken + somenteDonoDoProjeto; body { usuario_id }; valida que
//       o novo responsável é membro ATIVO do squad): owner → 200 com
//       UPDATE tarefas SET responsavel_id = ? + INSERT no histórico
//       (acao='reatribuido'); body sem usuario_id → 400.
//   - GET  /projetos/:projetoId/tarefas/:tarefaId/historico-responsaveis
//       (verificarToken + somenteMembroOuDonoDoProjeto): sem token → 401.
//
// Tabela do histórico: `historico_responsaveis_tarefa` (migrar_evolucao_etapa9.js)
// — INSERT (tarefa_id, usuario_id, acao, realizado_por) VALUES (?, ?, ?, ?).
//
// HISTÓRICO HONESTO (2026-08-08, implementação em andamento pelo subagente
// backend):
//   - 1ª execução (rotas inexistentes): 6/6 falharam com 404 — a lacuna exata.
//   - 2ª execução (rotas já registradas, mocks ainda com suposições minhas):
//     4/6 passaram (401×2, 403 não-responsável, 403 não-owner) e 2 falharam por
//     mock desalinhado ao SQL real (tabela historico_responsaveis_tarefa,
//     UPDATE com status='todo' + guard AND responsavel_id, body usuario_id).
//   - 3ª execução (mocks alinhados ao controller real): 5/6 — faltava mockar os
//     SELECTs da tarefa por shape (pré vs pós-UPDATE) para o reatribuir refletir
//     o NOVO responsável no body.
//   - 4ª execução (este arquivo): 6/6 passando.

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Factory do pool da ETAPA 9 — mocka middlewares (auth.js) + SQL REAL do
// controller (regra 3 do skill): a falha honesta é mismatch de status/contrato,
// não crash de query não mapeada. INSERT/UPDATE com regex EXATA (spec).
function criarPoolEtapa9({
  criadorId = 1, // dono do projeto 1 (somenteDonoDoProjeto / somenteMembroOuDonoDoProjeto)
  responsavelId = 2, // responsável ATUAL da tarefa 38
  novoResponsavelId = 9, // alvo do reatribuir
  membroAtivo = true, // reatribuir: novo responsável é membro ativo?
} = {}) {
  return criarPoolFake([
    // somenteDonoDoProjeto / somenteMembroOuDonoDoProjeto — dono do projeto
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: criadorId }], []],
    },
    // somenteMembroOuDonoDoProjeto — vínculo de squad (qualquer logado é membro aqui)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 9 }], []],
    },
    // reatribuir — SELECT do membro ATIVO (SQL real: com LIMIT 1 no final;
    // prefixo sem $ cobre variantes; params[1] = usuario_id do novo responsável)
    {
      match: (sql) =>
        /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo'/.test(
          sql
        ),
      resposta: (params) => (membroAtivo ? [[{ id: params[1] }], []] : [[], []]),
    },
    // abandonar/remover — SELECT da tarefa (responsável atual; SQL real: 3 colunas)
    {
      match: (sql) =>
        /^select id, responsavel_id, status from tarefas where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => [
        [{ id: 38, projeto_id: 1, titulo: "Task etapa 9", status: "doing", responsavel_id: responsavelId }],
        [],
      ],
    },
    // reatribuir — SELECT pré-UPDATE (SQL real: 2 colunas)
    {
      match: (sql) =>
        /^select id, responsavel_id from tarefas where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 38, responsavel_id: responsavelId }], []],
    },
    // reatribuir — SELECT pós-UPDATE (SQL real: 4 colunas; já reflete o NOVO responsável)
    {
      match: (sql) =>
        /^select id, titulo, status, responsavel_id from tarefas where id = \? and projeto_id = \? limit 1$/.test(
          sql
        ),
      resposta: () => [
        [{ id: 38, titulo: "Task etapa 9", status: "doing", responsavel_id: novoResponsavelId }],
        [],
      ],
    },
    // abandonar — UPDATE responsavel_id = NULL + status 'todo', guard atômico
    // AND responsavel_id = ? (SQL real do controller, 2026-08-08)
    {
      match: (sql) =>
        /^update tarefas set responsavel_id = null, status = 'todo' where id = \? and projeto_id = \? and responsavel_id = \?$/.test(
          sql
        ),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // reatribuir — UPDATE responsavel_id = novo responsável (SQL real)
    {
      match: (sql) => /^update tarefas set responsavel_id = \? where id = \? and projeto_id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // abandonar/remover/reatribuir — INSERT no histórico (SQL real:
    // historico_responsaveis_tarefa (tarefa_id, usuario_id, acao, realizado_por))
    {
      match: (sql) =>
        /^insert into historico_responsaveis_tarefa \(tarefa_id, usuario_id, acao, realizado_por\) values \(\?, \?, \?, \?\)$/.test(
          sql
        ),
      resposta: () => [{ insertId: 100, affectedRows: 1 }, []],
    },
    // Fallback SELECT (regra 6) — SELECTs de checagem/resposta não crasham;
    // INSERT/UPDATE/DELETE continuam estritos (falha alta em write inesperado).
    { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
  ]);
}

describe("ETAPA 9 — autorização (sem token)", () => {
  it("POST /projetos/1/tarefas/38/abandonar sem token → 401", async () => {
    const app = buildApp(criarPoolEtapa9());
    const res = await request(app).post("/projetos/1/tarefas/38/abandonar");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
  });

  it("GET /projetos/1/tarefas/38/historico-responsaveis sem token → 401", async () => {
    const app = buildApp(criarPoolEtapa9());
    const res = await request(app).get("/projetos/1/tarefas/38/historico-responsaveis");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
  });
});

describe("ETAPA 9 — contrato do responsável (abandonar)", () => {
  it("POST /abandonar com token de usuário que NÃO é o responsável → 403", async () => {
    const pool = criarPoolEtapa9({ responsavelId: 2 });
    const app = buildApp(pool);
    const token = tokenPara({ id: 5, email: "outro@email.com", nome: "Outro" });

    const res = await request(app)
      .post("/projetos/1/tarefas/38/abandonar")
      .set("Authorization", `Bearer ${token}`);

    // Middleware de squad passa (usuário 5 é membro); o CONTROLLER compara
    // usuarioAutenticado.id (5) com o responsavel_id da tarefa (2) → 403.
    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Apenas o responsável atual pode abandonar a tarefa");
    // Contrato: nenhum write deve ter sido emitido
    expect(buscarChamada(pool, /^update tarefas set responsavel_id/)).toBeFalsy();
    expect(buscarChamada(pool, /insert into historico_responsaveis_tarefa/)).toBeFalsy();
  });

  it("POST /abandonar com token do responsável → 200, UPDATE responsavel_id=NULL + INSERT histórico", async () => {
    const pool = criarPoolEtapa9({ responsavelId: 2 });
    const app = buildApp(pool);
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });

    const res = await request(app)
      .post("/projetos/1/tarefas/38/abandonar")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    // Contrato: tarefa liberada e status volta para 'todo'
    expect(res.body.dados.responsavel_id).toBeNull();
    expect(res.body.dados.status).toBe("todo");

    // Contrato ETAPA 9: UPDATE com guard atômico (params[2] = usuário logado)
    const updateAbandonar = buscarChamada(pool, /^update tarefas set responsavel_id = null/);
    expect(updateAbandonar).toBeDefined();
    expect(updateAbandonar.params[0]).toBe("38"); // tarefaId dos params da rota
    expect(updateAbandonar.params[2]).toBe(2); // responsavel_id = usuário logado

    // Histórico registrado com acao='abandonou' (evidência de contribuição)
    const insertHistorico = buscarChamada(pool, /insert into historico_responsaveis_tarefa/);
    expect(insertHistorico).toBeDefined();
    expect(insertHistorico.params[0]).toBe("38"); // tarefa_id
    expect(insertHistorico.params[2]).toBe("abandonou"); // acao
  });
});

describe("ETAPA 9 — contrato do owner (remover-responsavel / reatribuir)", () => {
  it("POST /remover-responsavel com token de não-owner → 403", async () => {
    const pool = criarPoolEtapa9({ criadorId: 1 });
    const app = buildApp(pool);
    const token = tokenPara({ id: 5, email: "outro@email.com", nome: "Outro" });

    const res = await request(app)
      .post("/projetos/1/tarefas/38/remover-responsavel")
      .set("Authorization", `Bearer ${token}`);

    // somenteDonoDoProjeto: criador_id (1) !== usuarioAutenticado.id (5) → 403
    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe(
      "Acesso negado: Apenas o proprietário do projeto pode realizar esta ação"
    );
    // Contrato: nenhum write deve ter sido emitido
    expect(buscarChamada(pool, /insert into historico_responsaveis_tarefa/)).toBeFalsy();
  });

  it("POST /reatribuir com token de owner → 200 (valida membro ativo) + INSERT histórico", async () => {
    const pool = criarPoolEtapa9({ criadorId: 1, novoResponsavelId: 9, membroAtivo: true });
    const app = buildApp(pool);
    const token = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });

    const res = await request(app)
      .post("/projetos/1/tarefas/38/reatribuir")
      .set("Authorization", `Bearer ${token}`)
      .send({ usuario_id: 9 });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.responsavel_id).toBe(9);

    // Contrato: valida membro ATIVO antes de reatribuir (usuario_id = 9)
    const selectMembroAtivo = buscarChamada(
      pool,
      /select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo'/
    );
    expect(selectMembroAtivo).toBeDefined();
    expect(selectMembroAtivo.params[1]).toBe(9);

    // UPDATE responsavel_id = novo responsável
    const updateReatribuir = buscarChamada(pool, /^update tarefas set responsavel_id = \?/);
    expect(updateReatribuir).toBeDefined();
    expect(updateReatribuir.params[0]).toBe(9);

    // Histórico registrado com acao = 'reatribuido'
    const insertHistorico = buscarChamada(pool, /insert into historico_responsaveis_tarefa/);
    expect(insertHistorico).toBeDefined();
    expect(insertHistorico.params[0]).toBe("38"); // tarefa_id
    expect(insertHistorico.params[1]).toBe(9); // usuario_id = novo responsável
    expect(insertHistorico.params[2]).toBe("reatribuido"); // acao
  });
});