// test/githubPrivacy.security.test.js — ETAPA 14 (Privacidade e repositórios privados)
//
// Contract-first (skill montesquad-development, references/testes-seguranca-etapas.md):
// este arquivo codifica o CONTRATO da ETAPA 14 (docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md
// §17) e roda contra o controller/rotas ATUAIS. Critério de aceite da spec:
//   "Teste explícito comprova que usuário não autorizado não recebe dados técnicos
//    privados pela API."
//
// Regras obrigatórias da ETAPA 14:
//   1. visitante não vê detalhes GitHub privados;
//   2. usuário fora do projeto não vê branch/commit/PR privado;
//   3. portfólio público não mostra mensagem de commit privada sem autorização;
//   4. URL privada não deve ser exposta indevidamente;
//   5. tokens nunca vão para frontend;
//   6. logs não devem conter secrets (não testável por HTTP — coberto estruturalmente);
//   7. payloads devem ser minimizados (assert de whitelist em /github/me).
//
// Banco da spec: projetos.visibilidade ENUM('publico','privado') DEFAULT 'publico' +
// projetos.permitir_portfolio_publico BOOLEAN DEFAULT TRUE.
// Backend da spec (subagente em paralelo): src/services/githubPrivacy.js
// (canViewRepositoryActivity/canExposeContributionPublicly), portfolio.js marca privado
// e oculta contribuicoes quando privado, obterProjeto oculta repositorioUrl p/ não-membro
// de projeto privado, editarProjeto aceita visibilidade/permitir_portfolio_publico.
//
// HISTÓRICO HONESTO (2026-08-09) — alvo móvel com subagente backend em paralelo
// (pitfall ETAPA 11: o backend pousou NO MEIO da execução):
//   Run 1 (10:42): 8 GREEN / 5 RED — src/services/githubPrivacy.js NÃO existia;
//     portfolio.js/projetos.js não liam visibilidade. RED: casos 1, 3, 4, 8, 9.
//   Run 2 (10:43): 10 GREEN / 3 RED — githubPrivacy.js + portfolio.js pousaram
//     (privado:true + contribuicoes ocultas → casos 1/3 verdes). RED restantes:
//     caso 4 (obterProjeto ainda devolvia repositorioUrl), casos 8/9 (editarProjeto
//     ainda não aceitava visibilidade).
//   Run 3 (10:49): 13 GREEN / 0 RED — projetos.js pousou: obterProjeto oculta
//     repositorioUrl p/ não-membro de projeto privado (caso 4), editarProjeto
//     aceita visibilidade com validação ENUM (casos 8/9 — UPDATE emitido via
//     pool.chamadas e 400 p/ 'invalida'). CONTRATO ETAPA 14 100% VERDE.
//   ⚠️ Durante as runs intermediárias, o controller estava sendo reescrito —
//     re-sed + re-run constantes; o relatório final usa o estado MAIS FRESCO.
//
// Pool: handlers espelhando as queries REAIS atuais, com matchers de PREFIXO (sem `$`)
// onde a ETAPA 14 deve ACRESCENTAR colunas (visibilidade/permitir_portfolio_publico no
// SELECT do portfólio e do obterProjeto) — pitfall regra 6/11 do skill (grupo opcional
// vs. prefixo). As respostas incluem as variantes snake/camel dos campos ETAPA 14 para
// o service futuro ler a que escolher; o contrato asserta SÓ o shape público.

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// ─────────────────────────────────────────────────────────────────────────────
// Pool do portfólio — espelha src/services/portfolio.js (Q1-Q7), com as colunas
// ETAPA 14 adicionadas às rows do Q2 (o service futuro lê visibilidade/
// permitir_portfolio_publico; o atual simplesmente as ignora).
// Regra de ordem (pitfall ETAPA 11): Q7 (contém "from tarefas" E "from
// github_commits" E "from github_pull_requests") ANTES dos handlers genéricos.
function criarPoolPortfolio({
  usuarioExiste = true,
  comProjetos = true,
  visibilidade = "publico",
  permitirPortfolioPublico = true,
} = {}) {
  return criarPoolFake([
    // Q7 — contribuições por task (evidência com prUrl/titulo/prNumero)
    {
      match: (sql) => /from tarefas t left join github_pull_requests/.test(sql),
      resposta: () =>
        comProjetos
          ? [
              [
                {
                  tarefaId: 11,
                  projetoId: 1,
                  titulo: "Integrar pagamento",
                  prNumero: 42,
                  prUrl: "https://github.com/acme/vendas/pull/42",
                  mergeadoEm: "2026-08-01T00:00:00.000Z",
                  commits: 3,
                },
              ],
              [],
            ]
          : [[], []],
    },
    // Q1 — existência do usuário (404 quando inexistente)
    {
      match: (sql) => /^select id from usuarios where id = \? limit 1$/.test(sql),
      resposta: () => (usuarioExiste ? [[{ id: 5 }], []] : [[], []]),
    },
    // Q2 — participações (membros_equipe JOIN projetos). Matcher de PREFIXO:
    // a ETAPA 14 acrescenta p.visibilidade/permitir_portfolio_publico ao SELECT.
    // Rows entregam as variantes snake (como o MySQL devolve BOOLEAN) e camel.
    {
      match: (sql) => /from membros_equipe me join projetos p/.test(sql),
      resposta: () =>
        comProjetos
          ? [
              [
                {
                  projetoId: 1,
                  projetoNome: "Sistema de Vendas",
                  funcao: "Backend",
                  visibilidade,
                  permitir_portfolio_publico: permitirPortfolioPublico ? 1 : 0,
                  permitirPortfolioPublico,
                },
              ],
              [],
            ]
          : [[], []],
    },
    // Q3 — tasks verificadas por merge, por projeto
    {
      match: (sql) => /from tarefas where responsavel_id/.test(sql),
      resposta: () =>
        comProjetos ? [[{ projetoId: 1, total: 2 }], []] : [[], []],
    },
    // Q4 — commits por projeto (autor GitHub vinculado à conta)
    {
      match: (sql) => /from github_commits c join usuarios/.test(sql),
      resposta: () =>
        comProjetos ? [[{ projetoId: 1, total: 5 }], []] : [[], []],
    },
    // Q5 — PRs mergeados por projeto (autor via tarefas.responsavel_id)
    {
      match: (sql) => /from github_pull_requests pr join tarefas/.test(sql),
      resposta: () => (comProjetos ? [[{ projetoId: 1, total: 2 }], []] : [[], []]),
    },
    // Q6 — tecnologias do projeto (habilidades_projeto JOIN habilidades)
    {
      match: (sql) => /from habilidades_projeto/.test(sql),
      resposta: () =>
        comProjetos ? [[{ projetoId: 1, nome: "JavaScript" }], []] : [[], []],
    },
    // Fallback SELECT (regra 6 do skill) — sempre por último
    { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool do obterProjeto — espelha src/controllers/projetos.js (obterProjeto).
// A row principal inclui repositorioUrl (a URL EXISTE no banco — o contrato é
// o controller OCULTÁ-la para não-membro de projeto privado) e visibilidade
// (coluna ETAPA 14; o controller atual a ignora).
function criarPoolProjeto({ visibilidade = "publico", membro = false } = {}) {
  const URL_REPO = "https://github.com/acme/meu-repo";
  return criarPoolFake([
    // SELECT principal do projeto (matcher de PREFIXO — a ETAPA 14 acrescenta
    // p.visibilidade/permitir_portfolio_publico ao SELECT)
    {
      match: (sql) => /^select p\.id, p\.criador_id, u\.nome as criador_nome/.test(sql),
      resposta: () => [
        [
          {
            id: 1,
            criador_id: 5,
            criador_nome: "Dono",
            name: "Sistema de Vendas",
            description: "Squad de vendas",
            status: "aberto",
            membersLimit: 5,
            repositorioUrl: URL_REPO,
            figmaUrl: null,
            discordUrl: null,
            documentacaoUrl: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            membersCount: 2,
            visibilidade,
          },
        ],
        [],
      ],
    },
    // tecnologias necessárias
    { match: (sql) => /from habilidades_projeto hp join habilidades h/.test(sql), resposta: () => [[], []] },
    // vagas do projeto
    { match: (sql) => /from vagas_projeto v join funcoes f/.test(sql), resposta: () => [[], []] },
    // membros do squad (lista)
    {
      match: (sql) => /from membros_equipe me join usuarios/.test(sql),
      resposta: () => (membro ? [[{ id: 9, nome: "Membro", role: "Membro" }], []] : [[], []]),
    },
    // habilidades de cada membro (loop do controller)
    { match: (sql) => /from habilidades_usuario hu join habilidades h/.test(sql), resposta: () => [[], []] },
    // checagem de vínculo (controller — SEM LIMIT, distinto do middleware)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \?$/.test(sql),
      resposta: () => (membro ? [[{ id: 7 }], []] : [[], []]),
    },
    // tarefas do Kanban (só quando membro)
    {
      match: (sql) => /from tarefas t left join usuarios u on t\.responsavel_id = u\.id where t\.projeto_id/.test(sql),
      resposta: () => [[], []],
    },
    // subtarefas por task
    {
      match: (sql) => /^select id, titulo as title, concluida as done from subtarefas/.test(sql),
      resposta: () => [[], []],
    },
    // mensagens do mural (só quando membro)
    { match: (sql) => /from mensagens m join usuarios/.test(sql), resposta: () => [[], []] },
    // candidaturas (próprias, quando membro não-dono)
    {
      match: (sql) => /from candidaturas c join usuarios u on c\.usuario_id = u\.id where c\.projeto_id = \? and c\.usuario_id/.test(sql),
      resposta: () => [[], []],
    },
    // Fallback SELECT — queries auxiliares do fluxo (skills/candidaturas) não
    // quebram o teste; o veredito das asserts sai da row principal (handler
    // explícito acima), nunca do fallback (regra 6 do skill).
    { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool do PATCH /projetos/:id — espelha somenteDonoDoProjeto + editarProjeto.
// tokenId: dono (5) → passa no middleware; não-dono (9) → 403 no middleware.
// O handler do UPDATE visibilidade existe para o backend futuro; hoje o
// controller ignora o campo → a query NÃO é emitida → veredito sai de
// pool.chamadas (regra 5 do skill: status passa, contrato pega a query errada).
function criarPoolEditarProjeto() {
  return criarPoolFake([
    // somenteDonoDoProjeto — SELECT criador_id (LIMIT 1)
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: 5 }], []],
    },
    // UPDATE da ETAPA 14 — `visibilidade = ?` (matcher de prefixo tolera
    // múltiplos campos: visibilidade + permitir_portfolio_publico)
    {
      match: (sql) => /^update projetos set visibilidade/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // SELECT pós-UPDATE (matcher de PREFIXO — a ETAPA 14 pode acrescentar colunas)
    {
      match: (sql) => /^select id, criador_id, titulo, descricao/.test(sql),
      resposta: () => [
        [
          {
            id: 1,
            criador_id: 5,
            titulo: "Sistema de Vendas",
            descricao: "Squad de vendas",
            status: "aberto",
            limite_membros: 5,
            repositorio_url: "https://github.com/acme/meu-repo",
            figma_url: null,
            discord_url: null,
            documentacao_url: null,
            visibilidade: "privado",
          },
        ],
        [],
      ],
    },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool do GET /github/me — espelha src/controllers/github.js (me):
// SELECT de campos de CONEXÃO apenas (nunca tokens).
function criarPoolGithubMe() {
  return criarPoolFake([
    {
      match: (sql) =>
        /^select github_user_id, github_login, github_avatar_url, github_connected_at(, senha_definida, cadastro_origem)? from usuarios where id = \? limit 1$/.test(sql),
      resposta: () => [
        [
          {
            github_user_id: 90573780,
            github_login: "MatheusVRibeiro",
            github_avatar_url: "https://avatars.example/a.png",
            github_connected_at: new Date("2026-08-08T00:00:00Z"),
            senha_definida: 1,
            cadastro_origem: "github",
          },
        ],
        [],
      ],
    },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pool das rotas GitHub de task — espelha somenteMembroOuDonoDoProjeto (owner
// SELECT + member SELECT, ambos LIMIT 1). Não-membro → 403 antes do controller.
function criarPoolTaskGithub() {
  return criarPoolFake([
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: 5 }], []],
    },
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/.test(sql),
      resposta: () => [[], []],
    },
  ]);
}

const URL_PRIVADA = "https://github.com/acme/meu-repo";

// ─────────────────────────────────────────────────────────────────────────────
// Regras 1 e 3 — portfólio público não vaza detalhes de repositório privado
describe("ETAPA 14 — portfólio: projeto privado não expõe contribuições (regras 1 e 3)", () => {
  it("GET /usuarios/5/portfolio — projeto privado → privado:true e SEM contribuicoes detalhadas (sem prUrl/prNumero/titulo no JSON)", async () => {
    const app = buildApp(criarPoolPortfolio({ visibilidade: "privado", permitirPortfolioPublico: true }));

    const res = await request(app).get("/usuarios/5/portfolio");

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    const projeto = res.body.dados.projetos[0];
    // Contrato ETAPA 14: projeto privado é marcado como privado
    expect(projeto.privado, "ETAPA 14: projeto privado deve vir marcado privado:true").toBe(true);
    // Contrato: contribuicoes detalhadas são [] ou ausentes
    expect(
      projeto.contribuicoes === undefined || projeto.contribuicoes.length === 0,
      "ETAPA 14: projeto privado não pode expor contribuicoes detalhadas"
    ).toBe(true);
    // Contrato: nenhum detalhe técnico privado no JSON (prUrl/prNumero/titulo da contribuição)
    const json = JSON.stringify(res.body.dados);
    expect(json).not.toContain("prUrl");
    expect(json).not.toContain("prNumero");
    expect(json).not.toContain("Integrar pagamento");
    expect(json).not.toContain("github.com/acme/vendas/pull/42");
  });

  it("GET /usuarios/5/portfolio — projeto publico + permitir_portfolio_publico=true → contribuicoes presentes (detalhes técnicos visíveis)", async () => {
    const app = buildApp(criarPoolPortfolio({ visibilidade: "publico", permitirPortfolioPublico: true }));

    const res = await request(app).get("/usuarios/5/portfolio");

    expect(res.status).toBe(200);
    const projeto = res.body.dados.projetos[0];
    expect(projeto.privado).not.toBe(true);
    expect(Array.isArray(projeto.contribuicoes)).toBe(true);
    expect(projeto.contribuicoes.length).toBeGreaterThan(0);
    expect(projeto.contribuicoes[0].prUrl).toBe("https://github.com/acme/vendas/pull/42");
    expect(projeto.contribuicoes[0].prNumero).toBe(42);
    expect(projeto.contribuicoes[0].titulo).toBe("Integrar pagamento");
  });

  it("GET /usuarios/5/portfolio — projeto publico + permitir_portfolio_publico=false → privado:true e SEM detalhes", async () => {
    const app = buildApp(criarPoolPortfolio({ visibilidade: "publico", permitirPortfolioPublico: false }));

    const res = await request(app).get("/usuarios/5/portfolio");

    expect(res.status).toBe(200);
    const projeto = res.body.dados.projetos[0];
    expect(projeto.privado, "ETAPA 14: permitir_portfolio_publico=false deve marcar privado:true").toBe(true);
    expect(
      projeto.contribuicoes === undefined || projeto.contribuicoes.length === 0,
      "ETAPA 14: sem autorização de portfólio público, contribuicoes não podem aparecer"
    ).toBe(true);
    const json = JSON.stringify(res.body.dados);
    expect(json).not.toContain("prUrl");
    expect(json).not.toContain("prNumero");
    expect(json).not.toContain("github.com/acme/vendas/pull/42");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regra 4 — URL privada não exposta indevidamente
describe("ETAPA 14 — obterProjeto: repositorioUrl oculto para não-membro de projeto privado (regra 4)", () => {
  it("GET /projetos/1 — projeto privado, usuário NÃO-membro → 200 SEM repositorioUrl (null ou ausente)", async () => {
    const pool = criarPoolProjeto({ visibilidade: "privado", membro: false });
    const app = buildApp(pool);
    const token = tokenPara({ id: 9, tipo: "membro" });

    const res = await request(app).get("/projetos/1").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    const url = res.body.dados.repositorioUrl;
    expect(
      url === null || url === undefined,
      `ETAPA 14: não-membro de projeto privado NÃO pode receber repositorioUrl (recebeu: ${url})`
    ).toBe(true);
    // A URL existe no banco (mock a entrega) — o contrato é o controller ocultá-la
    expect(JSON.stringify(res.body.dados)).not.toContain(URL_PRIVADA);
  });

  it("GET /projetos/1 — projeto PUBLICO, usuário NÃO-membro → repositorioUrl presente (visível)", async () => {
    const app = buildApp(criarPoolProjeto({ visibilidade: "publico", membro: false }));
    const token = tokenPara({ id: 9, tipo: "membro" });

    const res = await request(app).get("/projetos/1").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.dados.repositorioUrl).toBe(URL_PRIVADA);
  });

  it("GET /projetos/1 — projeto privado, usuário MEMBRO → repositorioUrl presente (autorizado)", async () => {
    const app = buildApp(criarPoolProjeto({ visibilidade: "privado", membro: true }));
    const token = tokenPara({ id: 9, tipo: "membro" });

    const res = await request(app).get("/projetos/1").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.dados.repositorioUrl).toBe(URL_PRIVADA);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// editarProjeto — visibilidade: dono obrigatório + validação ENUM
describe("ETAPA 14 — PATCH /projetos/:id visibilidade (dono + validação ENUM)", () => {
  it("PATCH /projetos/1 { visibilidade:'privado' } por NÃO-dono → 403 (somenteDonoDoProjeto)", async () => {
    const app = buildApp(criarPoolEditarProjeto());
    const token = tokenPara({ id: 9, tipo: "membro" });

    const res = await request(app)
      .patch("/projetos/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ visibilidade: "privado" });

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Acesso negado: Apenas o proprietário do projeto pode realizar esta ação");
  });

  it("PATCH /projetos/1 { visibilidade:'privado' } por DONO → 200 E UPDATE projetos SET visibilidade emitido", async () => {
    const pool = criarPoolEditarProjeto();
    const app = buildApp(pool);
    const token = tokenPara({ id: 5, tipo: "membro" });

    const res = await request(app)
      .patch("/projetos/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ visibilidade: "privado" });

    expect(res.status).toBe(200);
    // Veredito de contrato via pool.chamadas (regra 5 do skill): o 200 atual é
    // alcançável mesmo sem o campo ser aceito (fields vazio → sem UPDATE) — o
    // contrato exige que o UPDATE seja REALMENTE emitido com o valor 'privado'.
    const chamada = buscarChamada(pool, /update projetos set visibilidade/);
    expect(
      chamada,
      "ETAPA 14: PATCH {visibilidade:'privado'} por dono deve emitir UPDATE projetos SET visibilidade"
    ).toBeDefined();
    expect(chamada.params[0]).toBe("privado");
    expect(chamada.params[1]).toBe("1");
  });

  it("PATCH /projetos/1 { visibilidade:'invalida' } por DONO → 400 (validação ENUM)", async () => {
    const app = buildApp(criarPoolEditarProjeto());
    const token = tokenPara({ id: 5, tipo: "membro" });

    const res = await request(app)
      .patch("/projetos/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ visibilidade: "invalida" });

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regras 5 e 7 — tokens nunca vão ao frontend; payloads minimizados
describe("ETAPA 14 — GET /github/me: tokens nunca vão para o frontend (regras 5 e 7)", () => {
  it("GET /github/me → 200 com dados de conexão, SEM access_token/refresh_token e SEM campos fora da whitelist", async () => {
    const app = buildApp(criarPoolGithubMe());
    const token = tokenPara({ id: 5, tipo: "membro" });

    const res = await request(app).get("/github/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.conectado).toBe(true);
    expect(res.body.dados.github_login).toBe("MatheusVRibeiro");
    // Regra 5: nenhuma chave de token no payload
    expect(res.body.dados).not.toHaveProperty("access_token");
    expect(res.body.dados).not.toHaveProperty("refresh_token");
    // Regra 5 reforçada: nem como substring em qualquer lugar do corpo
    expect(JSON.stringify(res.body)).not.toMatch(/access_token|refresh_token|client_secret/i);
    // Regra 7 (payload minimizado): apenas os campos de conexão da whitelist
    expect(Object.keys(res.body.dados).sort()).toEqual(
      [
        "cadastro_origem",
        "conectado",
        "github_avatar_url",
        "github_connected_at",
        "github_login",
        "github_user_id",
        "senha_definida",
      ].sort()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regra 2 — usuário fora do projeto não vê branch/commit/PR privado
describe("ETAPA 14 — rotas GitHub de task: usuário fora do projeto → 403 (regra 2)", () => {
  it.each([
    "/projetos/1/tarefas/11/github",
    "/projetos/1/tarefas/11/commits",
    "/projetos/1/tarefas/11/timeline",
  ])("GET %s por NÃO-membro → 403 (somenteMembroOuDonoDoProjeto)", async (rota) => {
    const app = buildApp(criarPoolTaskGithub());
    const token = tokenPara({ id: 9, tipo: "membro" });

    const res = await request(app).get(rota).set("Authorization", `Bearer ${token}`);

    // Usuário fora do projeto NÃO vê branch/commit/PR/timeline (regra 2) —
    // o middleware barra ANTES do controller consultar qualquer dado GitHub
    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Acesso negado: Requer ser proprietário do projeto ou membro do squad");
  });
});
