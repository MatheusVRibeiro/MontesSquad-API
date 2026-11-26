import { describe, it, expect } from "vitest";
import { reverterXpPorConclusaoManual, awardXpPorConclusaoManual, chaveConclusaoManual } from "../src/services/xp.js";
import { criarPoolFake } from "./helpers/bootstrap.js";

describe("Anti-Fraude de XP — Conclusão e Reversão de Tarefas", () => {
  it("concede XP na primeira conclusão manual", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^insert ignore into eventos_xp/i.test(sql),
        resposta: () => [{ affectedRows: 1 }, []],
      },
      {
        match: (sql) => /^update usuarios set xp = xp \+ \?/i.test(sql),
        resposta: () => [{ affectedRows: 1 }, []],
      },
      {
        match: (sql) => /^select xp, nivel from usuarios where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ xp: 100, nivel: 1 }], []],
      },
    ]);

    const res = await awardXpPorConclusaoManual({
      usuarioId: 10,
      tarefaId: 5,
      conn: pool,
    });

    expect(res.concedido).toBe(true);
    expect(res.xpAtual).toBe(100);
  });

  it("bloqueia concessão duplicada (idempotência por chave)", async () => {
    const pool = criarPoolFake([
      {
        // Se a chave já existir, o MySQL INSERT IGNORE afeta 0 linhas
        match: (sql) => /^insert ignore into eventos_xp/i.test(sql),
        resposta: () => [{ affectedRows: 0 }, []],
      },
      {
        match: (sql) => /^select xp, nivel from usuarios where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ xp: 100, nivel: 1 }], []],
      },
    ]);

    const res = await awardXpPorConclusaoManual({
      usuarioId: 10,
      tarefaId: 5,
      conn: pool,
    });

    expect(res.concedido).toBe(false);
    expect(res.xpAtual).toBe(100);
  });

  it("reverte o XP quando a tarefa é reaberta (desfeita a conclusão)", async () => {
    let eventoDeletado = false;
    let usuarioAtualizado = false;

    const pool = criarPoolFake([
      {
        match: (sql) => /^delete from eventos_xp where usuario_id = \? and chave_idempotencia = \?$/i.test(sql),
        resposta: (params) => {
          if (params[1] === chaveConclusaoManual(5)) {
            eventoDeletado = true;
            return [{ affectedRows: 1 }, []];
          }
          return [{ affectedRows: 0 }, []];
        },
      },
      {
        match: (sql) => /^update usuarios set xp = greatest\(xp - \?, 0\)/i.test(sql),
        resposta: () => {
          usuarioAtualizado = true;
          return [{ affectedRows: 1 }, []];
        },
      },
      {
        match: (sql) => /^select xp, nivel from usuarios where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ xp: 0, nivel: 1 }], []],
      },
    ]);

    const res = await reverterXpPorConclusaoManual({
      usuarioId: 10,
      tarefaId: 5,
      conn: pool,
    });

    expect(res.revertido).toBe(true);
    expect(eventoDeletado).toBe(true);
    expect(usuarioAtualizado).toBe(true);
    expect(res.xpAtual).toBe(0);
  });

  it("não reverte se a tarefa nunca tiver concedido XP manual", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^delete from eventos_xp where usuario_id = \? and chave_idempotencia = \?$/i.test(sql),
        resposta: () => [{ affectedRows: 0 }, []],
      },
      {
        match: (sql) => /^select xp, nivel from usuarios where id = \? limit 1$/i.test(sql),
        resposta: () => [[{ xp: 50, nivel: 1 }], []],
      },
    ]);

    const res = await reverterXpPorConclusaoManual({
      usuarioId: 10,
      tarefaId: 99,
      conn: pool,
    });

    expect(res.revertido).toBe(false);
    expect(res.xpAtual).toBe(50);
  });
});

