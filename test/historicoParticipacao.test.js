// test/historicoParticipacao.test.js — ETAPA 10 (histórico permanente de participação)
//
// Cobertura funcional da ETAPA 10:
//   - DELETE /projetos/:projetoId/tarefas/:tarefaId (somenteDonoDoProjeto):
//     apagar tarefa vira SOFT-DELETE — UPDATE tarefas SET excluida_em = NOW(),
//     NUNCA 'DELETE FROM tarefas' (histórico de participação permanece). A
//     coluna excluida_em foi criada pela migration scripts/migrar_evolucao_etapa10.js.
//   - GET /projetos/:projetoId/tarefas: listarTarefas filtra tarefas arquivadas
//     (excluida_em IS NULL) — somem do Kanban sem perder o histórico.
//   - GET /usuarios/:id/reputacao: histórico de participação continua visível
//     mesmo quando o vínculo é 'saiu'/'removido' (a query NÃO filtra status='ativo').
//   - Autorização: sem token → 401 em todos os endpoints.
//
// Dono do projeto 1 = usuário 1 (criador_id 1). Membro comum = usuário 2.

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

const OWNER = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });
const MEMBRO = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });

// Pool do fluxo de apagar tarefa (somenteDonoDoProjeto + UPDATE soft-delete).
function criarPoolApagarTarefa({ afetadas = 1 } = {}) {
  return criarPoolFake([
    // somenteDonoDoProjeto — dono do projeto 1
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: 1 }], []],
    },
    // apagarTarefa — CONTRATO ETAPA 10: soft-delete UPDATE tarefas SET excluida_em = NOW()
    {
      match: (sql) => /^update tarefas set excluida_em = now\(\) where id = \? and projeto_id = \?$/.test(sql),
      resposta: () => [{ affectedRows: afetadas }, []],
    },
  ]);
}

describe("ETAPA 10 — DELETE /projetos/:projetoId/tarefas/:tarefaId vira SOFT-DELETE", () => {
  it("apagar tarefa → 200 com UPDATE excluida_em = NOW() (NUNCA DELETE físico)", async () => {
    const pool = criarPoolApagarTarefa();
    const app = buildApp(pool);

    const res = await request(app)
      .delete("/projetos/1/tarefas/38")
      .set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toBeNull();

    // CONTRATO ETAPA 10: NÃO existe DELETE físico de tarefas — evidência permanece
    const deleteFisico = buscarChamada(pool, /^delete from tarefas/);
    expect(deleteFisico).toBeFalsy();

    // CONTRATO ETAPA 10: a chamada é UPDATE tarefas SET excluida_em = NOW()
    const updateSoftDelete = buscarChamada(pool, /^update tarefas set excluida_em/);
    expect(updateSoftDelete).toBeTruthy();
    expect(updateSoftDelete.params[0]).toBe("38"); // tarefaId
    expect(updateSoftDelete.params[1]).toBe("1"); // projetoId
    expect(updateSoftDelete.sql).toContain("excluida_em = now()");
  });

  it("apagar tarefa inexistente → 404", async () => {
    const pool = criarPoolApagarTarefa({ afetadas: 0 });
    const app = buildApp(pool);

    const res = await request(app)
      .delete("/projetos/1/tarefas/999")
      .set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(404);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Tarefa não encontrada");
  });

  it("sem token → 401", async () => {
    const app = buildApp(criarPoolFake([]));
    const res = await request(app).delete("/projetos/1/tarefas/38");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token não informado");
  });
});

