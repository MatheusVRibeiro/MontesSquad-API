// test/githubPrivacy.test.js — ETAPA 14 (privacidade e repositórios privados)
//
// Cobertura:
//   - Unit (service src/services/githubPrivacy.js):
//     canViewRepositoryActivity — dono true, membro ativo true, não-membro em
//     projeto público true, não-membro em projeto privado false, visitante
//     (userId null) false, projeto inexistente false.
//     canExposeContributionPublicly — publico+permitido true; privado → 
//     {privado:true}; publico+permitir=0 → {privado:true}; objeto já carregado
//     (sem query extra).
//   - API (GET /usuarios/:id/portfolio — público):
//     projeto privado marca privado:true e NÃO expõe titulo/prUrl/prNumero;
//     projeto público com permitir_portfolio_publico expõe contribuicoes;
//     projeto público com permitir_portfolio_publico=0 → privado:true.
//   - API (GET /projetos/:id): projeto privado visto por NÃO-membro oculta
//     repositorioUrl/figmaUrl/discordUrl/documentacaoUrl (regra 4).
//   - API (PATCH /projetos/:id, somenteDonoDoProjeto):
//     visibilidade inválida → 400; não-dono → 403; aceita
//     visibilidade/permitir_portfolio_publico (assert UPDATE + retorno).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Unit — serviço githubPrivacy (stub de db via Module._load, padrão
//    reputacaoTecnica.test.js)
// ─────────────────────────────────────────────────────────────────────────────
const { Module, createRequire } = await import("node:module");
const { pathToFileURL } = await import("node:url");
const requireModulo = createRequire(import.meta.url);

// db fake com as 2 queries REAIS do service (normalizadas)
function criarDbFake({ projeto = null, membroAtivo = false } = {}) {
  return {
    query: async (sql, params) => {
      const s = String(sql).toLowerCase().replace(/\s+/g, " ").trim();
      if (s === "select id, criador_id, visibilidade, permitir_portfolio_publico from projetos where id = ? limit 1") {
        return [projeto ? [projeto] : [], []];
      }
      if (s === "select id from membros_equipe where projeto_id = ? and usuario_id = ? and status = 'ativo' limit 1") {
        return [membroAtivo ? [{ id: 1 }] : [], []];
      }
      throw new Error(`Query não mapeada (githubPrivacy unit): ${s}`);
    },
  };
}

function stubarDbFake(dbFake) {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "../database/connection" || request.endsWith("database/connection")) {
      return dbFake;
    }
    return originalLoad.apply(this, arguments);
  };
  return () => { Module._load = originalLoad; };
}

function carregarServico() {
  const caminho = pathToFileURL(requireModulo.resolve("../src/services/githubPrivacy.js")).href;
  return import(`${caminho}?etapa14=${Date.now()}`);
}

describe("ETAPA 14 — canViewRepositoryActivity (unit)", () => {
  let servico;
  let restauraStub;

  beforeEach(async () => {
    vi.clearAllMocks();
    restauraStub = stubarDbFake(criarDbFake());
    servico = await carregarServico();
  });

  afterEach(() => {
    if (restauraStub) restauraStub();
  });

  it("dono do projeto → true", async () => {
    restauraStub(); // troca o stub ANTES de recarregar com a config do caso
    restauraStub = stubarDbFake(
      criarDbFake({ projeto: { id: 7, criador_id: 10, visibilidade: "privado", permitir_portfolio_publico: 1 } })
    );
    servico = await carregarServico();

    const pode = await servico.canViewRepositoryActivity(10, 7);
    expect(pode).toBe(true);
  });

  it("membro ATIVO (status='ativo') → true, mesmo em projeto privado", async () => {
    restauraStub();
    restauraStub = stubarDbFake(
      criarDbFake({
        projeto: { id: 7, criador_id: 10, visibilidade: "privado", permitir_portfolio_publico: 1 },
        membroAtivo: true,
      })
    );
    servico = await carregarServico();

    const pode = await servico.canViewRepositoryActivity(42, 7);
    expect(pode).toBe(true);
  });

  it("não-membro em projeto PÚBLICO (autenticado) → true", async () => {
    restauraStub();
    restauraStub = stubarDbFake(
      criarDbFake({ projeto: { id: 7, criador_id: 10, visibilidade: "publico", permitir_portfolio_publico: 1 } })
    );
    servico = await carregarServico();

    const pode = await servico.canViewRepositoryActivity(42, 7);
    expect(pode).toBe(true);
  });

  it("não-membro em projeto PRIVADO → false", async () => {
    restauraStub();
    restauraStub = stubarDbFake(
      criarDbFake({ projeto: { id: 7, criador_id: 10, visibilidade: "privado", permitir_portfolio_publico: 1 } })
    );
    servico = await carregarServico();

    const pode = await servico.canViewRepositoryActivity(42, 7);
    expect(pode).toBe(false);
  });

  it("visitante (userId null) → false mesmo em projeto público (regra 1)", async () => {
    restauraStub();
    restauraStub = stubarDbFake(
      criarDbFake({ projeto: { id: 7, criador_id: 10, visibilidade: "publico", permitir_portfolio_publico: 1 } })
    );
    servico = await carregarServico();

    const pode = await servico.canViewRepositoryActivity(null, 7);
    expect(pode).toBe(false);
  });

  it("projeto inexistente → false", async () => {
    restauraStub();
    restauraStub = stubarDbFake(criarDbFake({ projeto: null }));
    servico = await carregarServico();

    const pode = await servico.canViewRepositoryActivity(10, 999);
    expect(pode).toBe(false);
  });
});

