import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, HASH_SENHA } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // SELECT id, nome, email, senha, tipo, bio, localizacao, avatar_url FROM usuarios WHERE email = ? LIMIT 1
    match: (sql) => /^select id, nome, email, senha, tipo, bio, localizacao, avatar_url from usuarios where email = \? limit 1$/.test(sql),
    resposta: (params) =>
      params[0] === "lucas@email.com"
        ? [[{ id: 2, nome: "Lucas", email: "lucas@email.com", senha: HASH_SENHA, tipo: "membro", bio: null, localizacao: null, avatar_url: null }], []]
        : [[], []],
  },
]);

const app = buildApp(pool);

describe("Auth — POST /login", () => {
  it("login com credenciais corretas → 200 com token", async () => {
    const res = await request(app).post("/login").send({ email: "lucas@email.com", senha: "senha123" });
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(10);
    expect(res.body.dados.id).toBe(2);
    expect(res.body.dados.nome).toBe("Lucas");
  });

  it("senha errada → 401 com mensagem genérica", async () => {
    const res = await request(app).post("/login").send({ email: "lucas@email.com", senha: "senha-errada" });
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Credenciais inválidas");
    expect(res.body.dados).toBeNull();
  });

  it("e-mail inexistente → 401 IDÊNTICO ao de senha errada (anti-enumeração)", async () => {
    const senhaErrada = await request(app)
      .post("/login")
      .send({ email: "lucas@email.com", senha: "senha-errada" });
    const emailInexistente = await request(app)
      .post("/login")
      .send({ email: "nao-existe@email.com", senha: "qualquer-coisa" });

    expect(emailInexistente.status).toBe(401);
    expect(emailInexistente.status).toBe(senhaErrada.status);
    expect(emailInexistente.body).toEqual(senhaErrada.body);
  });

  it("sem email/senha → 400", async () => {
    const res = await request(app).post("/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Email e senha são obrigatórios");
  });
});
