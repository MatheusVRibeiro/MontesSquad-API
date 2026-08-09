// test/historicoParticipacao.security.test.js — ETAPA 10 (histórico permanente de participação)
//
// Contract-first (skill montesquad-development, references/testes-seguranca-etapas.md):
// este arquivo codifica o CONTRATO da ETAPA 10 e roda contra o controller ATUAL
// (src/controllers/tarefas.js) + rotas atuais (src/routes/routes.js).
//
// Contrato da ETAPA 10 (fonte: delegação do agente pai — soft-delete + histórico
// permanente de participação):
//   - DELETE /projetos/:projetoId/tarefas/:tarefaId
//       (verificarToken + somenteDonoDoProjeto; rotas.js:144):
//       sem token → 401; não-dono → 403; dono → 200 E a query é
//       UPDATE tarefas SET excluida_em = NOW() (soft-delete) — NUNCA
//       'DELETE FROM tarefas' (o histórico de participação permanece).
//   - GET /projetos/:projetoId/tarefas
//       (verificarToken + somenteMembroOuDonoDoProjeto; rotas.js:138):
//       → 200 E a query filtra tarefas excluídas (excluida_em IS NULL) —
//       tarefas apagadas somem do Kanban sem perder o histórico.
//
// METODOLOGIA (regra 5 do skill — migração destrutiva DELETE → soft-delete):
// o pool mocka AMBOS os comportamentos (o DELETE físico ATUAL e o UPDATE
// soft-delete do CONTRATO) para que o status 200 fique alcançável; o veredito
// de contrato sai de pool.chamadas via buscarChamada(), não do status.
//
// HISTÓRICO HONESTO (2026-08-09, implementação da ETAPA 10 em andamento pelo
// subagente backend):
//   - O controller ATUAL ainda faz hard delete: apagarTarefa emite
//     'DELETE FROM tarefas WHERE id = ? AND projeto_id = ?'
//     (src/controllers/tarefas.js:382-385) e listarTarefas NÃO filtra
//     excluida_em (linhas 54-60). A coluna excluida_em não existe em nenhuma
//     migration/script do repositório (grep = 0 ocorrências).
//   - Consequência esperada: casos 1 (401) e 4 (403) passam; casos 2 e 3
//     falham nas asserções de CONTRATO sobre pool.chamadas (status 200 passa,
//     a query errada é pega) — a lacuna exata a implementar.

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Factory do pool da ETAPA 10 — mocka middlewares (auth.js) + SQL REAL do
// controller (regra 3 do skill): a falha honesta é mismatch de contrato,
// não crash de query não mapeada. Regra 5: DELETE físico (atual) E UPDATE
// soft-delete (contrato) ambos mapeados; UPDATE/DELETE permanecem estritos,
// SELECT com fallback genérico por último (regra 6).
function criarPoolEtapa10({ criadorId = 1 } = {}) {
  return criarPoolFake([
    // somenteDonoDoProjeto / somenteMembroOuDonoDoProjeto — dono do projeto
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: criadorId }], []],
    },
    // listarTarefas — SELECT principal (SQL real, prefixo sem $: a variante do
    // contrato adiciona 'AND t.excluida_em IS NULL' no final e deve casar)
    {
      match: (sql) =>
        /^select t\.\*, u\.nome as responsavel_nome from tarefas t left join usuarios u on t\.responsavel_id = u\.id where t\.projeto_id = \?/.test(
          sql
        ),
      resposta: () => [
        [{ id: 38, projeto_id: 1, titulo: "Task etapa 10", status: "todo", responsavel_id: null }],
        [],
      ],
    },
    // listarTarefas — subtarefas de cada tarefa
    {
      match: (sql) => /^select id, titulo, concluida as done from subtarefas where tarefa_id = \?$/.test(sql),
      resposta: () => [[], []],
    },
    // listarTarefas — habilidades (ETAPA 7, JOIN agrupado por tarefa)
    {
      match: (sql) =>
        /^select ht\.tarefa_id, h\.nome from habilidades_tarefa ht join habilidades h on h\.id = ht\.habilidade_id join tarefas t on t\.id = ht\.tarefa_id where t\.projeto_id = \? order by h\.nome$/.test(
          sql
        ),
      resposta: () => [[], []],
    },
    // apagarTarefa — CONTRATO ETAPA 10: soft-delete (UPDATE excluida_em = NOW())
    {
      match: (sql) =>
        /^update tarefas set excluida_em = now\(\) where id = \? and projeto_id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // apagarTarefa — comportamento ATUAL (pré-ETAPA 10): hard delete. Mapeado
    // para o status 200 ficar alcançável; o veredito sai das asserções abaixo.
    {
      match: (sql) => /^delete from tarefas where id = \? and projeto_id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // Fallback SELECT (regra 6) — SELECTs de checagem/resposta não crasham;
    // INSERT/UPDATE/DELETE continuam estritos (falha alta em write inesperado).
    { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
  ]);
}

