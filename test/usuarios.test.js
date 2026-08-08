import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // UPDATE usuarios SET ... WHERE id = ? (edição de perfil)
    match: (sql) => /^update usuarios set .+ where id = \?$/.test(sql),
    resposta: () => [{ affectedRows: 1 }, []],
  },
  {
    // SELECT dados atuais pós-update
    match: (sql) => /^select id, nome, email, bio, localizacao, avatar_url, tipo from usuarios where id = \? limit 1$/.test(sql),
    resposta: (params) => {
      const nomes = { 1: "Admin MontesSquad", 2: "Lucas", 3: "Fernanda" };
      const id = Number(params[0]);
      return [[
        {
          id,
          nome: nomes[id] || "Usuário",
          email: `u${id}@email.com`,
          bio: "bio nova",
          localizacao: "SP",
          avatar_url: null,
          tipo: id === 1 ? "adm" : "membro",
        },
      ], []];
    },
  },
]);

const app = buildApp(pool);

describe("IDOR — PATCH /usuarios/:id", () => {
  it("usuário comum editando OUTRO usuário → 403 (middleware bloqueia, sem tocar o banco)", async () => {
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
    const res = await request(app)
      .patch("/usuarios/3")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Hack" });

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toContain("próprio perfil");
    // o pool NÃO deve ter sido consultado (bloqueio acontece no middleware)
    expect(pool.chamadas.length).toBe(0);
  });

  it("usuário editando o PRÓPRIO perfil → 200", async () => {
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
    const res = await request(app)
      .patch("/usuarios/2")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "nova bio" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.bio).toBe("bio nova"); // estado pós-update vindo do "banco"

    // O UPDATE foi executado com o valor enviado no body
    const update = buscarChamada(pool, /^update usuarios set .+ where id = \?$/);
    expect(update).toBeDefined();
    expect(update.params[0]).toBe("nova bio");
    expect(update.params[1]).toBe("2"); // request.params.id chega como string no Express
  });

  it("admin pode editar perfil de outro usuário → 200", async () => {
    const token = tokenPara({ id: 1, email: "admin@email.com", nome: "Admin MontesSquad", tipo: "adm" });
    const res = await request(app)
      .patch("/usuarios/3")
      .set("Authorization", `Bearer ${token}`)
      .send({ nome: "Fernanda X" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });

  it("sem token → 401", async () => {
    const res = await request(app).patch("/usuarios/2").send({ nome: "X" });
    expect(res.status).toBe(401);
  });
});
