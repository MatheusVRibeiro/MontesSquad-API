import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // SELECT 1 do healthcheck — comportamento controlado pela flag falharBanco
    match: (sql) => sql === "select 1",
    resposta: () => {
      if (pool.falharBanco) throw new Error("MockDB: banco indisponível");
      return [[{ "1": 1 }], []];
    },
  },
]);

const app = buildApp(pool);

describe("Healthcheck — GET /health", () => {
  it("banco ok → { sucesso: true, banco: 'ok' }", async () => {
    pool.falharBanco = false;
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sucesso: true, banco: "ok" });
  });

  it("banco fora → { sucesso: true, banco: 'erro' } sem derrubar o servidor", async () => {
    pool.falharBanco = true;
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sucesso: true, banco: "erro" });
  });

  it("é público (não exige token)", async () => {
    pool.falharBanco = false;
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.banco).toBe("ok");
  });
});
