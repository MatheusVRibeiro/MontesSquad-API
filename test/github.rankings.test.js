import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, setEnvAmbiente } from "./helpers/bootstrap.js";

setEnvAmbiente();

const DADOS_RANKING = [
  { userId: "12", name: "João Silva", githubLogin: "joaosilva", avatarUrl: "https://a", commitCount: 32 },
  { userId: null, name: "GitHub não vinculado", githubLogin: null, avatarUrl: null, commitCount: 5 },
];

function criarPool() {
  return criarPoolFake([
    {
      // middleware somenteMembroOuDonoDoProjeto (1)
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: 5 }], []],
    },
    {
      // middleware somenteMembroOuDonoDoProjeto (2)
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 1 }], []],
    },
    {
      // topCommittersPorProjeto — SELECT com COUNT(c.id) e c.projeto_id = ?
      match: (sql) => /^select\s+u\.id as userid/.test(sql) && /c\.projeto_id = \?/.test(sql),
      resposta: () => [DADOS_RANKING, []],
    },
    {
      // topCommittersGeral — SELECT com COUNT(c.id) sem filtro de projeto
      match: (sql) => /^select\s+u\.id as userid/.test(sql) && !/c\.projeto_id = \?/.test(sql),
      resposta: () => [DADOS_RANKING, []],
    },
  ]);
}

describe("Rankings de committers (ETAPAS 11-12)", () => {
  let app;
  const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });

  beforeEach(() => {
    app = buildApp(criarPool());
  });

  it("GET /projetos/:id/rankings/committers — top do projeto (membro/dono)", async () => {
    const res = await request(app)
      .get("/projetos/1/rankings/committers?limit=5")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toHaveLength(2);
    expect(res.body.dados[0].githubLogin).toBe("joaosilva");
    expect(res.body.dados[0].commitCount).toBe(32);
  });

  it("GET /rankings/committers — global (logado)", async () => {
    const res = await request(app)
      .get("/rankings/committers?limit=10&period=all")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.period).toBe("all");
    expect(res.body.dados).toHaveLength(2);
  });

  it("GET /rankings/committers?period=month — aceita filtro", async () => {
    const res = await request(app)
      .get("/rankings/committers?period=month")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("month");
  });

  it("sem token → 401 em ambos", async () => {
    const a = await request(app).get("/projetos/1/rankings/committers");
    const b = await request(app).get("/rankings/committers");
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
  });
});