import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara } from "./helpers/bootstrap.js";

const pool = criarPoolFake([
  {
    // somenteMembroOuDonoDoProjeto: SELECT criador_id FROM projetos WHERE id = ? LIMIT 1
    match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
    resposta: () => [[{ criador_id: 1 }], []], // dono = 1; usuário 2 é membro; usuário 5 não é
  },
  {
    // somenteMembroOuDonoDoProjeto: SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? LIMIT 1
    match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/.test(sql),
    resposta: (params) => (params[1] === 5 ? [[], []] : [[{ id: 9 }], []]),
  },
  {
    // INSERT INTO mensagens (remetente_id, projeto_id, destinatario_id, conteudo)
    match: (sql) => /^insert into mensagens \(remetente_id, projeto_id, destinatario_id, conteudo\) values \(\?, \?, null, \?\)$/.test(sql),
    resposta: () => [{ insertId: 33, affectedRows: 1 }, []],
  },
  {
    // SELECT demais membros para notificar
    match: (sql) => /^select usuario_id from membros_equipe where projeto_id = \? and usuario_id != \?$/.test(sql),
    resposta: () => [[{ usuario_id: 1 }], []],
  },
  {
    // criarNotificacao — INSERT
    match: (sql) => /^insert into notificacoes \(usuario_id, tipo, titulo, descricao, link\) values \(\?, \?, \?, \?, \?\)$/.test(sql),
    resposta: () => [{ insertId: 6, affectedRows: 1 }, []],
  },
  {
    // criarNotificacao — SELECT da notificação criada
    match: (sql) => /^select id, usuario_id, tipo, titulo, descricao, lida, link, criado_em from notificacoes where id = \? limit 1$/.test(sql),
    resposta: () => [[{ id: 6, usuario_id: 1, tipo: "message", titulo: "Nova mensagem no projeto", descricao: "Lucas: Olá squad!", lida: 0, link: "/projetos/10", criado_em: "2026-01-01T00:00:00.000Z" }], []],
  },
]);

const app = buildApp(pool);

describe("Mural — POST /projetos/:projetoId/mensagens", () => {
  it("membro envia mensagem com content → 201", async () => {
    const token = tokenPara({ id: 2, email: "lucas@email.com", nome: "Lucas" });
    const res = await request(app)
      .post("/projetos/10/mensagens")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "Olá squad!" });

    expect(res.status).toBe(201);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.id).toBe(33);
    expect(res.body.dados.conteudo).toBe("Olá squad!");
  });

  it("sem content → 400", async () => {
    const token = tokenPara({ id: 2 });
    const res = await request(app)
      .post("/projetos/10/mensagens")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("conteudo");
  });

  it("não-membro → 403 (middleware bloqueia)", async () => {
    const token = tokenPara({ id: 5, email: "nao-membro@email.com", nome: "Zé" });
    const res = await request(app)
      .post("/projetos/10/mensagens")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "invadir" });

    expect(res.status).toBe(403);
  });
});
