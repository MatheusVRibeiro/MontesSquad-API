import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Stub do banco via Module._load (mesmo padrão dos testes anteriores) ──
const { Module, createRequire } = await import("node:module");
const { pathToFileURL } = await import("node:url");
const requireModulo = createRequire(import.meta.url);

const queries = {
  encontrarExato: vi.fn(),
  encontrarPorId: vi.fn(),
  insertCommit: vi.fn(),
  updateAtividade: vi.fn(),
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
          if (s.startsWith("insert ignore into github_commits")) {
            return queries.insertCommit(params);
          }
          if (s.startsWith("update tarefas set github_last_activity_at")) {
            return queries.updateAtividade(params);
          }
          throw new Error(`Query não mapeada no mock: ${sql}`);
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };
  return () => { Module._load = originalLoad; };
}

function carregarGithubEvents() {
  const caminho = pathToFileURL(requireModulo.resolve("../src/services/githubEvents.js")).href;
  return import(`${caminho}?etapa8=${Date.now()}`);
}

function payloadPush({ ref = "refs/heads/task/38-criar-api-de-login", repositoryId = 100, commits = [] } = {}) {
  return {
    ref,
    repository: { id: repositoryId, full_name: "empresa/repo" },
    commits,
  };
}

function commitFake(sha, msg = "feat: x") {
  return {
    id: sha,
    message: msg,
    author: { name: "Matheus", username: "MatheusVRibeiro", email: "m@x.com" },
    timestamp: "2026-08-08T12:00:00Z",
    url: `https://github.com/empresa/repo/commit/${sha}`,
  };
}

describe("processarPush (ETAPA 8)", () => {
  let githubEvents;

  beforeEach(async () => {
    vi.clearAllMocks();
    stubarBanco();
    githubEvents = await carregarGithubEvents();

    queries.encontrarExato.mockResolvedValue([[{ id: 38, projeto_id: 1, titulo: "Criar API", status: "doing" }], []]);
    queries.insertCommit.mockResolvedValue([{ affectedRows: 1 }, []]);
    queries.updateAtividade.mockResolvedValue([{ affectedRows: 1 }, []]);
  });

  it("branch conhecida → commit salvo e atividade atualizada", async () => {
    const res = await githubEvents.processarPush(
      payloadPush({ commits: [commitFake("abc123"), commitFake("def456")] }),
      { deliveryId: "d1" }
    );
    expect(res.processado).toBe(true);
    expect(res.motivo).toBe("commits_salvos");
    expect(res.commitsSalvos).toBe(2);
    expect(queries.insertCommit).toHaveBeenCalledTimes(2);
    expect(queries.updateAtividade).toHaveBeenCalled();
  });

  it("commit repetido (INSERT IGNORE afeta 0) → não duplica, conta 0 salvos", async () => {
    queries.insertCommit.mockResolvedValue([{ affectedRows: 0 }, []]);
    const res = await githubEvents.processarPush(
      payloadPush({ commits: [commitFake("abc123")] }),
      { deliveryId: "d2" }
    );
    expect(res.processado).toBe(true);
    expect(res.commitsSalvos).toBe(0);
    expect(queries.updateAtividade).not.toHaveBeenCalled();
  });

  it("branch desconhecida → delivery processado sem task alterada", async () => {
    queries.encontrarExato.mockResolvedValue([[], []]);
    queries.encontrarPorId.mockResolvedValue([[], []]);
    const res = await githubEvents.processarPush(
      payloadPush({ ref: "refs/heads/main", commits: [commitFake("x1")] }),
      { deliveryId: "d3" }
    );
    expect(res.processado).toBe(true);
    expect(res.motivo).toBe("branch_desconhecida");
    expect(queries.insertCommit).not.toHaveBeenCalled();
    expect(queries.updateAtividade).not.toHaveBeenCalled();
  });

  it("push sem repo/branch → motivo push_sem_repo_ou_branch", async () => {
    const res = await githubEvents.processarPush({ ref: null, repository: null }, { deliveryId: "d4" });
    expect(res.motivo).toBe("push_sem_repo_ou_branch");
  });

  it("commit NÃO conclui task (sem UPDATE de status/completion)", async () => {
    await githubEvents.processarPush(payloadPush({ commits: [commitFake("abc")] }), { deliveryId: "d5" });
    const chamadas = queries.updateAtividade.mock.calls;
    const sqls = chamadas.map((c) => String(c[0]).toLowerCase());
    expect(sqls.every((s) => !s.includes("completion_source") && !s.includes("completed_at") && !s.includes("status = 'done'"))).toBe(true);
  });
});