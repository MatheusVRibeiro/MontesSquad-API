import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// ── Stub do banco via Module._load (mesmo padrão dos testes anteriores) ──
const { Module, createRequire } = await import("node:module");
const { pathToFileURL } = await import("node:url");
const requireModulo = createRequire(import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Serviço recalcularReputacao — cálculo DIRETO do banco + UPSERT
// ─────────────────────────────────────────────────────────────────────────────
const queries = {
  selectTasks: vi.fn(),
  selectPrs: vi.fn(),
  selectCommits: vi.fn(),
  selectProjetos: vi.fn(),
  upsertReputacao: vi.fn(),
};

function stubarBancoServico() {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "../database/connection" || request === "./database/connection" || request.endsWith("database/connection")) {
      return {
        query: async (sql, params) => {
          const s = String(sql).toLowerCase().replace(/\s+/g, " ").trim();
          if (s.startsWith("select count(*) as total from tarefas where responsavel_id = ? and concluida_via = 'github_merge'")) {
            return queries.selectTasks(params);
          }
          if (s.startsWith("select count(*) as total from github_pull_requests pr join tarefas t")) {
            return queries.selectPrs(params);
          }
          if (s.startsWith("select count(*) as total from github_commits gc join usuarios u")) {
            return queries.selectCommits(params);
          }
          if (s.startsWith("select count(distinct projeto_id) as total from tarefas")) {
            return queries.selectProjetos(params);
          }
          if (s.startsWith("insert into reputacao_tecnica_usuario")) {
            return queries.upsertReputacao(params, s);
          }
          throw new Error(`Query não mapeada no mock (reputacaoTecnica): ${sql}`);
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };
  return () => { Module._load = originalLoad; };
}

function carregarServico() {
  const caminho = pathToFileURL(requireModulo.resolve("../src/services/reputacaoTecnica.js")).href;
  return import(`${caminho}?etapa12=${Date.now()}`);
}

describe("Serviço recalcularReputacao (ETAPA 12)", () => {
  let servico;
  let restauraStub;

  beforeEach(async () => {
    vi.clearAllMocks();
    restauraStub = stubarBancoServico();
    servico = await carregarServico();

    queries.selectTasks.mockResolvedValue([[{ total: 2 }], []]);
    queries.selectPrs.mockResolvedValue([[{ total: 3 }], []]);
    queries.selectCommits.mockResolvedValue([[{ total: 10 }], []]);
    queries.selectProjetos.mockResolvedValue([[{ total: 1 }], []]);
    queries.upsertReputacao.mockResolvedValue([{ affectedRows: 1 }, []]);
  });

  afterEach(() => {
    if (restauraStub) restauraStub();
  });

  it("calcula do banco com a fórmula ponderada documentada (2*50 + 3*30 + 10*1 + 1*20 = 220)", async () => {
    const res = await servico.recalcularReputacao(2);
    expect(res).toMatchObject({
      usuarioId: 2,
      tasksVerificadas: 2,
      prsMergeados: 3,
      commitsValidos: 10,
      projetosComEntrega: 1,
      score: 220,
    });
    // UPSERT com todos os contadores + score
    expect(queries.upsertReputacao).toHaveBeenCalledTimes(1);
    const params = queries.upsertReputacao.mock.calls[0][0];
    expect(params).toEqual([2, 220, 2, 3, 10, 1]);
    // SQL usa ON DUPLICATE KEY UPDATE (não INSERT puro)
    const sql = queries.upsertReputacao.mock.calls[0][1];
    expect(sql).toContain("on duplicate key update");
  });

  it("sem evidências → score 0 e linha com zeros", async () => {
    queries.selectTasks.mockResolvedValue([[{ total: 0 }], []]);
    queries.selectPrs.mockResolvedValue([[{ total: 0 }], []]);
    queries.selectCommits.mockResolvedValue([[{ total: 0 }], []]);
    queries.selectProjetos.mockResolvedValue([[{ total: 0 }], []]);
    const res = await servico.recalcularReputacao(7);
    expect(res.score).toBe(0);
    expect(queries.upsertReputacao.mock.calls[0][0]).toEqual([7, 0, 0, 0, 0, 0]);
  });

  it("aceita conn explícito (transação/pool fake) em vez do db global", async () => {
    const connFake = { query: vi.fn(async () => [[{ total: 1 }], []]) };
    await servico.recalcularReputacao(3, connFake);
    // Todas as consultas foram para o conn, não para o db global
    expect(connFake.query).toHaveBeenCalled();
    const sqls = connFake.query.mock.calls.map((c) => String(c[0]).toLowerCase());
    expect(sqls.some((s) => s.includes("insert into reputacao_tecnica_usuario"))).toBe(true);
  });

  it("valida usuarioId obrigatório", async () => {
    await expect(servico.recalcularReputacao(null)).rejects.toThrow("usuarioId");
    await expect(servico.recalcularReputacao(undefined)).rejects.toThrow("usuarioId");
    await expect(servico.recalcularReputacao(0)).rejects.toThrow("usuarioId");
  });

  it("expõe os pesos documentados da fórmula", () => {
    expect(servico.PESOS_REPUTACAO).toEqual({
      TASK_VERIFICADA: 50,
      PR_MERGEADO: 30,
      COMMIT_VALIDO: 1,
      PROJETO_COM_ENTREGA: 20,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Merge de PR recalcula a reputação (githubEvents) — service spy
// ─────────────────────────────────────────────────────────────────────────────
const mergeQueries = {
  encontrarExato: vi.fn(),
  selectTaskMerge: vi.fn(),
  updateTaskMerge: vi.fn(),
  updatePRMerged: vi.fn(),
  insertHistorico: vi.fn(),
  insertEventoXp: vi.fn(),
  upsertEstatisticas: vi.fn(),
  updateNivel: vi.fn(),
  selectEstatisticas: vi.fn(),
  insertNotificacao: vi.fn(),
};

function stubarBancoMerge() {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request.endsWith("database/connection")) {
      return {
        query: async (sql, params) => {
          const s = String(sql).toLowerCase().replace(/\s+/g, " ").trim();
          if (s.includes("from tarefas t") && s.includes("p.github_repository_id = ? and t.github_branch = ?")) {
            return mergeQueries.encontrarExato(params);
          }
          if (s.includes("select id, status, concluida_via, github_pr_id, responsavel_id from tarefas")) {
            return mergeQueries.selectTaskMerge(params);
          }
          if (s.includes("github_pr_status = 'merged'") && s.includes("concluida_via = 'github_merge'")) {
            return mergeQueries.updateTaskMerge(params);
          }
          if (s.startsWith("update github_pull_requests") && s.includes("estado = 'merged'")) {
            return mergeQueries.updatePRMerged(params);
          }
          if (s.startsWith("insert into github_pull_requests")) {
            return [{ affectedRows: 1 }, []];
          }
          if (s.includes("github_pr_status = 'closed'") && s.includes("status = 'doing'")) {
            return [{ affectedRows: 1 }, []];
          }
          if (s.startsWith("insert into historico_responsaveis_tarefa")) {
            return mergeQueries.insertHistorico(params);
          }
          if (s.startsWith("insert ignore into eventos_xp")) {
            return mergeQueries.insertEventoXp(params);
          }
          if (s.startsWith("insert into estatisticas_usuario (usuario_id, xp, nivel)")) {
            return mergeQueries.upsertEstatisticas(params);
          }
          if (s.startsWith("update estatisticas_usuario set nivel = floor(xp / 250) + 1")) {
            return mergeQueries.updateNivel(params);
          }
          if (s.includes("select xp, nivel from estatisticas_usuario")) {
            return mergeQueries.selectEstatisticas(params);
          }
          if (s.startsWith("insert into notificacoes")) {
            return mergeQueries.insertNotificacao(params);
          }
          if (s.includes("select id, usuario_id, tipo, titulo, descricao, lida, link, criado_em from notificacoes")) {
            return [[{ id: 9, usuario_id: 2, tipo: "task", titulo: "Tarefa concluída via GitHub", lida: 0 }], []];
          }
          throw new Error(`Query não mapeada no mock (merge): ${sql}`);
        },
      };
    }
    if (request.endsWith("reputacaoTecnica")) {
      return { recalcularReputacao: spyRecalcular };
    }
    return originalLoad.apply(this, arguments);
  };
  return () => { Module._load = originalLoad; };
}

function carregarGithubEvents() {
  const caminho = pathToFileURL(requireModulo.resolve("../src/services/githubEvents.js")).href;
  return import(`${caminho}?etapa12-merge=${Date.now()}`);
}

function payloadMerge({ merged = true, prId = 500, number = 52 } = {}) {
  return {
    action: "closed",
    repository: { id: 100 },
    pull_request: {
      id: prId,
      number,
      html_url: "https://github.com/empresa/repo/pull/52",
      head: { ref: "task/38-criar-api-de-login" },
      merged,
      merged_at: merged ? "2026-08-08T13:00:00Z" : null,
    },
  };
}

const spyRecalcular = vi.fn();

describe("Merge de PR recalcula reputação técnica (ETAPA 12)", () => {
  let githubEvents;
  let restauraStub;

  beforeEach(async () => {
    vi.clearAllMocks();
    restauraStub = stubarBancoMerge();
    githubEvents = await carregarGithubEvents();

    mergeQueries.encontrarExato.mockResolvedValue([[{ id: 38, projeto_id: 1, titulo: "Criar API", status: "doing", responsavel_id: 2 }], []]);
    mergeQueries.selectTaskMerge.mockResolvedValue([[{ id: 38, status: "review", concluida_via: null, github_pr_id: null, responsavel_id: 2 }], []]);
    mergeQueries.updateTaskMerge.mockResolvedValue([{ affectedRows: 1 }, []]);
    mergeQueries.updatePRMerged.mockResolvedValue([{ affectedRows: 1 }, []]);
    mergeQueries.insertHistorico.mockResolvedValue([{ affectedRows: 1 }, []]);
    mergeQueries.insertEventoXp.mockResolvedValue([{ affectedRows: 1 }, []]);
    mergeQueries.upsertEstatisticas.mockResolvedValue([{ affectedRows: 1 }, []]);
    mergeQueries.updateNivel.mockResolvedValue([{ affectedRows: 1 }, []]);
    mergeQueries.selectEstatisticas.mockResolvedValue([[{ xp: 150, nivel: 1 }], []]);
    mergeQueries.insertNotificacao.mockResolvedValue([{ insertId: 9, affectedRows: 1 }, []]);
    spyRecalcular.mockResolvedValue({ usuarioId: 2, score: 50 });
  });

  afterEach(() => {
    if (restauraStub) restauraStub();
  });

  it("merge conclui a task → recalcula reputação do responsável", async () => {
    const res = await githubEvents.processarPullRequest(payloadMerge(), { deliveryId: "m1" });
    expect(res.motivo).toBe("pr_merge_concluiu");
    expect(spyRecalcular).toHaveBeenCalledTimes(1);
    expect(spyRecalcular).toHaveBeenCalledWith(2);
  });

  it("delivery repetido (jaConcluida) → NÃO recalcula de novo", async () => {
    mergeQueries.selectTaskMerge.mockResolvedValue([[{ id: 38, status: "done", concluida_via: "github_merge", github_pr_id: 500, responsavel_id: 2 }], []]);
    const res = await githubEvents.processarPullRequest(payloadMerge({ prId: 500 }), { deliveryId: "m2" });
    expect(res.motivo).toBe("pr_merge_ja_concluido");
    expect(spyRecalcular).not.toHaveBeenCalled();
  });

  it("PR fechado sem merge → NÃO recalcula (sem entrega verificada)", async () => {
    const res = await githubEvents.processarPullRequest(payloadMerge({ merged: false }), { deliveryId: "m3" });
    expect(res.motivo).toBe("pr_closed_sem_merge");
    expect(spyRecalcular).not.toHaveBeenCalled();
  });

  it("task sem responsável → merge processa sem recalcular", async () => {
    mergeQueries.encontrarExato.mockResolvedValue([[{ id: 38, projeto_id: 1, titulo: "Criar API", status: "doing", responsavel_id: null }], []]);
    mergeQueries.selectTaskMerge.mockResolvedValue([[{ id: 38, status: "review", concluida_via: null, github_pr_id: null, responsavel_id: null }], []]);
    const res = await githubEvents.processarPullRequest(payloadMerge(), { deliveryId: "m4" });
    expect(res.motivo).toBe("pr_merge_concluiu");
    expect(spyRecalcular).not.toHaveBeenCalled();
  });

  it("falha no recalcular NÃO derruba o processamento do merge (best-effort)", async () => {
    spyRecalcular.mockRejectedValue(new Error("banco fora"));
    const res = await githubEvents.processarPullRequest(payloadMerge(), { deliveryId: "m5" });
    expect(res.processado).toBe(true);
    expect(res.motivo).toBe("pr_merge_concluiu");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Conclusão manual recalcula a reputação (tarefas.js) — app real + pool fake
// ─────────────────────────────────────────────────────────────────────────────
function poolConclusaoManual() {
  return criarPoolFake([
    // XP (ETAPA 10) — concedido na conclusão manual
    { match: (sql) => sql.startsWith("insert ignore into eventos_xp"), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => sql.startsWith("insert into estatisticas_usuario (usuario_id, xp, nivel)"), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => sql.startsWith("update estatisticas_usuario set nivel = floor(xp / 250) + 1"), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => sql.includes("select xp, nivel from estatisticas_usuario"), resposta: () => [[{ xp: 100, nivel: 1 }], []] },
    // Reputação técnica (ETAPA 12) — recálculo do banco
    { match: (sql) => sql.startsWith("select count(*) as total from tarefas where responsavel_id = ? and concluida_via = 'github_merge'"), resposta: () => [[{ total: 1 }], []] },
    { match: (sql) => sql.startsWith("select count(*) as total from github_pull_requests pr join tarefas t"), resposta: () => [[{ total: 0 }], []] },
    { match: (sql) => sql.startsWith("select count(*) as total from github_commits gc join usuarios u"), resposta: () => [[{ total: 0 }], []] },
    { match: (sql) => sql.startsWith("select count(distinct projeto_id) as total from tarefas"), resposta: () => [[{ total: 1 }], []] },
    { match: (sql) => sql.startsWith("insert into reputacao_tecnica_usuario"), resposta: () => [{ affectedRows: 1 }, []] },
    // Histórico de responsáveis (ETAPA 9)
    { match: (sql) => sql.startsWith("insert into historico_responsaveis_tarefa"), resposta: () => [{ affectedRows: 1 }, []] },
    // Fluxo do controller atualizarTarefa
    { match: (sql) => /^update tarefas set status = \? where id = \? and projeto_id = \?$/.test(sql), resposta: () => [{ affectedRows: 1 }, []] },
    { match: (sql) => /^select status, responsavel_id from tarefas where id = \? and projeto_id = \? limit 1$/.test(sql), resposta: () => [[{ status: "done", responsavel_id: 2 }], []] },
    { match: (sql) => /^select \* from tarefas where id = \? and projeto_id = \? limit 1$/.test(sql), resposta: () => [[{ id: 5, projeto_id: 1, responsavel_id: 2, titulo: "Tarefa", status: "done", prioridade: "medium", dificuldade: "intermediaria" }], []] },
    { match: (sql) => sql.startsWith("select id, titulo, concluida as done from subtarefas"), resposta: () => [[], []] },
    { match: (sql) => sql.startsWith("select h.nome from habilidades_tarefa ht"), resposta: () => [[], []] },
  ]);
}

describe("Conclusão manual recalcula reputação técnica (ETAPA 12)", () => {
  it("PATCH tarefa → done dispara recálculo com o responsável (ao lado do XP)", async () => {
    const pool = poolConclusaoManual();
    const app = buildApp(pool);
    const token = tokenPara({ id: 2, tipo: "adm" }); // adm passa pelo middleware sem queries extras

    const res = await request(app)
      .patch("/projetos/1/tarefas/5")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "done" });

    expect(res.status).toBe(200);
    // UPSERT em reputacao_tecnica_usuario ocorreu com usuario_id do responsável
    const chamada = buscarChamada(pool, /insert into reputacao_tecnica_usuario/);
    expect(chamada).toBeTruthy();
    expect(chamada.params[0]).toBe(2);
    // score = 1 task verificada * 50 + 1 projeto * 20 = 70
    expect(chamada.params[1]).toBe(70);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Endpoint GET /usuarios/:id/reputacao-tecnica
// ─────────────────────────────────────────────────────────────────────────────
function poolEndpointReputacaoTecnica({ semLinha = false, usuarioExiste = true } = {}) {
  return criarPoolFake([
    {
      match: (sql) => /^select id from usuarios where id = \? limit 1$/.test(sql),
      resposta: () => (usuarioExiste ? [[{ id: 2 }], []] : [[], []]),
    },
    {
      match: (sql) => sql.startsWith("select score, tasks_verificadas, prs_mergeados, commits_validos, projetos_com_entrega, atualizado_em from reputacao_tecnica_usuario"),
      resposta: () =>
        semLinha
          ? [[], []]
          : [[{ score: 220, tasks_verificadas: 2, prs_mergeados: 3, commits_validos: 10, projetos_com_entrega: 1, atualizado_em: "2026-08-09T00:00:00.000Z" }], []],
    },
  ]);
}

describe("Endpoint GET /usuarios/:id/reputacao-tecnica (ETAPA 12)", () => {
  it("→ 200 com o shape {score, tasks_verificadas, prs_mergeados, commits_validos, projetos_com_entrega}", async () => {
    const app = buildApp(poolEndpointReputacaoTecnica());
    const token = tokenPara({ id: 2 });

    const res = await request(app)
      .get("/usuarios/2/reputacao-tecnica")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toEqual({
      score: 220,
      tasks_verificadas: 2,
      prs_mergeados: 3,
      commits_validos: 10,
      projetos_com_entrega: 1,
      atualizado_em: "2026-08-09T00:00:00.000Z",
    });
  });

  it("sem linha na tabela → 200 com defaults zerados", async () => {
    const app = buildApp(poolEndpointReputacaoTecnica({ semLinha: true }));
    const token = tokenPara({ id: 2 });

    const res = await request(app)
      .get("/usuarios/2/reputacao-tecnica")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.dados.score).toBe(0);
    expect(res.body.dados.tasks_verificadas).toBe(0);
    expect(res.body.dados.prs_mergeados).toBe(0);
    expect(res.body.dados.commits_validos).toBe(0);
    expect(res.body.dados.projetos_com_entrega).toBe(0);
  });

  it("alias 'me' → reputação do usuário autenticado", async () => {
    const app = buildApp(poolEndpointReputacaoTecnica());
    const token = tokenPara({ id: 2 });

    const res = await request(app)
      .get("/usuarios/me/reputacao-tecnica")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.dados.score).toBe(220);
  });

  it("usuário inexistente → 404", async () => {
    const app = buildApp(poolEndpointReputacaoTecnica({ usuarioExiste: false }));
    const token = tokenPara({ id: 2 });

    const res = await request(app)
      .get("/usuarios/999/reputacao-tecnica")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("sem token → 401 (endpoint privado)", async () => {
    const app = buildApp(poolEndpointReputacaoTecnica());
    const res = await request(app).get("/usuarios/2/reputacao-tecnica");
    expect(res.status).toBe(401);
  });
});
