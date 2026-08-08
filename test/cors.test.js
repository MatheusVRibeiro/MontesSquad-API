import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake } from "./helpers/bootstrap.js";

// Pool fake sem handlers: o teste de CORS (preflight OPTIONS) nunca chega ao
// banco — o middleware cors responde e encerra antes de qualquer rota/query.
const pool = criarPoolFake([]);
const app = buildApp(pool);

describe("CORS — preflight OPTIONS", () => {
  it("origem localhost:5174 é permitida (login do frontend)", async () => {
    const res = await request(app)
      .options("/login")
      .set("Origin", "http://localhost:5174")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type, authorization");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5174");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-allow-headers"].toLowerCase()).toContain("content-type");
    expect(res.headers["access-control-allow-headers"].toLowerCase()).toContain("authorization");
  });

  it("origem fora da whitelist é rejeitada (403)", async () => {
    const res = await request(app)
      .options("/login")
      .set("Origin", "http://localhost:9999")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(403);
  });

  it("POST real com origem 5174 recebe o header de CORS", async () => {
    const res = await request(app)
      .post("/login")
      .set("Origin", "http://localhost:5174")
      .send({ email: "nao-importa@email.com", senha: "x" });

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5174");
  });

  it("FRONTEND_URL com barra final continua permitindo a origem", async () => {
    // A normalização (trim/lowercase/sem '/') garante que "http://localhost:5174/"
    // configurado via env ainda permita o Origin "http://localhost:5174".
    const FRONTEND_URL_ORIGINAL = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = "http://localhost:5173/,http://localhost:5174/";
    const app2 = buildApp(criarPoolFake([]));

    try {
      const res = await request(app2)
        .options("/login")
        .set("Origin", "http://localhost:5174")
        .set("Access-Control-Request-Method", "POST");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5174");
    } finally {
      if (FRONTEND_URL_ORIGINAL === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = FRONTEND_URL_ORIGINAL;
    }
  });
});