describe("ETAPA 14 — canExposeContributionPublicly (unit)", () => {
  let servico;
  let restauraStub;

  beforeEach(async () => {
    vi.clearAllMocks();
    restauraStub = stubarDbFake(criarDbFake());
    servico = await carregarServico();
  });

  afterEach(() => {
    if (restauraStub) restauraStub();
  });

  it("projeto publico + permitir_portfolio_publico=1 → true", async () => {
    restauraStub();
    restauraStub = stubarDbFake(
      criarDbFake({ projeto: { id: 7, criador_id: 10, visibilidade: "publico", permitir_portfolio_publico: 1 } })
    );
    servico = await carregarServico();

    const res = await servico.canExposeContributionPublicly(7, { titulo: "x", prUrl: "y", prNumero: 1 });
    expect(res).toBe(true);
  });

  it("projeto privado → { privado: true } (sem titulo/prUrl/prNumero)", async () => {
    restauraStub();
    restauraStub = stubarDbFake(
      criarDbFake({ projeto: { id: 7, criador_id: 10, visibilidade: "privado", permitir_portfolio_publico: 1 } })
    );
    servico = await carregarServico();

    const res = await servico.canExposeContributionPublicly(7, { titulo: "x", prUrl: "y", prNumero: 1 });
    expect(res).toEqual({ privado: true });
  });

  it("projeto publico + permitir_portfolio_publico=0 → { privado: true } (sem autorização)", async () => {
    restauraStub();
    restauraStub = stubarDbFake(
      criarDbFake({ projeto: { id: 7, criador_id: 10, visibilidade: "publico", permitir_portfolio_publico: 0 } })
    );
    servico = await carregarServico();

    const res = await servico.canExposeContributionPublicly(7, { titulo: "x", prUrl: "y", prNumero: 1 });
    expect(res).toEqual({ privado: true });
  });

  it("aceita objeto de projeto JÁ carregado (sem query extra)", async () => {
    restauraStub();
    restauraStub = stubarDbFake(criarDbFake({ projeto: null })); // db sem projeto → se consultasse, daria {privado:true}
    servico = await carregarServico();

    const projeto = { id: 7, criador_id: 10, visibilidade: "publico", permitir_portfolio_publico: 1 };
    const res = await servico.canExposeContributionPublicly(projeto, { titulo: "x", prUrl: "y", prNumero: 1 });
    expect(res).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. API — portfólio (GET /usuarios/:id/portfolio, público)
// ─────────────────────────────────────────────────────────────────────────────
function criarPoolPortfolioPrivacidade({ visibilidade, permitirPortfolioPublico }) {
  return criarPoolFake([
    // Q7 — contribuições por task (ANTES do genérico de tarefas)
    {
      match: (sql) => /from tarefas t left join github_pull_requests/.test(sql),
      resposta: () => [
        [
          { tarefaId: 11, projetoId: 5, titulo: "API de autenticação", prNumero: 15, prUrl: "https://github.com/x/pr/15", mergeadoEm: "2026-01-10T00:00:00.000Z", commits: 8 },
        ],
        [],
      ],
    },
    // Q1 — existência do usuário
    { match: (sql) => /^select id from usuarios where id = \? limit 1$/.test(sql), resposta: () => [[{ id: 2 }], []] },
    // Q2 — participações (ETAPA 14: com visibilidade/permitir_portfolio_publico)
    {
      match: (sql) => /^select p\.id as projetoid, p\.titulo as projetonome, p\.visibilidade as visibilidade, p\.permitir_portfolio_publico as permitirportfoliopublico, coalesce\(f\.nome, me\.funcao\) as funcao from membros_equipe me/.test(sql),
      resposta: () => [
        [
          { projetoId: 5, projetoNome: "Sistema Financeiro", funcao: "Backend", visibilidade, permitirPortfolioPublico },
        ],
        [],
      ],
    },
    // Q3 — tasks verificadas por merge, por projeto
    {
      match: (sql) => /^select projeto_id as projetoid, count\(\*\) as total from tarefas where responsavel_id = \? and concluida_via = 'github_merge'/.test(sql),
      resposta: () => [[{ projetoId: 5, total: 4 }], []],
    },
    // Q4 — commits por projeto
    {
      match: (sql) => /from github_commits c join usuarios u/.test(sql),
      resposta: () => [[{ projetoId: 5, total: 32 }], []],
    },
    // Q5 — PRs mergeados por projeto
    {
      match: (sql) => /from github_pull_requests pr join tarefas t/.test(sql),
      resposta: () => [[{ projetoId: 5, total: 4 }], []],
    },
    // Q6 — tecnologias do projeto
    {
      match: (sql) => /from habilidades_projeto hp join habilidades h/.test(sql),
      resposta: () => [[{ projetoId: 5, nome: "MySQL" }, { projetoId: 5, nome: "Node.js" }], []],
    },
  ]);
}

describe("ETAPA 14 — portfólio: projeto privado não expõe contribuições detalhadas", () => {
  it("visibilidade='privado' → privado:true, contribuicoes vazio e SEM titulo/prUrl no payload (regra 3/7)", async () => {
    const app = buildApp(criarPoolPortfolioPrivacidade({ visibilidade: "privado", permitirPortfolioPublico: 1 }));

    const res = await request(app).get("/usuarios/2/portfolio");

    expect(res.status).toBe(200);
    const projeto = res.body.dados.projetos[0];
    // Shape preservado (não quebrar o contrato ETAPA 11)
    expect(projeto.projetoId).toBe(5);
    expect(projeto.projetoNome).toBe("Sistema Financeiro");
    expect(projeto.funcao).toBe("Backend");
    expect(projeto.tasksVerificadas).toBe(4);
    expect(projeto.commits).toBe(32);
    expect(projeto.prsMergeados).toBe(4);
    expect(projeto.tecnologias).toEqual(["MySQL", "Node.js"]);
    // Privacidade: marcado privado e sem evidência detalhada
    expect(projeto.privado).toBe(true);
    expect(projeto.contribuicoes).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain("github.com/x/pr/15");
    expect(JSON.stringify(res.body)).not.toContain("API de autenticação");
  });

  it("visibilidade='publico' + permitir_portfolio_publico=0 → privado:true (sem autorização)", async () => {
    const app = buildApp(criarPoolPortfolioPrivacidade({ visibilidade: "publico", permitirPortfolioPublico: 0 }));

    const res = await request(app).get("/usuarios/2/portfolio");

    expect(res.status).toBe(200);
    const projeto = res.body.dados.projetos[0];
    expect(projeto.privado).toBe(true);
    expect(projeto.contribuicoes).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain("github.com/x/pr/15");
  });

  it("visibilidade='publico' + permitir_portfolio_publico=1 → contribuicoes expostas normalmente (sem privado)", async () => {
    const app = buildApp(criarPoolPortfolioPrivacidade({ visibilidade: "publico", permitirPortfolioPublico: 1 }));

    const res = await request(app).get("/usuarios/2/portfolio");

    expect(res.status).toBe(200);
    const projeto = res.body.dados.projetos[0];
    expect(projeto.privado).toBeUndefined();
    expect(projeto.contribuicoes).toEqual([
      { tarefaId: 11, titulo: "API de autenticação", prNumero: 15, prUrl: "https://github.com/x/pr/15", commits: 8, mergeadoEm: "2026-01-10T00:00:00.000Z" },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. API — GET /projetos/:id (obterProjeto): URL privada não exposta (regra 4)
// ─────────────────────────────────────────────────────────────────────────────
function criarPoolObterProjetoPrivado({ visibilidade = "privado", membroDaEquipe = false } = {}) {
  return criarPoolFake([
    // sqlProj — detalhes do projeto (ETAPA 14: com visibilidade/permitirPortfolioPublico)
    {
      match: (sql) => /^select p\.id, p\.criador_id, u\.nome as criador_nome, p\.titulo as name,/.test(sql),
      resposta: () => [
        [
          {
            id: 7,
            criador_id: 10,
            criador_nome: "Dono Secreto",
            name: "Squad Secreto",
            description: "desc",
            status: "aberto",
            visibilidade,
            permitirPortfolioPublico: 1,
            membersLimit: 5,
            repositorioUrl: "https://github.com/segredo/repo-privado",
            figmaUrl: "https://figma.com/file/segredo",
            discordUrl: "https://discord.gg/segredo",
            documentacaoUrl: "https://notion.so/segredo",
            createdAt: "2026-01-01T00:00:00.000Z",
            membersCount: 1,
          },
        ],
        [],
      ],
    },
    // tecnologias do projeto
    {
      match: (sql) => /from habilidades_projeto hp join habilidades h on hp\.habilidade_id = h\.id where hp\.projeto_id = \?/.test(sql),
      resposta: () => [[], []],
    },
    // vagas do projeto
    {
      match: (sql) => /from vagas_projeto v join funcoes f on v\.funcao_id = f\.id where v\.projeto_id = \?/.test(sql),
      resposta: () => [[], []],
    },
    // membros da equipe (JOIN usuarios)
    {
      match: (sql) => /^select u\.id, u\.nome, 'membro' as role from membros_equipe me join usuarios u/.test(sql),
      resposta: () => (membroDaEquipe ? [[{ id: 42, nome: "Membro X", role: "Membro" }], []] : [[], []]),
    },
    // habilidades de cada membro (loop do controller)
    {
      match: (sql) => /from habilidades_usuario hu join habilidades h on hu\.habilidade_id = h\.id where hu\.usuario_id = \?/.test(sql),
      resposta: () => [[], []],
    },
    // checagem de vínculo (privacidade — SEM filtro de status, query do controller)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \?$/.test(sql),
      resposta: () => (membroDaEquipe ? [[{ id: 1 }], []] : [[], []]),
    },
    // tarefas do Kanban (só quando membro — fluxo do controller)
    {
      match: (sql) => /from tarefas t left join usuarios u on t\.responsavel_id = u\.id where t\.projeto_id/.test(sql),
      resposta: () => [[], []],
    },
    // subtarefas por task (loop do controller)
    {
      match: (sql) => /^select id, titulo as title, concluida as done from subtarefas/.test(sql),
      resposta: () => [[], []],
    },
    // mensagens do mural (só quando membro)
    {
      match: (sql) => /from mensagens m join usuarios u on m\.remetente_id = u\.id/.test(sql),
      resposta: () => [[], []],
    },
    // candidaturas do próprio membro (não-dono)
    {
      match: (sql) => /from candidaturas c join usuarios u on c\.usuario_id = u\.id where c\.projeto_id = \? and c\.usuario_id/.test(sql),
      resposta: () => [[], []],
    },
  ]);
}

describe("ETAPA 14 — GET /projetos/:id oculta URL de projeto privado para não-membro", () => {
  it("projeto privado + usuário fora do squad → repositorioUrl/figmaUrl/discordUrl/documentacaoUrl null (regra 4)", async () => {
    const pool = criarPoolObterProjetoPrivado({ visibilidade: "privado", membroDaEquipe: false });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Forasteiro" });

    const res = await request(app).get("/projetos/7").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.dados.visibilidade).toBe("privado");
    expect(res.body.dados.repositorioUrl).toBeNull();
    expect(res.body.dados.figmaUrl).toBeNull();
    expect(res.body.dados.discordUrl).toBeNull();
    expect(res.body.dados.documentacaoUrl).toBeNull();
    // Forasteiro também não vê tasks/messages/applications (comportamento ETAPA 11)
    expect(res.body.dados.tasks).toEqual([]);
    expect(res.body.dados.messages).toEqual([]);
    expect(res.body.dados.applications).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain("repo-privado");
  });

  it("projeto privado + MEMBRO do squad → URLs visíveis (membro autorizado)", async () => {
    const pool = criarPoolObterProjetoPrivado({ visibilidade: "privado", membroDaEquipe: true });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Membro X" });

    const res = await request(app).get("/projetos/7").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.dados.repositorioUrl).toBe("https://github.com/segredo/repo-privado");
  });

  it("projeto PÚBLICO + não-membro → URLs visíveis (são públicas)", async () => {
    const pool = criarPoolObterProjetoPrivado({ visibilidade: "publico", membroDaEquipe: false });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Forasteiro" });

    const res = await request(app).get("/projetos/7").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.dados.visibilidade).toBe("publico");
    expect(res.body.dados.repositorioUrl).toBe("https://github.com/segredo/repo-privado");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. API — PATCH /projetos/:id (editarProjeto, somenteDonoDoProjeto)
// ─────────────────────────────────────────────────────────────────────────────
function criarPoolEditarProjeto() {
  return criarPoolFake([
    // middleware somenteDonoDoProjeto — SELECT criador_id
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [[{ criador_id: 10 }], []],
    },
    // UPDATE dinâmico do editarProjeto
    {
      match: (sql) => /^update projetos set visibilidade = \?, permitir_portfolio_publico = \? where id = \?$/.test(sql),
      resposta: () => [{ affectedRows: 1 }, []],
    },
    // SELECT pós-update (com as colunas novas da ETAPA 14)
    {
      match: (sql) => /^select id, criador_id, titulo, descricao, status, visibilidade, permitir_portfolio_publico, limite_membros, repositorio_url, figma_url, discord_url, documentacao_url from projetos where id = \? limit 1$/.test(sql),
      resposta: () => [
        [
          {
            id: 7,
            criador_id: 10,
            titulo: "Squad Secreto",
            descricao: null,
            status: "aberto",
            visibilidade: "privado",
            permitir_portfolio_publico: 0,
            limite_membros: 5,
            repositorio_url: "https://github.com/segredo/repo-privado",
            figma_url: null,
            discord_url: null,
            documentacao_url: null,
          },
        ],
        [],
      ],
    },
  ]);
}

describe("ETAPA 14 — PATCH /projetos/:id aceita visibilidade e permitir_portfolio_publico", () => {
  it("visibilidade inválida → 400 (sem UPDATE)", async () => {
    const pool = criarPoolEditarProjeto();
    const app = buildApp(pool);
    const token = tokenPara({ id: 10, nome: "Dono" });

    const res = await request(app)
      .patch("/projetos/7")
      .set("Authorization", `Bearer ${token}`)
      .send({ visibilidade: "secreto" });

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toContain("visibilidade");
    const update = buscarChamada(pool, /^update projetos/);
    expect(update).toBeUndefined();
  });

  it("permitir_portfolio_publico inválido → 400", async () => {
    const pool = criarPoolEditarProjeto();
    const app = buildApp(pool);
    const token = tokenPara({ id: 10, nome: "Dono" });

    const res = await request(app)
      .patch("/projetos/7")
      .set("Authorization", `Bearer ${token}`)
      .send({ visibilidade: "privado", permitir_portfolio_publico: "talvez" });

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toContain("permitir_portfolio_publico");
  });

  it("não-dono → 403 (middleware somenteDonoDoProjeto)", async () => {
    const pool = criarPoolFake([
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[{ criador_id: 10 }], []],
      },
    ]);
    const app = buildApp(pool);
    const token = tokenPara({ id: 99, nome: "Intruso" });

    const res = await request(app)
      .patch("/projetos/7")
      .set("Authorization", `Bearer ${token}`)
      .send({ visibilidade: "privado" });

    expect(res.status).toBe(403);
    const update = buscarChamada(pool, /^update projetos/);
    expect(update).toBeUndefined();
  });

  it("dono → 200, UPDATE com visibilidade/permitir_portfolio_publico e retorno com os campos novos", async () => {
    const pool = criarPoolEditarProjeto();
    const app = buildApp(pool);
    const token = tokenPara({ id: 10, nome: "Dono" });

    const res = await request(app)
      .patch("/projetos/7")
      .set("Authorization", `Bearer ${token}`)
      .send({ visibilidade: "privado", permitir_portfolio_publico: false });

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);

    const update = buscarChamada(pool, /^update projetos set visibilidade/);
    expect(update).toBeDefined();
    // id vem de req.params → string (pitfall #13)
    expect(update.params).toEqual(["privado", 0, "7"]);

    expect(res.body.dados.visibilidade).toBe("privado");
    expect(res.body.dados.permitir_portfolio_publico).toBe(0);
  });

  it("dono → 200, aceita '1'/'0' (string) e retorna permitir_portfolio_publico 1", async () => {
    const pool = criarPoolEditarProjeto();
    const app = buildApp(pool);
    const token = tokenPara({ id: 10, nome: "Dono" });

    const res = await request(app)
      .patch("/projetos/7")
      .set("Authorization", `Bearer ${token}`)
      .send({ visibilidade: "publico", permitir_portfolio_publico: "1" });

    expect(res.status).toBe(200);
    const update = buscarChamada(pool, /^update projetos set visibilidade/);
    expect(update.params).toEqual(["publico", 1, "7"]);
  });
});
