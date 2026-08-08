// test/candidaturaVaga.security.test.js — ETAPA 5: SUÍTE DE SEGURANÇA/CONTRATO das candidaturas POR VAGA.
//
// Contrato da ETAPA 5 (spec — src/controllers/candidaturas.js AINDA EM IMPLEMENTAÇÃO):
//   POST  /projetos/:projetoId/candidaturas  → verificarToken (qualquer logado)
//         body { vaga_id, mensagem }
//         - vaga de OUTRO projeto            → 400
//         - vaga fechada                     → 400
//         - candidatura duplicada (pendente) → 409
//         - próprio projeto                  → 400
//         - já membro (candidatura aceita)   → 400
//         - válido                           → 201 (ou 200) com dados.vaga_id
//   PATCH /projetos/:projetoId/candidaturas/:candidaturaId → verificarToken + somenteDonoDoProjeto
//         - aprovação → 200 e UPDATE de vagas_projeto.preenchidas (+1) disparado
//
// ⚠️ ESTADO REAL (main @ 1cb22c0): o controller ATUAL NÃO lê vaga_id, retorna 400 (não 409)
// para duplicada e NÃO incrementa preenchidas. Estes testes codificam o CONTRATO da ETAPA 5;
// os que falham hoje são EXATAMENTE as lacunas da implementação (reportado honestamente no
// resultado da execução). Quando a ETAPA 5 for implementada, se o SQL do controller divergir
// das regex abaixo (casamento na forma NORMALIZADA), ajustar as regex — os status/contrato não mudam.
//
// Handlers do pool fake: middlewares (SELECT criador_id do somenteDonoDoProjeto) e as queries
// do candidaturas.js (SELECT projeto, SELECT vaga, SELECT duplicata, SELECT membro, INSERT
// candidatura, UPDATE status, UPDATE vagas_projeto.preenchidas) + queries auxiliares do fluxo
// atual (limite_membros, COUNT membros_equipe, INSERT membros_equipe, notificações).

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Dono do projeto = usuário 1 (criador_id 1). Candidato comum = usuário 5.
const OWNER = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });
const CANDIDATO = tokenPara({ id: 5, email: "candidato@email.com", nome: "Candidato" });

const VAGA_ID = 101;

// Pool fake para os cenários COM token que chegam ao banco.
// Opções: criadorProjeto (dono do projeto 1), vagaProjetoId (projeto da vaga 101),
// vagaStatus ('aberta'|'fechada'), vagaExiste (false = vaga não encontrada),
// duplicataStatus ('pendente'|'aceito'|null = nenhuma), totalMembros (limite de membros).
function criarPoolCandidaturas({
  criadorProjeto = 1,
  vagaProjetoId = 1,
  vagaStatus = "aberta",
  vagaExiste = true,
  duplicataStatus = null,
  totalMembros = 0,
} = {}) {
  return criarPoolFake([
    // Middleware somenteDonoDoProjeto (PATCH) — dono do projeto
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: criadorProjeto }], []],
    },
    // PATCH — limite de membros do projeto (atualizarStatusCandidatura)
    {
      match: (sql) => /^select limite_membros from projetos where id = \?$/.test(sql),
      resposta: () => [[{ limite_membros: 5 }], []],
    },
    // POST — SELECT do projeto (candidatarSe)
    {
      match: (sql) => /^select .* from projetos where id = \?$/.test(sql),
      resposta: () => [[{ id: 1, criador_id: criadorProjeto }], []],
    },
    // POST — SELECT da vaga (validação: pertence ao projeto + aberta) — ETAPA 5
    {
      match: (sql) => /^select .* from vagas_projeto where id = \?/.test(sql),
      resposta: () =>
        vagaExiste
          ? [[{ id: VAGA_ID, projeto_id: vagaProjetoId, status: vagaStatus, preenchidas: 0 }], []]
          : [[], []],
    },
    // POST — SELECT de candidatura duplicada (pendente/aceita) — ETAPA 5
    {
      match: (sql) => /^select id, status from candidaturas where usuario_id = \? and projeto_id = \?/.test(sql),
      resposta: () => (duplicataStatus ? [[{ id: 5, status: duplicataStatus }], []] : [[], []]),
    },
    // PATCH — SELECT da candidatura a aprovar/rejeitar
    {
      match: (sql) => /^select \* from candidaturas where id = \? and projeto_id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 7, usuario_id: 2, projeto_id: 1, vaga_id: VAGA_ID, status: "pendente", mensagem: "oi" }], []],
    },
    // PATCH — contagem atual de membros (limite de membros)
    {
      match: (sql) => /^select count\(\*\) as total from membros_equipe where projeto_id = \?$/.test(sql),
      resposta: () => [[{ total: totalMembros }], []],
    },
    // PATCH — SELECT de vínculo na equipe (dentro da transação)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \?$/.test(sql),
      resposta: () => [[], []],
    },
    // POST — INSERT da candidatura
    {
      match: (sql) => /^insert into candidaturas /.test(sql),
      resposta: () => [{ insertId: 50, affectedRows: 1 }, []],
    },
    // PATCH — UPDATE do status da candidatura (transação)
    {
      match: (sql) => /^update candidaturas set status = \? where id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // PATCH — UPDATE de vagas_projeto.preenchidas (+1 ao aprovar) — ETAPA 5
    {
      match: (sql) => /^update vagas_projeto set preenchidas/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // PATCH — INSERT do novo membro na equipe (transação)
    {
      match: (sql) => /^insert into membros_equipe /.test(sql),
      resposta: () => [{ insertId: 7, affectedRows: 1 }, []],
    },
    // Notificações (criarNotificacao — INSERT + SELECT de retorno)
    {
      match: (sql) => /^insert into notificacoes /.test(sql),
      resposta: () => [{ insertId: 1, affectedRows: 1 }, []],
    },
    {
      match: (sql) => /^select id, usuario_id, tipo, titulo, descricao, lida, link, criado_em from notificacoes where id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 1 }], []],
    },
  ]);
}

