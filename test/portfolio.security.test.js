// test/portfolio.security.test.js — ETAPA 11 (portfólio verificável)
//
// Contract-first (skill montesquad-development, references/testes-seguranca-etapas.md):
// este arquivo codifica o CONTRATO da ETAPA 11 e roda contra o controller/rotas
// ATUAIS. Fonte do contrato: delegação do agente pai — GET /usuarios/:id/portfolio
// PÚBLICO (sem token) retorna o portfólio agregado do usuário:
//   { sucesso: true, dados: { projetos: [ { projetoId, projetoNome, funcao,
//       tasksVerificadas, commits, prsMergeados, tecnologias } ] } }
// Agregação sobre as participações do usuário: membros_equipe JOIN projetos +
// tarefas verificadas + github_commits + github_pull_requests (mergeados) +
// habilidades (tecnologias).
//
// DECISÕES REAIS do controller (src/controllers/portfolio.js + src/services/
// portfolio.js, implementados pelo subagente backend em 2026-08-09, NÃO commitados):
//   1. GET /usuarios/5/portfolio SEM token → 200 — rota PÚBLICA (routes.js:
//      router.get("/usuarios/:id/portfolio", portfolioController.obterPortfolio),
//      SEM verificarToken — perfil público mostra evidências sem login).
//   2. Shape: 200 { sucesso:true, message, nItens, dados:{ projetos:[...] } },
//      cada projeto com projetoId/projetoNome/funcao/tasksVerificadas/commits/
//      prsMergeados/tecnologias (+ contribuicoes[] — evidência por task).
//   3. GET /usuarios/999999/portfolio → 404 { sucesso:false, message:
//      "Usuário não encontrado", dados:null } — o service resolve existência
//      (SELECT id FROM usuarios ... LIMIT 1) antes de agregar (controller:39-40).
//   4. GET /portfolio (sem :id) → 404 — nenhuma rota casa /portfolio (404
//      default do Express; vale também depois, pois /usuarios/:id/portfolio
//      não casa /portfolio).
//
// HISTÓRICO HONESTO (2026-08-09): na 1ª execução (01:33) o controller/rota
// ainda NÃO existiam (subagente backend escrevia em paralelo) — casos 1-3
// falharam com 404 "Cannot GET" (rota não registrada, zero queries emitidas)
// e o caso 4 passou. Após o controller/rota existirem, a 2ª execução (abaixo)
// reflete o comportamento REAL: casos 1, 2 e 4 passam; caso 3 exige 404 (a
// 1ª versão deste teste codificava "200 com projetos vazio" — opção alternativa
// do enunciado — e foi CORRIGIDA para a decisão real do controller).
//
// Pool: handlers espelhando as 6 queries reais do service (específicos antes
// do fallback genérico `^select` — regra 6 do skill). As respostas usam os
// ALIASES que o service lê (projetoId/projetoNome/total/nome) — mock errado
// (coluna snake sem alias) silenciosamente zera a agregação.

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, buscarChamada } from "./helpers/bootstrap.js";

