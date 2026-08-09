import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { buildApp, criarPoolFake, HASH_SENHA, setEnvAmbiente } from "./helpers/bootstrap.js";

setEnvAmbiente();

const pool = criarPoolFake([
  {
    // SELECT id, nome, email, senha, tipo, bio, localizacao, avatar_url, token_versao FROM usuarios WHERE email = ? LIMIT 1
    match: (sql) => /^select id, nome, email, senha, tipo, bio, localizacao, avatar_url, token_versao from usuarios where email = \? limit 1$/.test(sql),
    resposta: (params) =>
      params[0] === "lucas@email.com"
        ? [[{ id: 2, nome: "Lucas", email: "lucas@email.com", senha: HASH_SENHA, tipo: "membro", bio: null, localizacao: null, avatar_url: null, token_versao: 0 }], []]
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

// Correção A1 da auditoria de segurança: sessão JWT com revogação (logout),
// denylist por jti, token_versao (invalidação em massa) e hardening do JWT
// (algorithms HS256 + exp obrigatório).
describe("Auth — logout e revogação de sessão (A1)", () => {
  it("POST /logout → 200 'Sessão encerrada' e insere o jti em tokens_revogados", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select 1 from tokens_revogados where jti = \? limit 1$/.test(sql),
        resposta: () => [[], []],
      },
      {
        match: (sql) => /^select token_versao from usuarios where id = \? limit 1$/.test(sql),
        resposta: () => [[{ token_versao: 0 }], []],
      },
      {
        match: (sql) => /^insert ignore into tokens_revogados \(jti\) values \(\?\)$/.test(sql),
        resposta: () => [{ affectedRows: 1 }, []],
      },
    ]);
    const app = buildApp(pool);
    const token = jwt.sign(
      { id: 2, email: "lucas@email.com", nome: "Lucas", tipo: "membro", jti: "jti-teste-1", token_versao: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const res = await request(app).post("/logout").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Sessão encerrada");

    const insert = pool.chamadas.find((c) => /insert ignore into tokens_revogados/.test(c.sql));
    expect(insert).toBeTruthy();
    expect(insert.params).toEqual(["jti-teste-1"]);
  });

  it("token revogado (jti na denylist) → 401 'Sessão revogada'", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select 1 from tokens_revogados where jti = \? limit 1$/.test(sql),
        resposta: () => [[{ 1: 1 }], []],
      },
    ]);
    const app = buildApp(pool);
    const token = jwt.sign(
      { id: 2, email: "lucas@email.com", nome: "Lucas", tipo: "membro", jti: "jti-revogado", token_versao: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const res = await request(app).get("/usuarios").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Sessão revogada");
  });

  it("token sem expiração (sem exp) → 401 'Token inválido ou expirado'", async () => {
    const app = buildApp(criarPoolFake([]));
    const token = jwt.sign(
      { id: 2, email: "lucas@email.com", nome: "Lucas", tipo: "membro", jti: "jti-sem-exp", token_versao: 0 },
      process.env.JWT_SECRET
    );

    const res = await request(app).get("/usuarios").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token inválido ou expirado");
  });

  it("token com token_versao desatualizada (troca de senha) → 401 'Sessão revogada'", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select 1 from tokens_revogados where jti = \? limit 1$/.test(sql),
        resposta: () => [[], []],
      },
      {
        match: (sql) => /^select token_versao from usuarios where id = \? limit 1$/.test(sql),
        resposta: () => [[{ token_versao: 7 }], []],
      },
    ]);
    const app = buildApp(pool);
    const token = jwt.sign(
      { id: 2, email: "lucas@email.com", nome: "Lucas", tipo: "membro", jti: "jti-velho", token_versao: 3 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const res = await request(app).get("/usuarios").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Sessão revogada");
  });

  it("token assinado com HS384 → 401 (algorithms restrito a HS256)", async () => {
    const app = buildApp(criarPoolFake([]));
    const token = jwt.sign(
      { id: 2, email: "lucas@email.com", nome: "Lucas", tipo: "membro", jti: "jti-hs384", token_versao: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS384", expiresIn: "1h" }
    );

    const res = await request(app).get("/usuarios").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token inválido ou expirado");
  });

  it("login emite token com jti e token_versao no payload", async () => {
    const res = await request(app).post("/login").send({ email: "lucas@email.com", senha: "senha123" });
    expect(res.status).toBe(200);
    const payload = jwt.decode(res.body.token);
    expect(payload.jti).toBeTruthy();
    expect(payload.token_versao).toBe(0);
  });
});
