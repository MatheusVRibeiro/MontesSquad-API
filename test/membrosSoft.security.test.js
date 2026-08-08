// test/membrosSoft.security.test.js — ETAPA 6: SUÍTE DE SEGURANÇA/CONTRATO da função do membro
// com SOFT-DELETE e saída voluntária do squad.
//
// Contrato da ETAPA 6 (spec — src/controllers/membros.js AINDA EM IMPLEMENTAÇÃO):
//   DELETE /projetos/:projetoId/membros/:usuarioId  → verificarToken + somenteDonoDoProjeto
//         - sem token            → 401
//         - não-dono             → 403
//         - dono                 → 200 E o vínculo vira SOFT-DELETE:
//                                 UPDATE membros_equipe SET status = 'removido'
//                                 (NUNCA DELETE físico de membros_equipe)
//   POST  /projetos/:projetoId/sair  → verificarToken (membro OU dono; dono bloqueado no controller)
//         - sem token            → 401
//         - membro               → 200 E UPDATE membros_equipe SET status = 'saiu'
//         - dono (owner)         → 400 (o proprietário não pode sair/abandonar o próprio projeto)
//
// ⚠️ ESTADO REAL (main): o controller ATUAL NÃO tem soft-delete — removerMembro emite DELETE
// físico (`DELETE FROM membros_equipe`) — e NÃO existe a rota POST /projetos/:projetoId/sair.
// Estes testes codificam o CONTRATO da ETAPA 6; os que falham hoje são EXATAMENTE as lacunas
// da implementação (reportado honestamente no resultado da execução). Quando a ETAPA 6 for
// implementada, se o SQL do controller divergir das regex abaixo (casamento na forma
// NORMALIZADA), ajustar as regex — os status/contrato não mudam.
//
// Handlers do pool fake: middlewares (SELECT criador_id do somenteDonoDoProjeto /
// somenteMembroOuDonoDoProjeto, SELECT de vínculo do somenteMembroOuDonoDoProjeto) e as queries
// do membros.js (SELECT criador_id do removerMembro, DELETE físico ATUAL + UPDATE de status do
// CONTRATO, UPDATE de candidaturas como efeito colateral). Um fallback `^select` genérico evita
// crash em SELECTs auxiliares não mapeados (a falha honesta deve ser status mismatch, não
// [MockDB] Query não mapeada); UPDATE/DELETE/INSERT continuam estritos.

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Dono do projeto 1 = usuário 1 (criador_id 1). Membro comum = usuário 5.
// O membro removido/saindo é o usuário 2 (nunca o dono).
const OWNER = tokenPara({ id: 1, email: "dono@email.com", nome: "Dono" });
const MEMBRO = tokenPara({ id: 5, email: "membro@email.com", nome: "Membro" });

// Pool fake para os cenários COM token que chegam ao banco.
// Opções: criadorProjeto (dono do projeto 1), membroExiste (vínculo do usuário autenticado no
// squad — usado pelo somenteMembroOuDonoDoProjeto caso a rota /sair o utilize).
function criarPoolMembrosSoft({ criadorProjeto = 1, membroExiste = true } = {}) {
  return criarPoolFake([
    // Middleware somenteDonoDoProjeto + check do removerMembro (dono não pode ser removido)
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: criadorProjeto }], []],
    },
    // Middleware somenteMembroOuDonoDoProjeto — vínculo do usuário autenticado no squad
    // (sem âncora $: cobre variantes futuras com `and status = 'ativo'` / `limit 1`)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \?/.test(sql),
      resposta: () => (membroExiste ? [[{ id: 9 }], []] : [[], []]),
    },
    // ⚠️ DELETE físico — comportamento ATUAL (pré-ETAPA 6). Mantido no pool para o 200 do dono
    // ser alcançável; a asserção de contrato NEGA a existência desta chamada no histórico.
    {
      match: (sql) => /^delete from membros_equipe/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // CONTRATO ETAPA 6 — soft-delete/saída: UPDATE de status em membros_equipe
    {
      match: (sql) => /^update membros_equipe set status/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // Efeito colateral: rejeita a candidatura do usuário removido/saído
    {
      match: (sql) => /^update candidaturas set status/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // Fallback para SELECTs auxiliares não mapeados (ex.: checagem de status do vínculo)
    {
      match: (sql) => /^select/.test(sql),
      resposta: () => [[], []],
    },
  ]);
}