describe("ETAPA 10 — autorização (sem token)", () => {
  it("DELETE /projetos/1/tarefas/38 sem token → 401", async () => {
    const app = buildApp(criarPoolEtapa10());
    const res = await request(app).delete("/projetos/1/tarefas/38");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
  });
});

describe("ETAPA 10 — contrato do soft-delete (DELETE dono)", () => {
  it("DELETE /projetos/1/tarefas/38 com token de dono → 200 E query é UPDATE excluida_em (nunca DELETE FROM tarefas)", async () => {
    const pool = criarPoolEtapa10({ criadorId: 1 });
    const app = buildApp(pool);
    const token = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });

    const res = await request(app)
      .delete("/projetos/1/tarefas/38")
      .set("Authorization", `Bearer ${token}`);

    // Status alcançável com AMBAS as variantes (regra 5)
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);

    // CONTRATO ETAPA 10: soft-delete — UPDATE tarefas SET excluida_em = NOW()
    const updateSoftDelete = buscarChamada(pool, /^update tarefas set excluida_em/);
    expect(updateSoftDelete).toBeDefined();
    expect(updateSoftDelete.params[0]).toBe("38"); // tarefaId dos params da rota
    expect(updateSoftDelete.params[1]).toBe("1"); // projetoId

    // CONTRATO: NUNCA emitir DELETE físico — histórico de participação permanece
    expect(buscarChamada(pool, /^delete from tarefas/)).toBeFalsy();
  });
});

describe("ETAPA 10 — contrato do GET (filtra excluídas)", () => {
  it("GET /projetos/1/tarefas com token → 200 E a query filtra excluida_em IS NULL", async () => {
    const pool = criarPoolEtapa10({ criadorId: 1 });
    const app = buildApp(pool);
    const token = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });

    const res = await request(app)
      .get("/projetos/1/tarefas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);

    // CONTRATO ETAPA 10: o SELECT de tarefas deve filtrar excluídas
    const selectTarefas = buscarChamada(
      pool,
      /select t\.\*, u\.nome as responsavel_nome from tarefas t left join usuarios u/
    );
    expect(selectTarefas).toBeDefined();
    expect(selectTarefas.params[0]).toBe("1"); // projetoId
    expect(/excluida_em is null/.test(selectTarefas.sql)).toBe(true);
  });
});

describe("ETAPA 10 — autorização (não-dono)", () => {
  it("DELETE /projetos/1/tarefas/38 com token de não-dono → 403", async () => {
    const pool = criarPoolEtapa10({ criadorId: 1 });
    const app = buildApp(pool);
    const token = tokenPara({ id: 5, email: "outro@email.com", nome: "Outro" });

    const res = await request(app)
      .delete("/projetos/1/tarefas/38")
      .set("Authorization", `Bearer ${token}`);

    // somenteDonoDoProjeto: criador_id (1) !== usuarioAutenticado.id (5) → 403
    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe(
      "Acesso negado: Apenas o proprietário do projeto pode realizar esta ação"
    );
    // Contrato: nenhum write deve ter sido emitido
    expect(buscarChamada(pool, /^update tarefas set excluida_em/)).toBeFalsy();
    expect(buscarChamada(pool, /^delete from tarefas/)).toBeFalsy();
  });
});
