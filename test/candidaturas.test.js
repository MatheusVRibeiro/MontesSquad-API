import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // SELECT id, criador_id FROM projetos WHERE id = ? — dono do projeto é o usuário 1
    match: (sql) => /^select id, criador_id from projetos where id = \?$/.test(sql),
    resposta: (params) => [[{ id: Number(params[0]), criador_id: 1 }], []],
  },
  {
    // SELECT id, status FROM candidaturas WHERE usuario_id = ? AND projeto_id = ? (SEM LIMIT)
    match: (sql) => /^select id, status from candidaturas where usuario_id = \? and projeto_id = \?$/.test(sql),
    resposta: () => [[], []],
  },
  {
    // ETAPA 5 — SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? (já membro)
    match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \?$/.test(sql),
    resposta: () => [[], []],
  },
  {
    // ETAPA 5 — INSERT INTO candidaturas (usuario_id, projeto_id, vaga_id, status, mensagem)
    match: (sql) => /^insert into candidaturas \(usuario_id, projeto_id, vaga_id, status, mensagem\) values \(\?, \?, \?, 'pendente', \?\)$/.test(sql),
    resposta: () => [{ insertId: 77, affectedRows: 1 }, []],
  },
  {
    // criarNotificacao — INSERT INTO notificacoes
    match: (sql) => /^insert into notificacoes \(usuario_id, tipo, titulo, descricao, link\) values \(\?, \?, \?, \?, \?\)$/.test(sql),
    resposta: () => [{ insertId: 5, affectedRows: 1 }, []],
  },
  {
    // criarNotificacao — SELECT da notificação criada
    match: (sql) => /^select id, usuario_id, tipo, titulo, descricao, lida, link, criado_em from notificacoes where id = \? limit 1$/.test(sql),
    resposta: () => [[{ id: 5, usuario_id: 1, tipo: "application", titulo: "Nova candidatura", descricao: "Lucas quer entrar no projeto", lida: 0, link: "/projetos/10", criado_em: "2026-01-01T00:00:00.000Z" }], []],
  },
]);

const app = buildApp(pool);

describe("Candidaturas — POST /projetos/:projetoId/candidaturas", () => {
  it("candidatura → 200 com status pendente", async () => {
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
    const res = await request(app)
      .post("/projetos/10/candidaturas")
      .set("Authorization", `Bearer ${token}`)
      .send({ mensagem: "Quero entrar no squad" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.id).toBe(77);
    expect(res.body.dados.status).toBe("pendente");
    expect(res.body.dados.projeto_id).toBe("10");
  });

  it("dispara notificação tipo 'application' para o DONO do projeto", async () => {
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
    await request(app)
      .post("/projetos/10/candidaturas")
      .set("Authorization", `Bearer ${token}`)
      .send({ mensagem: "Quero entrar" });

    const notif = buscarChamada(pool, /^insert into notificacoes \(usuario_id, tipo, titulo, descricao, link\)/);
    expect(notif).toBeDefined();
    expect(notif.params[0]).toBe(1); // dono do projeto (criador_id = 1)
    expect(notif.params[1]).toBe("application");
  });

  it("dono do projeto não pode se candidatar ao próprio projeto → 400", async () => {
    const token = tokenPara({ id: 1, email: "admin@email.com", nome: "Admin", tipo: "adm" });
    const res = await request(app)
      .post("/projetos/10/candidaturas")
      .set("Authorization", `Bearer ${token}`)
      .send({ mensagem: "eu mesmo" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Você não pode se candidatar ao seu próprio projeto");
  });
});
