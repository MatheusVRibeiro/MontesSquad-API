import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // GET /habilidades
    match: (sql) => /^select id, nome from habilidades$/.test(sql),
    resposta: () => [[{ id: 1, nome: "React" }, { id: 2, nome: "Node.js" }], []],
  },
  {
    // POST /habilidades-usuario
    match: (sql) => /^insert into habilidades_usuario \(usuario_id, habilidade_id, nivel\) values \(\?, \?, \?\)$/.test(sql),
    resposta: () => [{ insertId: 1, affectedRows: 1 }, []],
  },
]);

const app = buildApp(pool);

describe("Habilidades", () => {
  it("GET /habilidades → 200 com lista", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app).get("/habilidades").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(2);
    expect(res.body.dados[0].nome).toBe("React");
  });

  it("POST /habilidades-usuario → 200 vincula skill ao usuário", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app)
      .post("/habilidades-usuario")
      .set("Authorization", `Bearer ${token}`)
      .send({ usuario_id: 2, habilidade_id: 1, nivel: "avancado" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.habilidade_id).toBe(1);
  });

  it("GET /habilidades sem token → 401", async () => {
    const res = await request(app).get("/habilidades");
    expect(res.status).toBe(401);
  });
});
