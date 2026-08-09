// test/reputacaoTecnica.security.test.js — ETAPA 12 (reputação técnica separada do XP)
//
// Contract-first (skill montesquad-development, references/testes-seguranca-etapas.md):
// este arquivo codifica o CONTRATO da ETAPA 12 e roda contra o controller/rotas
// ATUAIS. Fonte do contrato: docs/api.md §28 (atualizado pelo agente pai) —
// GET /usuarios/:id/reputacao-tecnica retorna score + evidências do usuário:
//   { sucesso: true, message: "Reputação técnica obtida",
//     dados: { score, tasks_verificadas, prs_mergeados, commits_validos,
//              projetos_com_entrega } }
// Tudo vem da tabela ÚNICA reputacao_tecnica_usuario (1 linha por usuário;
// migração scripts/migrar_evolucao_etapa12.js), precedida do SELECT de
// existência em usuarios (404 quando inexistente — mesmo padrão ETAPA 11).
//
// DECISÕES REAIS (docs/api.md §28, linha 1199):
//   1. Rota REQUER TOKEN — "(Requer Token)" — GET /usuarios/5/reputacao-tecnica
//      SEM token → 401 { sucesso:false, message:"Token não informado", dados:null }
//      (shape do verificarToken, src/middlewares/auth.js). NÃO é pública como o
//      portfolio (ETAPA 11): reputação técnica é dado interno do usuário.
//      ⚠️ A 1ª versão DESTE arquivo assumiu "pública como portfólio" (enunciado
//      oferecia "401 OU 200") — CORRIGIDA para a decisão real do docs. Qualquer
//      usuário logado consulta qualquer :id (sem somenteProprioOuAdm — igual à
//      rota /usuarios/:id/reputacao existente).
//   2. Shape: 200 { sucesso:true, message:"Reputação técnica obtida",
//      dados:{ score, tasks_verificadas, prs_mergeados, commits_validos,
//      projetos_com_entrega } } — score DECIMAL(10,2) na tabela.
//   3. GET /usuarios/999999/reputacao-tecnica → 404 "Usuário não encontrado"
//      (docs §28: "Erros: 404 (usuário inexistente)").
//   4. POST /usuarios/5/reputacao-tecnica → 404 (apenas GET; router.get não
//      casa POST — 404 default do Express, válido hoje e depois).
//
// ESTADO HONESTO (2026-08-09): na 1ª execução (01:44) a ETAPA 12 NÃO existia —
// git status limpo, main @ 2d7c685 (ETAPA 11); casos 1-3 falharam com 404
// default do Express ("Cannot GET", rota não registrada, zero queries) e o caso
// 4 passou. MINUTOS depois o subagente backend pousou docs/api.md §28 +
// src/services/reputacaoTecnica.js (recalcularReputacao — escrita/UPSERT) +
// scripts/migrar_evolucao_etapa12.js, mas o CONTROLLER/ROTA do GET ainda não
// existem no git status — os casos 1-2 continuam falhando (esperado: são o
// backlog exato da etapa) e o caso 3 falha só no body (status 404 vem do
// Express, sem JSON). Re-rodar quando controller/rota pousarem e reportar o
// estado mais fresco (pitfall "alvo móvel" do skill).
//
// Pool: handlers espelhando as queries esperadas do GET (específicos antes do
// fallback genérico `^select` — regra 6 do skill):
//   Q1 usuarios:   SELECT id FROM usuarios WHERE id = ? LIMIT 1 (existência →
//                  404 quando inexistente; aceita também "id, nome" — variante
//                  de src/controllers/reputacao.js)
//   Q2 reputação:  SELECT score, tasks_verificadas, prs_mergeados,
//                  commits_validos, projetos_com_entrega[, atualizado_em]
//                  FROM reputacao_tecnica_usuario WHERE usuario_id = ? LIMIT 1
//                  (sem linha → defaults 0; a tabela só ganha linha no primeiro
//                  recálculo/backfill — usuário novo existe mas não tem linha.
//                  Matcher tolera a presença de atualizado_em no SELECT — o
//                  controller real (controllers/reputacao.js:175) o inclui)

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// Factory do pool da ETAPA 12 — espelha o modelo de queries do GET real:
function criarPoolEtapa12({ usuarioExiste = true, temLinhaReputacao = true } = {}) {
  return criarPoolFake([
    // Q1 — existência do usuário (404 quando inexistente)
    {
      match: (sql) => /^select id(, nome)? from usuarios where id = \? limit 1$/.test(sql),
      resposta: () => (usuarioExiste ? [[{ id: 5 }], []] : [[], []]),
    },
    // Q2 — leitura da reputação técnica (tabela única com score + evidências)
    {
      match: (sql) =>
        /^select score, tasks_verificadas, prs_mergeados, commits_validos, projetos_com_entrega(, atualizado_em)? from reputacao_tecnica_usuario where usuario_id = \? limit 1$/.test(
          sql
        ),
      resposta: () =>
        temLinhaReputacao
          ? [
              [
                {
                  score: 165,
                  tasks_verificadas: 2,
                  prs_mergeados: 1,
                  commits_validos: 15,
                  projetos_com_entrega: 1,
                  atualizado_em: "2026-08-09T00:00:00.000Z",
                },
              ],
              [],
            ]
          : [[], []],
    },
    // Fallback SELECT (regra 6) — SELECTs de checagem futura não crasham
    { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
  ]);
}

describe("ETAPA 12 — autorização (rota requer token)", () => {
  it("GET /usuarios/5/reputacao-tecnica SEM token → 401 (Token não informado)", async () => {
    const app = buildApp(criarPoolEtapa12());

    const res = await request(app).get("/usuarios/5/reputacao-tecnica");

    // Decisão REAL (docs/api.md §28): "(Requer Token)" — rota com verificarToken,
    // shape do middleware auth.js:12-21
    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });
});

describe("ETAPA 12 — shape do contrato", () => {
  it("GET /usuarios/5/reputacao-tecnica com token → 200 e shape {sucesso, message, dados:{score, tasks_verificadas, prs_mergeados, commits_validos, projetos_com_entrega}}", async () => {
    const pool = criarPoolEtapa12();
    const app = buildApp(pool);
    const token = tokenPara({ id: 5, email: "lucas@email.com", nome: "Lucas" });

    const res = await request(app)
      .get("/usuarios/5/reputacao-tecnica")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Reputação técnica obtida");
    expect(res.body.dados).toBeDefined();

    // Contrato: score + 4 evidências (exemplo numérico do docs §28)
    expect(res.body.dados.score).toBe(165);
    expect(res.body.dados.tasks_verificadas).toBe(2);
    expect(res.body.dados.prs_mergeados).toBe(1);
    expect(res.body.dados.commits_validos).toBe(15);
    expect(res.body.dados.projetos_com_entrega).toBe(1);

    // Veredito via pool.chamadas: o controller lê a tabela ÚNICA
    // reputacao_tecnica_usuario com o usuarioId da rota (params[0] = :id da URL)
    const reputacaoCall = buscarChamada(pool, /from reputacao_tecnica_usuario/);
    expect(
      reputacaoCall,
      "ETAPA 12: o controller deve consultar reputacao_tecnica_usuario (score + evidências)"
    ).toBeDefined();
    expect(reputacaoCall.params[0]).toBe(5); // controller normaliza Number(:id) antes da query (reputacao.js:157)
  });
});

describe("ETAPA 12 — usuário inexistente", () => {
  it("GET /usuarios/999999/reputacao-tecnica com token → 404 (usuário não encontrado)", async () => {
    const app = buildApp(criarPoolEtapa12({ usuarioExiste: false }));
    const token = tokenPara({ id: 5, email: "lucas@email.com", nome: "Lucas" });

    const res = await request(app)
      .get("/usuarios/999999/reputacao-tecnica")
      .set("Authorization", `Bearer ${token}`);

    // Decisão real (docs §28: "Erros: 404 (usuário inexistente)"): SELECT de
    // existência antes da leitura → 404 { sucesso:false, message:"Usuário não
    // encontrado" }. `dados` NÃO é assertado de propósito: depende do estilo do
    // controller (JSON direto com dados:null vs next(new AppError(...)) que o
    // middleware global preenche com a mensagem em NODE_ENV != production).
    expect(res.status).toBe(404);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Usuário não encontrado");
  });
});

describe("ETAPA 12 — apenas GET", () => {
  it("POST /usuarios/5/reputacao-tecnica → 404 (só GET registrado)", async () => {
    const app = buildApp(criarPoolEtapa12());

    const res = await request(app).post("/usuarios/5/reputacao-tecnica");

    // Válido HOJE (nenhuma rota casa) e válido DEPOIS (router.get não casa POST)
    // — 404 default do Express
    expect(res.status).toBe(404);
  });
});