describe("ETAPA 6 — DELETE /projetos/:projetoId/membros/:usuarioId sem token → 401 (verificarToken)", () => {
  // Sem token a rota é barrada ANTES de qualquer query.
  const app = buildApp(criarPoolFake([]));

  it("DELETE /projetos/1/membros/2 sem token → 401 com shape de erro", async () => {
    const res = await request(app).delete("/projetos/1/membros/2");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });
});

describe("ETAPA 6 — DELETE /projetos/:projetoId/membros/:usuarioId com token de NÃO-dono → 403", () => {
  it("DELETE /projetos/1/membros/2 com token do membro 5 → 403 (somenteDonoDoProjeto)", async () => {
    const app = buildApp(criarPoolMembrosSoft({ criadorProjeto: 1 }));
    const res = await request(app)
      .delete("/projetos/1/membros/2")
      .set("Authorization", `Bearer ${MEMBRO}`);

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Acesso negado: Apenas o proprietário do projeto pode realizar esta ação");
    expect(res.body.dados).toBeNull();
  });
});

describe("ETAPA 6 — DELETE /projetos/:projetoId/membros/:usuarioId com token de DONO → 200 vira SOFT-DELETE", () => {
  it("DELETE /projetos/1/membros/2 com token do dono → 200 e a query é UPDATE status='removido' (nunca DELETE físico)", async () => {
    const pool = criarPoolMembrosSoft({ criadorProjeto: 1 });
    const app = buildApp(pool);
    const res = await request(app)
      .delete("/projetos/1/membros/2")
      .set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toBeNull();

    // CONTRATO ETAPA 6: NÃO pode existir DELETE físico de membros_equipe no histórico
    const deleteFisico = buscarChamada(pool, /delete from membros_equipe/);
    expect(deleteFisico).toBeFalsy();

    // CONTRATO ETAPA 6: DEVE existir UPDATE membros_equipe SET status com valor 'removido'
    const updateSoft = buscarChamada(pool, /update membros_equipe set status/);
    expect(updateSoft).toBeTruthy();
    expect(updateSoft.params).toContain("removido");
  });
});

describe("ETAPA 6 — POST /projetos/:projetoId/sair sem token → 401 (verificarToken)", () => {
  it("POST /projetos/1/sair sem token → 401 com shape de erro", async () => {
    const app = buildApp(criarPoolFake([]));
    const res = await request(app).post("/projetos/1/sair");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });
});

describe("ETAPA 6 — POST /projetos/:projetoId/sair com MEMBRO → 200 e UPDATE status='saiu'", () => {
  it("POST /projetos/1/sair com token do membro 5 → 200 e UPDATE membros_equipe SET status='saiu'", async () => {
    const pool = criarPoolMembrosSoft({ criadorProjeto: 1, membroExiste: true });
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/sair")
      .set("Authorization", `Bearer ${MEMBRO}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toBeNull();

    const updateSair = buscarChamada(pool, /update membros_equipe set status/);
    expect(updateSair).toBeTruthy();
    expect(updateSair.params).toContain("saiu");
  });
});

describe("ETAPA 6 — POST /projetos/:projetoId/sair com OWNER → 400 (dono não pode sair)", () => {
  it("POST /projetos/1/sair com token do dono 1 → 400", async () => {
    const pool = criarPoolMembrosSoft({ criadorProjeto: 1 });
    const app = buildApp(pool);
    const res = await request(app)
      .post("/projetos/1/sair")
      .set("Authorization", `Bearer ${OWNER}`);

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.dados).toBeNull();
  });
});
