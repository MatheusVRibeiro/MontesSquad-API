import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Stub do banco via Module._load (mesmo padrão dos testes anteriores) ──
const { Module, createRequire } = await import("node:module");
const { pathToFileURL } = await import("node:url");
const requireModulo = createRequire(import.meta.url);

const queries = {
  encontrarExato: vi.fn(),
  encontrarPorId: vi.fn(),
  upsertPR: vi.fn(),
  updateTaskPR: vi.fn(),
  updateAtividade: vi.fn(),
  selectTaskMerge: vi.fn(),
  updateTaskMerge: vi.fn(),
  updateClosedSemMerge: vi.fn(),
  insertNotificacao: vi.fn(),
  selectNotificacao: vi.fn(),
};

function stubarBanco() {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "../database/connection" || request === "./database/connection" || request.endsWith("database/connection")) {
      return {
        query: async (sql, params) => {
          const s = String(sql).toLowerCase().replace(/\s+/g, " ").trim();
          if (s.includes("github_branch") && s.includes("from tarefas t") && s.includes("p.github_repository_id = ? and t.github_branch = ?")) {
            return queries.encontrarExato(params);
          }
          if (s.includes("from tarefas t") && s.includes("p.github_repository_id = ? and t.id = ?")) {
            return queries.encontrarPorId(params);
          }
          if (s.startsWith("insert into github_pull_requests")) {
            return queries.upsertPR(params);
          }
          if (s.startsWith("update tarefas set github_pr_id = ?") && s.includes("status = 'review'")) {
            return queries.updateTaskPR(params);
          }
          if (s.startsWith("update tarefas set github_last_activity_at")) {
            return queries.updateAtividade(params);
          }
          if (s.includes("select id, status, completion_source, github_pr_id from tarefas")) {
            return queries.selectTaskMerge(params);
          }
          if (s.includes("github_pr_status = 'merged'") && s.includes("completion_source = 'github_merge'")) {
            return queries.updateTaskMerge(params);
          }
          if (s.includes("github_pr_status = 'closed'") && s.includes("status = 'doing'")) {
            return queries.updateClosedSemMerge(params);
          }
          if (s.startsWith("insert into notificacoes")) {
            return queries.insertNotificacao(params);
          }
          if (s.includes("select id, usuario_id, tipo, titulo, descricao, lida, link, criado_em from notificacoes")) {
            return queries.selectNotificacao(params);
          }
          throw new Error(`Query não mapeada no mock (ETAPA 9): ${sql}`);
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };
  return () => { Module._load = originalLoad; };
}

function carregarGithubEvents() {
  const caminho = pathToFileURL(requireModulo.resolve("../src/services/githubEvents.js")).href;
  return import(`${caminho}?etapa9=${Date.now()}`);
}

function payloadPR({ action = "opened", merged = false, mergedAt = null, branch = "task/38-criar-api-de-login", prId = 500, number = 52 } = {}) {
  return {
    action,
    repository: { id: 100, full_name: "empresa/repo" },
    pull_request: {
      id: prId,
      number,
      html_url: `https://github.com/empresa/repo/pull/${number}`,
      head: { ref: branch },
      merged,
      merged_at: mergedAt,
    },
  };
}

const TASK = { id: 38, projeto_id: 1, titulo: "Criar API", status: "doing", responsavel_id: 2 };

describe("processarPullRequest (ETAPA 9)", () => {
  let githubEvents;

  beforeEach(async () => {
    vi.clearAllMocks();
    stubarBanco();
    githubEvents = await carregarGithubEvents();

    queries.encontrarExato.mockResolvedValue([[TASK], []]);
    queries.upsertPR.mockResolvedValue([{ affectedRows: 1 }, []]);
    queries.updateTaskPR.mockResolvedValue([{ affectedRows: 1 }, []]);
    queries.updateAtividade.mockResolvedValue([{ affectedRows: 1 }, []]);
    queries.selectTaskMerge.mockResolvedValue([[{ id: 38, status: "review", completion_source: null, github_pr_id: null }], []]);
    queries.updateTaskMerge.mockResolvedValue([{ affectedRows: 1 }, []]);
    queries.updateClosedSemMerge.mockResolvedValue([{ affectedRows: 1 }, []]);
    queries.insertNotificacao.mockResolvedValue([{ insertId: 9, affectedRows: 1 }, []]);
    queries.selectNotificacao.mockResolvedValue([[{ id: 9, usuario_id: 2, tipo: "task", titulo: "Tarefa concluída via GitHub", descricao: "PR #52 foi mergeado — tarefa concluída", lida: 0, link: "/projetos/1", criado_em: "2026-01-01T00:00:00.000Z" }], []]);
  });

  it("opened → task vai para review + PR registrado", async () => {
    const res = await githubEvents.processarPullRequest(payloadPR({ action: "opened" }), { deliveryId: "d1" });
    expect(res.processado).toBe(true);
    expect(res.motivo).toBe("pr_aberto");
    expect(queries.updateTaskPR).toHaveBeenCalled();
    const params = queries.updateTaskPR.mock.calls[0][0];
    expect(params[3]).toBe("open"); // github_pr_status
    expect(params[4]).toBe(38); // task id
  });

  it("reopened → review", async () => {
    const res = await githubEvents.processarPullRequest(payloadPR({ action: "reopened" }), { deliveryId: "d2" });
    expect(res.motivo).toBe("pr_aberto");
    expect(queries.updateTaskPR).toHaveBeenCalled();
  });

  it("synchronize → continua review (não muda estado)", async () => {
    const res = await githubEvents.processarPullRequest(payloadPR({ action: "synchronize" }), { deliveryId: "d3" });
    expect(res.motivo).toBe("pr_sincronizado");
    expect(queries.updateTaskPR).not.toHaveBeenCalled();
    expect(queries.updateAtividade).toHaveBeenCalled();
  });

  it("closed sem merge → doing", async () => {
    const res = await githubEvents.processarPullRequest(payloadPR({ action: "closed", merged: false }), { deliveryId: "d4" });
    expect(res.motivo).toBe("pr_closed_sem_merge");
    expect(queries.updateClosedSemMerge).toHaveBeenCalled();
    expect(queries.updateTaskMerge).not.toHaveBeenCalled();
  });

  it("closed com merged=true → done (github_merge) + notificação", async () => {
    const res = await githubEvents.processarPullRequest(
      payloadPR({ action: "closed", merged: true, mergedAt: "2026-08-08T13:00:00Z" }),
      { deliveryId: "d5" }
    );
    expect(res.motivo).toBe("pr_merge_concluiu");
    expect(queries.updateTaskMerge).toHaveBeenCalled();
    expect(queries.insertNotificacao).toHaveBeenCalled();
  });

  it("delivery repetido (task já done pelo mesmo PR) → sem efeitos (jaConcluida)", async () => {
    queries.selectTaskMerge.mockResolvedValue([[{ id: 38, status: "done", completion_source: "github_merge", github_pr_id: 500 }], []]);
    const res = await githubEvents.processarPullRequest(
      payloadPR({ action: "closed", merged: true, prId: 500 }),
      { deliveryId: "d6" }
    );
    expect(res.motivo).toBe("pr_merge_ja_concluido");
    expect(queries.updateTaskMerge).not.toHaveBeenCalled();
    expect(queries.insertNotificacao).not.toHaveBeenCalled();
  });

  it("branch desconhecida → processado sem task alterada", async () => {
    queries.encontrarExato.mockResolvedValue([[], []]);
    queries.encontrarPorId.mockResolvedValue([[], []]);
    const res = await githubEvents.processarPullRequest(
      payloadPR({ action: "opened", branch: "feature/outra" }),
      { deliveryId: "d7" }
    );
    expect(res.motivo).toBe("pr_branch_desconhecida");
    expect(queries.updateTaskPR).not.toHaveBeenCalled();
  });
});