describe("ETAPA 10 — GET /projetos/:projetoId/tarefas filtra excluídas", () => {
  it("→ 200 e a query filtra excluida_em IS NULL (arquivadas somem do Kanban)", async () => {
    const pool = criarPoolFake([
      // somenteMembroOuDonoDoProjeto — dono do projeto 1 passa direto
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[{ criador_id: 1 }], []],
      },
      // listarTarefas — SELECT principal (a query DEVE conter o filtro)
      {
        match: (sql) =>
          /^select t\.\*, u\.nome as responsavel_nome from tarefas t left join usuarios u on t\.responsavel_id = u\.id where t\.projeto_id = \?/.test(
            sql
          ),
        resposta: () => [
          [{ id: 38, projeto_id: 1, titulo: "Task viva", status: "todo", responsavel_id: null }],
          [],
        ],
      },
      // subtarefas
      {
        match: (sql) => /^select id, titulo, concluida as done from subtarefas where tarefa_id = \?$/.test(sql),
        resposta: () => [[], []],
      },
      // habilidades (ETAPA 7)
      {
        match: (sql) => /^select ht\.tarefa_id, h\.nome from habilidades_tarefa ht/.test(sql),
        resposta: () => [[], []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .get("/projetos/1/tarefas")
      .set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados[0].titulo).toBe("Task viva");

    // CONTRATO ETAPA 10: o SELECT de tarefas filtra as arquivadas
    const selectTarefas = buscarChamada(
      pool,
      /select t\.\*, u\.nome as responsavel_nome from tarefas t left join usuarios u/
    );
    expect(selectTarefas).toBeDefined();
    expect(selectTarefas.params[0]).toBe("1"); // projetoId
    expect(selectTarefas.sql).toContain("excluida_em is null");
  });

  it("sem token → 401", async () => {
    const app = buildApp(criarPoolFake([]));
    const res = await request(app).get("/projetos/1/tarefas");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token não informado");
  });
});

describe("ETAPA 10 — GET /usuarios/:id/reputacao mostra histórico mesmo saindo/removido", () => {
  it("→ 200 e o histórico inclui vínculos 'ativo', 'saiu' e 'removido' (sem filtrar status='ativo')", async () => {
    const pool = criarPoolFake([
      // 1. usuário existe
      {
        match: (sql) => /^select id, nome from usuarios where id = \? limit 1$/.test(sql),
        resposta: () => [[{ id: 2, nome: "Lucas" }], []],
      },
      // 2. estatísticas — sem linha → defaults
      {
        match: (sql) => /^select nivel, xp, xp_para_proximo, projetos_concluidos from estatisticas_usuario where usuario_id = \? limit 1$/.test(sql),
        resposta: () => [[], []],
      },
      // 3. avaliações (rating)
      {
        match: (sql) => /^select avg\(nota\) as media, count\(\*\) as total from avaliacoes where avaliado_id = \?$/.test(sql),
        resposta: () => [[{ media: 4, total: 1 }], []],
      },
      // 4. conquistas
      {
        match: (sql) => /^select c\.id, c\.titulo, c\.icone, c\.descricao from conquistas_usuario cu join conquistas c on c\.id = cu\.conquista_id where cu\.usuario_id = \? order by cu\.conquistado_em desc$/.test(sql),
        resposta: () => [[], []],
      },
      // 5. reviews recebidas
      {
        match: (sql) => /^select a\.id, u\.nome as author, p\.titulo as projectname, a\.nota, a\.comentario, a\.criado_em from avaliacoes a join usuarios u on u\.id = a\.avaliador_id left join projetos p on p\.id = a\.projeto_id where a\.avaliado_id = \? order by a\.criado_em desc$/.test(sql),
        resposta: () => [[], []],
      },
      // 6. histórico de projetos (membros_equipe) — ETAPA 10: NÃO filtra status='ativo'
      {
        match: (sql) =>
          /^select p\.id as projeto_id, p\.titulo, p\.status, p\.criador_id, me\.funcao, me\.entrou_em, me\.status as membro_status from membros_equipe me join projetos p on p\.id = me\.projeto_id where me\.usuario_id = \? order by me\.entrou_em desc$/.test(
            sql
          ),
        resposta: () => [
          [
            { projeto_id: 10, titulo: "Projeto Atual", status: "em_andamento", criador_id: 9, funcao: "Backend", entrou_em: "2026-02-01T00:00:00.000Z", membro_status: "ativo" },
            { projeto_id: 11, titulo: "Projeto Antigo", status: "finalizado", criador_id: 9, funcao: "Frontend", entrou_em: "2025-11-01T00:00:00.000Z", membro_status: "saiu" },
            { projeto_id: 12, titulo: "Projeto Removido", status: "finalizado", criador_id: 9, funcao: "QA", entrou_em: "2025-08-01T00:00:00.000Z", membro_status: "removido" },
          ],
          [],
        ],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app)
      .get("/usuarios/2/reputacao")
      .set("Authorization", `Bearer ${MEMBRO}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);

    // Histórico de participação preserva TODOS os vínculos (ativo/saiu/removido)
    expect(res.body.dados.history).toHaveLength(3);
    expect(res.body.dados.history.map((h) => h.memberStatus)).toEqual(["ativo", "saiu", "removido"]);
    expect(res.body.dados.history[1].projectName).toBe("Projeto Antigo");
    expect(res.body.dados.history[2].projectName).toBe("Projeto Removido");

    // CONTRATO ETAPA 10: a query de histórico NÃO filtra por status='ativo'
    const hist = buscarChamada(
      pool,
      /select p\.id as projeto_id, p\.titulo, p\.status, p\.criador_id, me\.funcao, me\.entrou_em, me\.status as membro_status/
    );
    expect(hist).toBeDefined();
    expect(/status = 'ativo'/.test(hist.sql)).toBe(false);
  });

  it("sem token → 401", async () => {
    const app = buildApp(criarPoolFake([]));
    const res = await request(app).get("/usuarios/2/reputacao");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token não informado");
  });
});