describe("Candidaturas por vaga ETAPA 5 — 401 sem token (verificarToken)", () => {
  // Sem token, TODAS as rotas da ETAPA 5 devem ser barradas ANTES de qualquer query.
  const app = buildApp(criarPoolFake([]));

  it("POST /projetos/1/candidaturas sem token → 401 com shape de erro", async () => {
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .send({ vaga_id: VAGA_ID, mensagem: "Quero entrar" });

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });

  it("PATCH /projetos/1/candidaturas/7 sem token → 401 (não executa UPDATE)", async () => {
    const res = await request(app)
      .patch("/projetos/1/candidaturas/7")
      .send({ status: "aceito" });

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });
});

describe("Candidaturas por vaga ETAPA 5 — POST com vaga (validações de contrato)", () => {
  it("POST com vaga de OUTRO projeto → 400 (vaga não pertence ao projeto)", async () => {
    const app = buildApp(criarPoolCandidaturas({ vagaProjetoId: 2 }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: VAGA_ID, mensagem: "Quero entrar" });

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.dados).toBeNull();
  });

  it("POST com vaga FECHADA → 400 (vaga não está aberta)", async () => {
    const app = buildApp(criarPoolCandidaturas({ vagaStatus: "fechada" }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: VAGA_ID, mensagem: "Quero entrar" });

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.dados).toBeNull();
  });

  it("POST duplicado (candidatura pendente) → 409", async () => {
    const app = buildApp(criarPoolCandidaturas({ duplicataStatus: "pendente" }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: VAGA_ID, mensagem: "Quero entrar" });

    expect(res.status).toBe(409);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.dados).toBeNull();
  });

  it("POST para o PRÓPRIO projeto → 400", async () => {
    const app = buildApp(criarPoolCandidaturas({ criadorProjeto: 1 }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${OWNER}`)
      .send({ vaga_id: VAGA_ID, mensagem: "Quero entrar" });

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Você não pode se candidatar ao seu próprio projeto");
    expect(res.body.dados).toBeNull();
  });

  it("POST já MEMBRO (candidatura aceita) → 400", async () => {
    const app = buildApp(criarPoolCandidaturas({ duplicataStatus: "aceito" }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: VAGA_ID, mensagem: "Quero entrar" });

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Você já é membro deste projeto");
    expect(res.body.dados).toBeNull();
  });

  it("POST válido com vaga → 201/200 e body inclui vaga_id", async () => {
    const app = buildApp(criarPoolCandidaturas({ vagaProjetoId: 1, vagaStatus: "aberta" }));
    const res = await request(app)
      .post("/projetos/1/candidaturas")
      .set("Authorization", `Bearer ${CANDIDATO}`)
      .send({ vaga_id: VAGA_ID, mensagem: "Quero entrar" });

    expect([200, 201]).toContain(res.status);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.status).toBe("pendente");
    expect(res.body.dados.vaga_id).toBe(VAGA_ID);
  });
});

describe("Candidaturas por vaga ETAPA 5 — PATCH aprovação (somenteDonoDoProjeto + preenchidas)", () => {
  it("PATCH aprovação com vaga → 200 e UPDATE de vagas_projeto.preenchidas disparado", async () => {
    const pool = criarPoolCandidaturas({ totalMembros: 0 });
    const app = buildApp(pool);
    const res = await request(app)
      .patch("/projetos/1/candidaturas/7")
      .set("Authorization", `Bearer ${OWNER}`)
      .send({ status: "aceito" });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.status).toBe("aceito");

    // ETAPA 5: aprovar candidatura DEVE incrementar preenchidas da vaga vinculada
    const updateVagas = buscarChamada(pool, /update vagas_projeto set preenchidas/);
    expect(updateVagas).toBeTruthy();
  });
});