// Factory do pool da ETAPA 11 — espelha src/services/portfolio.js:
//   Q1 usuarios:        SELECT id FROM usuarios WHERE id = ? LIMIT 1
//   Q2 membros_equipe:  SELECT p.id AS projetoId, p.titulo AS projetoNome,
//                       COALESCE(f.nome, me.funcao) AS funcao FROM membros_equipe me
//                       JOIN projetos p ... WHERE me.usuario_id = ? ORDER BY entrou_em DESC
//   Q3 tarefas:         SELECT projeto_id AS projetoId, COUNT(*) AS total FROM tarefas
//                       WHERE responsavel_id = ? AND concluida_via='github_merge'
//                       AND excluida_em IS NULL GROUP BY projeto_id
//   Q4 commits:         SELECT c.projeto_id AS projetoId, COUNT(*) AS total
//                       FROM github_commits c JOIN usuarios u ON u.github_user_id = c.author_github_id
//                       WHERE u.id = ? GROUP BY c.projeto_id
//   Q5 prs:             SELECT pr.projeto_id AS projetoId, COUNT(*) AS total
//                       FROM github_pull_requests pr JOIN tarefas t ON t.id = pr.tarefa_id
//                       WHERE pr.estado='merged' AND t.responsavel_id = ? GROUP BY pr.projeto_id
//   Q6 techs:           SELECT hp.projeto_id AS projetoId, h.nome FROM habilidades_projeto hp
//                       JOIN habilidades h ... JOIN membros_equipe me ... WHERE me.usuario_id = ?
//   Q7 contribuições:   SELECT t.id AS tarefaId, t.projeto_id AS projetoId, t.titulo,
//                       pr.numero AS prNumero, pr.url AS prUrl, pr.mergeado_em AS mergeadoEm,
//                       (SELECT COUNT(*) FROM github_commits c WHERE c.tarefa_id = t.id) AS commits
//                       FROM tarefas t LEFT JOIN github_pull_requests pr ... WHERE t.responsavel_id = ?
function criarPoolEtapa11({ usuarioExiste = true, comProjetos = true } = {}) {
  return criarPoolFake([
    // Q7 — contribuições por task (ANTES do genérico de tarefas: a query
    // contém "from tarefas" e o find() pega o PRIMEIRO handler que casar)
    {
      match: (sql) => /from tarefas t left join github_pull_requests/.test(sql),
      resposta: () => [
        comProjetos
          ? [
              {
                tarefaId: 11,
                projetoId: 1,
                titulo: "Integrar pagamento",
                prNumero: 42,
                prUrl: "https://github.com/acme/vendas/pull/42",
                mergeadoEm: "2026-08-01T00:00:00.000Z",
                commits: 3,
              },
            ]
          : [],
        [],
      ],
    },
    // Q1 — existência do usuário (404 quando inexistente)
    {
      match: (sql) => /^select id from usuarios where id = \? limit 1$/.test(sql),
      resposta: () => (usuarioExiste ? [[{ id: 5 }], []] : [[], []]),
    },
    // Q2 — participações (membros_equipe JOIN projetos + funcoes/vagas)
    // ETAPA 14: linhas carregam visibilidade/permitirPortfolioPublico (o
    // service decide privado:true a partir delas — público + permitido expõe)
    {
      match: (sql) => /from membros_equipe/.test(sql),
      resposta: () =>
        comProjetos
          ? [
              [
                { projetoId: 1, projetoNome: "Sistema de Vendas", funcao: "Backend", visibilidade: "publico", permitirPortfolioPublico: 1 },
                { projetoId: 2, projetoNome: "App Mobile", funcao: "Frontend", visibilidade: "publico", permitirPortfolioPublico: 1 },
              ],
              [],
            ]
          : [[], []],
    },
    // Q3 — tasks verificadas por merge, por projeto
    {
      match: (sql) => /from tarefas/.test(sql),
      resposta: () =>
        comProjetos
          ? [
              [
                { projetoId: 1, total: 2 },
                { projetoId: 2, total: 1 },
              ],
              [],
            ]
          : [[], []],
    },
    // Q4 — commits por projeto (autor GitHub vinculado à conta)
    {
      match: (sql) => /from github_commits/.test(sql),
      resposta: () =>
        comProjetos
          ? [
              [
                { projetoId: 1, total: 5 },
                { projetoId: 2, total: 2 },
              ],
              [],
            ]
          : [[], []],
    },
    // Q5 — PRs mergeados por projeto (autor via tarefas.responsavel_id)
    {
      match: (sql) => /from github_pull_requests/.test(sql),
      resposta: () => (comProjetos ? [[{ projetoId: 1, total: 2 }], []] : [[], []]),
    },
    // Q6 — tecnologias do projeto (habilidades_projeto JOIN habilidades)
    {
      match: (sql) => /from habilidades/.test(sql),
      resposta: () =>
        comProjetos
          ? [
              [
                { projetoId: 1, nome: "JavaScript" },
                { projetoId: 1, nome: "Node.js" },
                { projetoId: 2, nome: "React" },
              ],
              [],
            ]
          : [[], []],
    },
    // Fallback SELECT (regra 6) — SELECTs de checagem futura não crasham
    { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
  ]);
}

describe("ETAPA 11 — autorização (rota pública)", () => {
  it("GET /usuarios/5/portfolio SEM token → 200 (público — rota sem verificarToken)", async () => {
    const app = buildApp(criarPoolEtapa11());

    const res = await request(app).get("/usuarios/5/portfolio");

    // Decisão REAL do controller: perfil público NÃO exige token
    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
  });
});

describe("ETAPA 11 — shape do contrato", () => {
  it("GET /usuarios/5/portfolio → 200 e shape {sucesso, dados.projetos[]} com os 7 campos verificáveis", async () => {
    const pool = criarPoolEtapa11();
    const app = buildApp(pool);

    const res = await request(app).get("/usuarios/5/portfolio");

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados).toBeDefined();
    expect(Array.isArray(res.body.dados.projetos)).toBe(true);
    expect(res.body.dados.projetos).toHaveLength(2);

    // Contrato: cada projeto do portfólio expõe os 7 campos verificáveis
    for (const projeto of res.body.dados.projetos) {
      expect(projeto).toHaveProperty("projetoId");
      expect(projeto).toHaveProperty("projetoNome");
      expect(projeto).toHaveProperty("funcao");
      expect(projeto).toHaveProperty("tasksVerificadas");
      expect(projeto).toHaveProperty("commits");
      expect(projeto).toHaveProperty("prsMergeados");
      expect(projeto).toHaveProperty("tecnologias");
    }

    const primeiro = res.body.dados.projetos[0];
    expect(primeiro.projetoId).toBe(1);
    expect(primeiro.projetoNome).toBe("Sistema de Vendas");
    expect(primeiro.funcao).toBe("Backend");
    expect(primeiro.tasksVerificadas).toBe(2);
    expect(primeiro.commits).toBe(5);
    expect(primeiro.prsMergeados).toBe(2);
    // toContain cobre array OU string (tolerância a GROUP_CONCAT no backend)
    expect(primeiro.tecnologias).toContain("JavaScript");

    // Contrato: a agregação parte de membros_equipe para o usuário da rota
    // (params[0] = :id da URL) — veredito via pool.chamadas, não só do status
    const selectMembros = buscarChamada(pool, /from membros_equipe/);
    expect(
      selectMembros,
      "ETAPA 11: o controller deve consultar membros_equipe (participações) para agregar o portfólio"
    ).toBeDefined();
    expect(selectMembros.params[0]).toBe("5"); // usuarioId da rota
  });
});

describe("ETAPA 11 — usuário inexistente", () => {
  it("GET /usuarios/999999/portfolio → 404 (usuário não encontrado)", async () => {
    const app = buildApp(criarPoolEtapa11({ usuarioExiste: false }));

    const res = await request(app).get("/usuarios/999999/portfolio");

    // Decisão REAL do controller: service resolve existência (SELECT id FROM
    // usuarios LIMIT 1) → null → 404 { sucesso:false, message:"Usuário não
    // encontrado", dados:null } (controllers/portfolio.js:20-26)
    expect(res.status).toBe(404);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Usuário não encontrado");
    expect(res.body.dados).toBeNull();
  });
});

describe("ETAPA 11 — rota sem id", () => {
  it("GET /portfolio (sem :id) → 404", async () => {
    const app = buildApp(criarPoolEtapa11());

    const res = await request(app).get("/portfolio");

    // Válido HOJE (nenhuma rota casa /portfolio) e válido DEPOIS (a rota
    // /usuarios/:id/portfolio não casa /portfolio) — 404 default do Express
    expect(res.status).toBe(404);
  });
});
