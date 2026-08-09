// test/portfolio.test.js — ETAPA 11 (portfólio verificável)
//
// Cobertura:
//   - GET /usuarios/:id/portfolio é PÚBLICO (sem verificarToken): perfil
//     público mostra as evidências agregadas sem exigir login (200 sem token).
//   - Shape do retorno: { projetos: [{ projetoId, projetoNome, funcao,
//     tasksVerificadas, commits, prsMergeados, tecnologias[], contribuicoes[] }] }
//     conforme o plano (linhas 885-970 do PLANO_EVOLUCAO).
//   - Agrega por projeto: tasks verificadas (concluida_via='github_merge'),
//     commits (github_commits por author_github_id), PRs mergeados (tasks do
//     usuário) e tecnologias (habilidades_projeto JOIN habilidades).
//   - Participação preserva TODOS os status (ativo/saiu/removido) — contrato
//     ETAPA 10: a query de membros NÃO filtra status='ativo'.
//   - Usuário sem participação → { projetos: [] } (200).
//   - Usuário inexistente → 404.
//
// Usuário 2 participa do projeto 5 (Backend, com evidências) e do projeto 6
// (Frontend, sem evidências).

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, buscarChamada } from "./helpers/bootstrap.js";

// Pool do fluxo completo: usuário existe + participação + 5 agregados.
function criarPoolPortfolio() {
  return criarPoolFake([
    {
      // 1. usuário existe
      match: (sql) => /^select id from usuarios where id = \? limit 1$/.test(sql),
      resposta: () => [[{ id: 2 }], []],
    },
    {
      // 2. participação — membros_equipe JOIN projetos JOIN vagas/funcoes
      //    (ETAPA 14: inclui visibilidade/permitir_portfolio_publico)
      match: (sql) =>
        /^select p\.id as projetoid, p\.titulo as projetonome, p\.visibilidade as visibilidade, p\.permitir_portfolio_publico as permitirportfoliopublico, coalesce\(f\.nome, me\.funcao\) as funcao from membros_equipe me/.test(
          sql
        ),
      resposta: () => [
        [
          { projetoId: 5, projetoNome: "Sistema Financeiro", funcao: "Backend", visibilidade: "publico", permitirPortfolioPublico: 1 },
          { projetoId: 6, projetoNome: "Site Institucional", funcao: "Frontend", visibilidade: "publico", permitirPortfolioPublico: 1 },
        ],
        [],
      ],
    },
    {
      // 3. tasks verificadas por merge GitHub, por projeto
      match: (sql) =>
        /^select projeto_id as projetoid, count\(\*\) as total from tarefas where responsavel_id = \? and concluida_via = 'github_merge'/.test(
          sql
        ),
      resposta: () => [[{ projetoId: 5, total: 4 }], []],
    },
    {
      // 4. commits por projeto (autor GitHub vinculado à conta)
      match: (sql) =>
        /^select c\.projeto_id as projetoid, count\(\*\) as total from github_commits c join usuarios u/.test(
          sql
        ),
      resposta: () => [[{ projetoId: 5, total: 32 }], []],
    },
    {
      // 5. PRs mergeados por projeto (tasks do usuário)
      match: (sql) =>
        /^select pr\.projeto_id as projetoid, count\(\*\) as total from github_pull_requests pr join tarefas t/.test(
          sql
        ),
      resposta: () => [[{ projetoId: 5, total: 4 }], []],
    },
    {
      // 6. tecnologias por projeto (ORDER BY h.nome)
      match: (sql) =>
        /^select hp\.projeto_id as projetoid, h\.nome from habilidades_projeto hp join habilidades h/.test(
          sql
        ),
      resposta: () => [
        [
          { projetoId: 5, nome: "MySQL" },
          { projetoId: 5, nome: "Node.js" },
        ],
        [],
      ],
    },
    {
      // 7. contribuições por task (com PR mergeado e commits)
      match: (sql) =>
        /^select t\.id as tarefaid, t\.projeto_id as projetoid, t\.titulo, pr\.numero as prnumero/.test(
          sql
        ),
      resposta: () => [
        [
          { tarefaId: 11, projetoId: 5, titulo: "API de autenticação", prNumero: 15, prUrl: "https://github.com/x/pr/15", mergeadoEm: "2026-01-10T00:00:00.000Z", commits: 8 },
          { tarefaId: 12, projetoId: 5, titulo: "Recuperação de senha", prNumero: 27, prUrl: "https://github.com/x/pr/27", mergeadoEm: "2026-01-20T00:00:00.000Z", commits: 5 },
        ],
        [],
      ],
    },
  ]);
}

