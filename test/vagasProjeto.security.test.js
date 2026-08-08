// test/vagasProjeto.security.test.js — ETAPA 4: SUÍTE DE SEGURANÇA/CONTRATO das vagas do projeto.
//
// Contrato coberto (permissões da ETAPA 4 — controller src/controllers/vagasProjeto.js):
//   GET    /projetos/:projetoId/vagas          → verificarToken + somenteMembroOuDonoDoProjeto
//   POST   /projetos/:projetoId/vagas          → verificarToken + somenteDonoDoProjeto
//   PATCH  /projetos/:projetoId/vagas/:vagaId  → verificarToken + somenteDonoDoProjeto
//   DELETE /projetos/:projetoId/vagas/:vagaId  → verificarToken + somenteDonoDoProjeto
//                                              → 409 se preenchidas > 0
//
// Handlers do pool fake: middlewares (SELECT criador_id + SELECT membros_equipe) e as
// queries reais do controller (listarVagas/criarVaga/apagarVaga sobre vagas_projeto +
// SELECT_VAGA_COM_FUNCAO com JOIN funcoes). O SQL é casado na forma NORMALIZADA
// (lowercase + espaços colapsados) — se o controller evoluir nas queries, ajustar as
// regex abaixo (os códigos de status/contrato não mudam).

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara } from "./helpers/bootstrap.js";

// Dono do projeto = usuário 1 (criador_id 1). Membro do squad = usuário 2.
// Usuário 5 não é dono nem membro.
const OWNER = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });
const MEMBRO = tokenPara({ id: 2, email: "membro@email.com", nome: "Membro" });
const FORA = tokenPara({ id: 5, email: "fora@email.com", nome: "Fora" });

const VAGA = {
  id: 101,
  projeto_id: 1,
  funcao_id: 3,
  funcao_nome: "Backend",
  quantidade: 2,
  preenchidas: 0,
  descricao: null,
  nivel_desejado: "qualquer",
  status: "aberta",
};

// Pool fake para os cenários COM token que chegam ao banco.
// - Middlewares: SELECT criador_id (dono) e SELECT membros_equipe (squad).
// - Queries de vagas_projeto: listar (GET), INSERT + SELECT da vaga criada (POST),
//   SELECT preenchidas (pré-DELETE) e DELETE.
// - owner = id 1; membro com vínculo = id 2; demais usuários não têm vínculo (403).
function criarPoolVagas({ preenchidas = 0 } = {}) {
  return criarPoolFake([
    // Middleware somenteMembroOuDonoDoProjeto / somenteDonoDoProjeto — dono do projeto
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: 1 }], []],
    },
    // Middleware somenteMembroOuDonoDoProjeto — vínculo com o squad (usuário 2 é membro)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? limit 1$/.test(sql),
      resposta: (params) => (params[1] === 2 ? [[{ id: 9 }], []] : [[], []]),
    },
    // DELETE — checagem de preenchidas (409 se > 0) — apagarVaga
    {
      match: (sql) => /^select id, preenchidas from vagas_projeto where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 101, preenchidas }], []],
    },
    // DELETE — remoção da vaga — apagarVaga
    {
      match: (sql) => /^delete from vagas_projeto where id = \?/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // POST/PATCH — validação de existência da função (criarVaga/atualizarVaga)
    {
      match: (sql) => /^select id from funcoes where id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 3 }], []],
    },
    // POST — INSERT da vaga — criarVaga
    {
      match: (sql) => /^insert into vagas_projeto /.test(sql),
      resposta: () => [{ insertId: 101, affectedRows: 1 }, []],
    },
    // POST/PATCH — SELECT da vaga recém-criada/atualizada (SELECT_VAGA_COM_FUNCAO)
    {
      match: (sql) => /^select .* from vagas_projeto v join funcoes f on .* where v\.id = \? limit 1$/.test(sql),
      resposta: () => [[VAGA], []],
    },
    // GET — listagem de vagas do projeto (listarVagas — SELECT_VAGA_COM_FUNCAO)
    {
      match: (sql) => /^select .* from vagas_projeto .* where .*projeto_id = \?/.test(sql),
      resposta: () => [[VAGA], []],
    },
  ]);
}

