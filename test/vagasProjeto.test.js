import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Vagas do projeto — Evolução ETAPA 4 (papéis/vagas necessárias no projeto)
// Endpoints: GET/POST /projetos/:projetoId/vagas, PATCH/DELETE /projetos/:projetoId/vagas/:vagaId.
// Regras: membro/dono listam; somente owner cria/edita/apaga; quantidade > 0;
// preenchidas <= quantidade; DELETE bloqueado se preenchidas > 0 (409).
//
// Dono = usuário 1 (criador_id 1); membro = usuário 2; não-membro = usuário 5.
function criarPoolComVagas({
  vagaAtual = {
    id: 10,
    projeto_id: 1,
    funcao_id: 1,
    quantidade: 2,
    preenchidas: 1,
    descricao: "APIs REST",
    nivel_desejado: "avancado",
    status: "aberta",
  },
  vagaComFuncao = {
    id: 10,
    projeto_id: 1,
    funcao_id: 1,
    funcao_nome: "Backend",
    quantidade: 2,
    preenchidas: 1,
    descricao: "APIs REST",
    nivel_desejado: "avancado",
    status: "aberta",
    criado_em: "2026-08-08T12:00:00.000Z",
  },
} = {}) {
  return criarPoolFake([
    // somenteDonoDoProjeto / somenteMembroOuDonoDoProjeto — projeto pertence ao usuário 1
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: 1 }], []],
    },
    // somenteMembroOuDonoDoProjeto — membro da equipe (usuário 5 não é membro)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/.test(sql),
      resposta: (params) => (params[1] === 5 ? [[], []] : [[{ id: 9 }], []]),
    },
    // Validação de função existente (POST/PATCH)
    {
      match: (sql) => /^select id from funcoes where id = \? limit 1$/.test(sql),
      resposta: (params) => (params[0] === 1 ? [[{ id: 1 }], []] : [[], []]),
    },
    // INSERT nova vaga
    {
      match: (sql) => /^insert into vagas_projeto \(projeto_id, funcao_id, quantidade, descricao, nivel_desejado\) values \(/.test(sql),
      resposta: () => [{ insertId: 10, affectedRows: 1 }, []],
    },
    // SELECT vaga com JOIN funcoes — vaga única (pós create/update)
    {
      match: (sql) => /where v\.id = \? limit 1$/.test(sql),
      resposta: () => [[vagaComFuncao], []],
    },
    // SELECT vaga com JOIN funcoes — lista do projeto
    {
      match: (sql) => /where v\.projeto_id = \? order by v\.id$/.test(sql),
      resposta: () => [[vagaComFuncao], []],
    },
    // SELECT vaga atual (PATCH)
    {
      match: (sql) => /^select \* from vagas_projeto where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => [[vagaAtual], []],
    },
    // SELECT preenchidas (DELETE)
    {
      match: (sql) => /^select id, preenchidas from vagas_projeto where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 10, preenchidas: vagaAtual.preenchidas }], []],
    },
    // UPDATE vaga
    {
      match: (sql) => /^update vagas_projeto set /.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // DELETE vaga
    {
      match: (sql) => /^delete from vagas_projeto where id = \? and projeto_id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
  ]);
}

const TOKEN_DONO = tokenPara({ id: 1 });
const TOKEN_MEMBRO = tokenPara({ id: 2 });

