import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // GET /notificacoes
    match: (sql) => /^select id, tipo, titulo, descricao, lida, link, criado_em from notificacoes where usuario_id = \? order by criado_em desc limit 50$/.test(sql),
    resposta: () => [[
      { id: 1, tipo: "application", titulo: "Nova candidatura", descricao: "Alguém quer entrar", lida: 1, link: "/projetos/10", criado_em: "2026-01-01T00:00:00.000Z" },
      { id: 2, tipo: "message", titulo: "Nova mensagem", descricao: "Lucas: oi", lida: 0, link: "/projetos/10", criado_em: "2026-01-02T00:00:00.000Z" },
    ], []],
  },
  {
    // POST /notificacoes/ler-tudo
    match: (sql) => /^update notificacoes set lida = true where usuario_id = \? and lida = false$/.test(sql),
    resposta: () => [{ affectedRows: 2 }, []],
  },
]);

const app = buildApp(pool);

describe("Notificações", () => {
  it("GET /notificacoes → 200 com shape camelCase (contrato frontend)", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app).get("/notificacoes").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(2);
    expect(res.body.dados[0]).toEqual({
      id: 1,
      type: "application",
      title: "Nova candidatura",
      description: "Alguém quer entrar",
      createdAt: "2026-01-01T00:00:00.000Z",
      read: true,
      link: "/projetos/10",
    });
    expect(res.body.dados[1].read).toBe(false);
    expect(res.body.dados[1].type).toBe("message");
  });

  it("POST /notificacoes/ler-tudo → 200", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app).post("/notificacoes/ler-tudo").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });

  it("GET /notificacoes sem token → 401", async () => {
    const res = await request(app).get("/notificacoes");
    expect(res.status).toBe(401);
  });
});