describe("Vagas do projeto ETAPA 4 — 401 sem token (verificarToken)", () => {
  // Sem token, TODAS as rotas da ETAPA 4 devem ser barradas pelo verificarToken
  // ANTES de qualquer query (pool sem handlers = qualquer query derruba o teste).
  const app = buildApp(criarPoolFake([]));

  it("GET /projetos/1/vagas sem token → 401 com shape de erro", async () => {
    const res = await request(app).get("/projetos/1/vagas");
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });

  it("POST /projetos/1/vagas sem token → 401 (não executa INSERT)", async () => {
    const res = await request(app)
      .post("/projetos/1/vagas")
      .send({ funcao_id: 3, quantidade: 2 });
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });

  it("PATCH /projetos/1/vagas/101 sem token → 401 (não executa UPDATE)", async () => {
    const res = await request(app)
      .patch("/projetos/1/vagas/101")
      .send({ quantidade: 3 });
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });

  it("DELETE /projetos/1/vagas/101 sem token → 401 (não executa DELETE)", async () => {
    const res = await request(app).delete("/projetos/1/vagas/101");
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });
});

describe("Vagas do projeto ETAPA 4 — GET (somenteMembroOuDonoDoProjeto)", () => {
  it("GET /projetos/1/vagas com token de MEMBRO → 200 com shape {sucesso, dados:[...], nItens}", async () => {
    const app = buildApp(criarPoolVagas());
    const res = await request(app).get("/projetos/1/vagas").set("Authorization", `Bearer ${MEMBRO}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(Array.isArray(res.body.dados)).toBe(true);
    expect(res.body.dados).toHaveLength(1);
    expect(res.body.nItens).toBe(1);
    // Campos núcleo da vaga (schema da ETAPA 4)
    expect(res.body.dados[0]).toMatchObject({
      id: 101,
      projeto_id: 1,
      funcao_id: 3,
      quantidade: 2,
      preenchidas: 0,
      status: "aberta",
    });
  });

  it("GET /projetos/1/vagas com token do OWNER → 200 (dono também enxerga)", async () => {
    const app = buildApp(criarPoolVagas());
    const res = await request(app).get("/projetos/1/vagas").set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(1);
  });

  it("GET /projetos/1/vagas com usuário sem vínculo (nem dono nem membro) → 403", async () => {
    const app = buildApp(criarPoolVagas());
    const res = await request(app).get("/projetos/1/vagas").set("Authorization", `Bearer ${FORA}`);

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
  });
});

describe("Vagas do projeto ETAPA 4 — POST (somenteDonoDoProjeto)", () => {
  it("POST /projetos/1/vagas com token de MEMBRO (não-owner) → 403", async () => {
    // somenteDonoDoProjeto NÃO consulta membros_equipe — membro do squad também é barrado.
    const app = buildApp(criarPoolVagas());
    const res = await request(app)
      .post("/projetos/1/vagas")
      .set("Authorization", `Bearer ${MEMBRO}`)
      .send({ funcao_id: 3, quantidade: 2 });

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Acesso negado: Apenas o proprietário do projeto pode realizar esta ação");
  });

  it("POST /projetos/1/vagas com token do OWNER → 200 com vaga criada", async () => {
    const app = buildApp(criarPoolVagas());
    const res = await request(app)
      .post("/projetos/1/vagas")
      .set("Authorization", `Bearer ${OWNER}`)
      .send({ funcao_id: 3, quantidade: 2 });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Vaga criada com sucesso");
    expect(res.body.dados.id).toBe(101);
  });
});

describe("Vagas do projeto ETAPA 4 — DELETE (somenteDonoDoProjeto + 409 preenchidas)", () => {
  it("DELETE /projetos/1/vagas/101 com token de MEMBRO (não-owner) → 403", async () => {
    const app = buildApp(criarPoolVagas());
    const res = await request(app).delete("/projetos/1/vagas/101").set("Authorization", `Bearer ${MEMBRO}`);

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
  });

  it("DELETE /projetos/1/vagas/101 do owner com preenchidas > 0 → 409 (vaga ocupada)", async () => {
    const app = buildApp(criarPoolVagas({ preenchidas: 2 }));
    const res = await request(app).delete("/projetos/1/vagas/101").set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(409);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Vaga possui membros vinculados");
    expect(res.body.dados).toBeNull();
  });

  it("DELETE /projetos/1/vagas/101 do owner com preenchidas = 0 → 200 com sucesso", async () => {
    const app = buildApp(criarPoolVagas({ preenchidas: 0 }));
    const res = await request(app).delete("/projetos/1/vagas/101").set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Vaga deletada com sucesso");
  });
});