describe("Vagas do projeto (Evolução ETAPA 4)", () => {
  let app;

  beforeEach(() => {
    app = buildApp(criarPoolComVagas());
  });

  // ---------- GET /projetos/:projetoId/vagas ----------
  it("GET vagas como membro → 200 com lista e funcao_nome (JOIN funcoes)", async () => {
    const res = await request(app)
      .get("/projetos/1/vagas")
      .set("Authorization", `Bearer ${TOKEN_MEMBRO}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(1);
    expect(res.body.dados[0]).toMatchObject({
      id: 10,
      projeto_id: 1,
      funcao_id: 1,
      funcao_nome: "Backend",
      quantidade: 2,
      preenchidas: 1,
      nivel_desejado: "avancado",
      status: "aberta",
    });
  });

  it("GET vagas como não-membro → 403", async () => {
    const token = tokenPara({ id: 5 });
    const res = await request(app)
      .get("/projetos/1/vagas")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("GET vagas sem token → 401", async () => {
    const res = await request(app).get("/projetos/1/vagas");
    expect(res.status).toBe(401);
  });

  // ---------- POST /projetos/:projetoId/vagas ----------
  it("POST vagas como owner → 200 cria vaga com funcao_nome", async () => {
    const pool = criarPoolComVagas();
    app = buildApp(pool);

    const res = await request(app)
      .post("/projetos/1/vagas")
      .set("Authorization", `Bearer ${TOKEN_DONO}`)
      .send({ funcao_id: 1, quantidade: 2, descricao: "APIs REST", nivel_desejado: "avancado" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toMatchObject({ id: 10, funcao_nome: "Backend", quantidade: 2 });

    const insert = buscarChamada(pool, /^insert into vagas_projeto/);
    expect(insert.params).toEqual(["1", 1, 2, "APIs REST", "avancado"]);
  });

  it("POST vagas como membro (não owner) → 403", async () => {
    const res = await request(app)
      .post("/projetos/1/vagas")
      .set("Authorization", `Bearer ${TOKEN_MEMBRO}`)
      .send({ funcao_id: 1, quantidade: 1 });
    expect(res.status).toBe(403);
  });

  it("POST vagas com quantidade 0 → 400", async () => {
    const res = await request(app)
      .post("/projetos/1/vagas")
      .set("Authorization", `Bearer ${TOKEN_DONO}`)
      .send({ funcao_id: 1, quantidade: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("quantidade");
  });

  it("POST vagas com função inexistente → 400", async () => {
    const res = await request(app)
      .post("/projetos/1/vagas")
      .set("Authorization", `Bearer ${TOKEN_DONO}`)
      .send({ funcao_id: 999, quantidade: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Função não encontrada");
  });

  it("POST vagas sem funcao_id → 400", async () => {
    const res = await request(app)
      .post("/projetos/1/vagas")
      .set("Authorization", `Bearer ${TOKEN_DONO}`)
      .send({ quantidade: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("funcao_id");
  });

  it("POST vagas sem token → 401", async () => {
    const res = await request(app)
      .post("/projetos/1/vagas")
      .send({ funcao_id: 1, quantidade: 1 });
    expect(res.status).toBe(401);
  });

  // ---------- PATCH /projetos/:projetoId/vagas/:vagaId ----------
  it("PATCH vagas como owner → 200 atualiza e retorna vaga com funcao_nome", async () => {
    const pool = criarPoolComVagas({
      vagaComFuncao: {
        id: 10,
        projeto_id: 1,
        funcao_id: 1,
        funcao_nome: "Backend",
        quantidade: 3,
        preenchidas: 1,
        descricao: "Nova descrição",
        nivel_desejado: "avancado",
        status: "aberta",
        criado_em: "2026-08-08T12:00:00.000Z",
      },
    });
    app = buildApp(pool);

    const res = await request(app)
      .patch("/projetos/1/vagas/10")
      .set("Authorization", `Bearer ${TOKEN_DONO}`)
      .send({ quantidade: 3, descricao: "Nova descrição" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.funcao_nome).toBe("Backend");
    expect(res.body.dados.quantidade).toBe(3);

    const update = buscarChamada(pool, /^update vagas_projeto set/);
    expect(update.params).toEqual([3, "Nova descrição", "10", "1"]);
  });

  it("PATCH vagas com preenchidas > quantidade → 400", async () => {
    const res = await request(app)
      .patch("/projetos/1/vagas/10")
      .set("Authorization", `Bearer ${TOKEN_DONO}`)
      .send({ preenchidas: 3 }); // vaga atual: quantidade 2, preenchidas 1
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("preenchidas");
  });

  it("PATCH vagas inexistente → 404", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[{ criador_id: 1 }], []],
      },
      {
        match: (sql) => /^select \* from vagas_projeto where id = \? and projeto_id = \? limit 1$/.test(sql),
        resposta: () => [[], []],
      },
    ]);
    app = buildApp(pool);

    const res = await request(app)
      .patch("/projetos/1/vagas/999")
      .set("Authorization", `Bearer ${TOKEN_DONO}`)
      .send({ quantidade: 2 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Vaga não encontrada");
  });

  it("PATCH vagas sem token → 401", async () => {
    const res = await request(app)
      .patch("/projetos/1/vagas/10")
      .send({ quantidade: 2 });
    expect(res.status).toBe(401);
  });

  // ---------- DELETE /projetos/:projetoId/vagas/:vagaId ----------
  it("DELETE vaga com preenchidas > 0 → 409 'Vaga possui membros vinculados'", async () => {
    const res = await request(app)
      .delete("/projetos/1/vagas/10")
      .set("Authorization", `Bearer ${TOKEN_DONO}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Vaga possui membros vinculados");
  });

  it("DELETE vaga sem preenchidas → 200 deleta", async () => {
    const pool = criarPoolComVagas({ vagaAtual: { ...{}, id: 10, projeto_id: 1, preenchidas: 0 } });
    app = buildApp(pool);

    const res = await request(app)
      .delete("/projetos/1/vagas/10")
      .set("Authorization", `Bearer ${TOKEN_DONO}`);
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toContain("deletada");

    const del = buscarChamada(pool, /^delete from vagas_projeto/);
    expect(del).toBeDefined();
    expect(del.params).toEqual(["10", "1"]);
  });

  it("DELETE vaga sem token → 401", async () => {
    const res = await request(app).delete("/projetos/1/vagas/10");
    expect(res.status).toBe(401);
  });
});