describe("ETAPA 11 — GET /usuarios/:id/portfolio (portfólio verificável)", () => {
  it("→ 200 com shape do plano e agrega tasks/commits/PRs/tecnologias por projeto", async () => {
    const pool = criarPoolPortfolio();
    const app = buildApp(pool);

    const res = await request(app).get("/usuarios/2/portfolio");

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(2);
    expect(res.body.dados.projetos).toHaveLength(2);

    const financeiro = res.body.dados.projetos[0];
    // Shape conforme plano (linhas 899-913)
    expect(financeiro).toEqual({
      projetoId: 5,
      projetoNome: "Sistema Financeiro",
      funcao: "Backend",
      tasksVerificadas: 4,
      commits: 32,
      prsMergeados: 4,
      tecnologias: ["MySQL", "Node.js"],
      contribuicoes: [
        { tarefaId: 11, titulo: "API de autenticação", prNumero: 15, prUrl: "https://github.com/x/pr/15", commits: 8, mergeadoEm: "2026-01-10T00:00:00.000Z" },
        { tarefaId: 12, titulo: "Recuperação de senha", prNumero: 27, prUrl: "https://github.com/x/pr/27", commits: 5, mergeadoEm: "2026-01-20T00:00:00.000Z" },
      ],
    });

    // Projeto sem evidências → zeros e arrays vazios
    expect(res.body.dados.projetos[1]).toEqual({
      projetoId: 6,
      projetoNome: "Site Institucional",
      funcao: "Frontend",
      tasksVerificadas: 0,
      commits: 0,
      prsMergeados: 0,
      tecnologias: [],
      contribuicoes: [],
    });
  });

  it("→ 200 SEM token (endpoint público — perfil público mostra evidências)", async () => {
    const app = buildApp(criarPoolPortfolio());

    const res = await request(app).get("/usuarios/2/portfolio"); // sem Authorization

    expect(res.status).toBe(200);
    expect(res.body.dados.projetos).toHaveLength(2);
  });

  it("query de participação NÃO filtra status='ativo' (contrato ETAPA 10 — histórico preservado)", async () => {
    const pool = criarPoolPortfolio();
    const app = buildApp(pool);
    await request(app).get("/usuarios/2/portfolio");

    const membros = buscarChamada(
      pool,
      /select p\.id as projetoid, p\.titulo as projetonome, p\.visibilidade as visibilidade, p\.permitir_portfolio_publico as permitirportfoliopublico, coalesce\(f\.nome, me\.funcao\) as funcao from membros_equipe me/
    );
    expect(membros).toBeDefined();
    expect(/status = 'ativo'/.test(membros.sql)).toBe(false);
  });

  it("usuário sem participação → 200 com projetos vazio", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id from usuarios where id = \? limit 1$/.test(sql),
        resposta: () => [[{ id: 2 }], []],
      },
      {
        match: (sql) => /^select p\.id as projetoid, p\.titulo as projetonome/.test(sql),
        resposta: () => [[], []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app).get("/usuarios/2/portfolio");

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(0);
    expect(res.body.dados.projetos).toEqual([]);
  });

  it("usuário inexistente → 404", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select id from usuarios where id = \? limit 1$/.test(sql),
        resposta: () => [[], []],
      },
    ]);
    const app = buildApp(pool);

    const res = await request(app).get("/usuarios/999/portfolio");

    expect(res.status).toBe(404);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Usuário não encontrado");
    expect(res.body.dados).toBeNull();
  });
});
