import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Stub do banco via Module._load ──
const { Module, createRequire } = await import("node:module");
const { pathToFileURL } = await import("node:url");
const requireModulo = createRequire(import.meta.url);

const queries = {
  insertEventoXp: vi.fn(),
  selectEstatisticas: vi.fn(),
  upsertEstatisticas: vi.fn(),
  updateNivel: vi.fn(),
};

function stubarBanco() {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "../database/connection" || request === "./database/connection" || request.endsWith("database/connection")) {
      return {
        query: async (sql, params) => {
          const s = String(sql).toLowerCase().replace(/\s+/g, " ").trim();
          if (s.startsWith("insert ignore into eventos_xp")) {
            return queries.insertEventoXp(params);
          }
          if (s.includes("select xp, nivel from estatisticas_usuario")) {
            return queries.selectEstatisticas(params);
          }
          if (s.startsWith("insert into estatisticas_usuario (usuario_id, xp, nivel)")) {
            return queries.upsertEstatisticas(params);
          }
          if (s.startsWith("update estatisticas_usuario set nivel = floor(xp / 250) + 1")) {
            return queries.updateNivel(params);
          }
          throw new Error(`Query não mapeada no mock (xp): ${sql}`);
        },
      };
    }
    return originalLoad.apply(this, arguments);
  };
  return () => { Module._load = originalLoad; };
}

function carregarXp() {
  const caminho = pathToFileURL(requireModulo.resolve("../src/services/xp.js")).href;
  return import(`${caminho}?etapa10=${Date.now()}`);
}

describe("Serviço de XP (ETAPA 10)", () => {
  let xp;

  beforeEach(async () => {
    vi.clearAllMocks();
    stubarBanco();
    xp = await carregarXp();

    queries.insertEventoXp.mockResolvedValue([{ affectedRows: 1 }, []]);
    queries.selectEstatisticas.mockResolvedValue([[{ xp: 150, nivel: 1 }], []]);
    queries.upsertEstatisticas.mockResolvedValue([{ affectedRows: 1 }, []]);
    queries.updateNivel.mockResolvedValue([{ affectedRows: 1 }, []]);
  });

  it("merge concede XP uma vez (concedido=true)", async () => {
    const res = await xp.awardXpPorMerge({ usuarioId: 2, tarefaId: 38, prNumber: 52 });
    expect(res.concedido).toBe(true);
    expect(res.xpAtual).toBe(150);
    // Chave de idempotência correta
    expect(queries.insertEventoXp.mock.calls[0][0][4]).toBe("task:38:github-merge:pr:52");
  });

  it("webhook repetido (INSERT IGNORE afeta 0) → não concede de novo (concedido=false)", async () => {
    queries.insertEventoXp.mockResolvedValue([{ affectedRows: 0 }, []]);
    const res = await xp.awardXpPorMerge({ usuarioId: 2, tarefaId: 38, prNumber: 52 });
    expect(res.concedido).toBe(false);
    expect(queries.upsertEstatisticas).not.toHaveBeenCalled();
    expect(queries.updateNivel).not.toHaveBeenCalled();
  });

  it("conclusão manual usa chave task:{id}:manual-completion", async () => {
    const res = await xp.awardXpPorConclusaoManual({ usuarioId: 2, tarefaId: 38 });
    expect(res.concedido).toBe(true);
    expect(queries.insertEventoXp.mock.calls[0][0][4]).toBe("task:38:manual-completion");
    expect(queries.insertEventoXp.mock.calls[0][0][2]).toBe("manual_completion");
  });

  it("estatísticas permanecem coerentes: nível recalcula após XP", async () => {
    queries.selectEstatisticas.mockResolvedValue([[{ xp: 300, nivel: 2 }], []]);
    const res = await xp.awardXp({ usuarioId: 2, tarefaId: 38, tipo: "teste", xp: 150, idempotencyKey: "task:38:teste" });
    expect(res.nivel).toBe(2);
    expect(queries.updateNivel).toHaveBeenCalled();
  });

  it("awardXp valida argumentos obrigatórios", async () => {
    await expect(xp.awardXp({ usuarioId: null, tipo: "x", xp: 10, idempotencyKey: "k" })).rejects.toThrow();
    await expect(xp.awardXp({ usuarioId: 1, tipo: null, xp: 10, idempotencyKey: "k" })).rejects.toThrow();
  });
});