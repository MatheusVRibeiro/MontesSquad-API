// test/eventosProjeto.test.js — ETAPA 15 (Timeline de atividade do projeto)
//
// Funcional: GET /projetos/:projetoId/eventos (membro/dono) + service
// registrarEvento/listarEventos. Padrão da suíte: pool fake via
// test/helpers/bootstrap.js (buildApp/criarPoolFake/tokenPara/buscarChamada).
//
// Contract-first: a rota exige verificarToken + somenteMembroOuDonoDoProjeto
// (que faz 2 queries: SELECT criador_id FROM projetos + SELECT id FROM
// membros_equipe). O controller valida Number(projetoId) → 400 p/ não-numérico.
// O service lista com LEFT JOIN usuarios, ORDER BY criado_em DESC, id DESC,
// LIMIT ? (default 50), e parseia metadados JSON (try/catch → null).

import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";
// Stub do db via Module._load (padrão ETAPA 14 — githubPrivacy.test.js):
// o service CJS requer "../database/connection" → interceptado pelo stub.
const { Module, createRequire } = await import("node:module");
const { pathToFileURL } = await import("node:url");
const requireModulo = createRequire(import.meta.url);
const caminhoService = pathToFileURL(
  requireModulo.resolve("../src/services/eventosProjeto.js"),
).href;
const loadService = () => import(`${caminhoService}?etapa15=${Date.now()}`);
const originalLoad = Module._load;

// Handler do middleware somenteMembroOuDonoDoProjeto (membro do projeto 1):
// retorna criador_id DIFERENTE (ex.: 1) + linha em membros_equipe.
const membroProjeto1 = [
  {
    match: (s) => s === "select criador_id from projetos where id = ? limit 1",
    resposta: () => [[{ criador_id: 1 }], []],
  },
  {
    match: (s) => s.startsWith("select id from membros_equipe where projeto_id = ? and usuario_id = ?"),
    resposta: () => [[{ id: 9 }], []],
  },
];

function poolEventos(eventos = []) {
  return criarPoolFake([
    ...membroProjeto1,
    {
      // SELECT do listarEventos — query normalizada colapsada (regex por prefixo)
      match: (s) => s.startsWith("select e.*, u.nome as usuario_nome from eventos_projeto e"),
      resposta: () => [eventos, []],
    },
  ]);
}

describe("GET /projetos/:projetoId/eventos (ETAPA 15)", () => {
  it("membro recebe 200 com nItens e dados ordenados (o mock devolve na ordem pedida)", async () => {
    const eventos = [
      {
        id: 2,
        projeto_id: 1,
        usuario_id: 2,
        tipo: "task_criada",
        entidade_tipo: "tarefa",
        entidade_id: "7",
        titulo: "Task criada: API de login",
        metadados: JSON.stringify({ prioridade: "alta" }),
        criado_em: "2026-08-09T11:00:00.000Z",
        usuario_nome: "Fernanda",
      },
      {
        id: 1,
        projeto_id: 1,
        usuario_id: 1,
        tipo: "membro_entrou",
        entidade_tipo: null,
        entidade_id: null,
        titulo: "Admin entrou no squad",
        metadados: null,
        criado_em: "2026-08-09T10:00:00.000Z",
        usuario_nome: "Admin MontesSquad",
      },
    ];
    const app = buildApp(poolEventos(eventos));
    const res = await request(app)
      .get("/projetos/1/eventos")
      .set("Authorization", `Bearer ${tokenPara({ id: 9 })}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Eventos do projeto");
    expect(res.body.nItens).toBe(2);
    expect(res.body.dados).toHaveLength(2);
    // Ordenação vem do mock na ordem da query (DESC) — o controller não reordena
    expect(res.body.dados[0].tipo).toBe("task_criada");
    expect(res.body.dados[1].tipo).toBe("membro_entrou");
    // metadados JSON parseado → objeto
    expect(res.body.dados[0].metadados).toEqual({ prioridade: "alta" });
    expect(res.body.dados[0].usuario_nome).toBe("Fernanda");
  });

  it("sem token → 401 com shape padrão", async () => {
    const app = buildApp(poolEventos([]));
    const res = await request(app).get("/projetos/1/eventos");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.dados).toBeNull();
  });

  it("projetoId não numérico → 400 (sem tocar o banco)", async () => {
    const app = buildApp(poolEventos([]));
    const res = await request(app)
      .get("/projetos/abc/eventos")
      .set("Authorization", `Bearer ${tokenPara({ id: 9 })}`);

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toMatch(/inválido/i);
  });

  it("projeto sem eventos → 200 com dados vazio e nItens 0", async () => {
    const app = buildApp(poolEventos([]));
    const res = await request(app)
      .get("/projetos/1/eventos")
      .set("Authorization", `Bearer ${tokenPara({ id: 9 })}`);

    expect(res.status).toBe(200);
    expect(res.body.nItens).toBe(0);
    expect(res.body.dados).toEqual([]);
  });

  it("metadados corrompido → null em vez de derrubar a listagem", async () => {
    const eventos = [
      {
        id: 1,
        projeto_id: 1,
        usuario_id: null,
        tipo: "commit_detectado",
        entidade_tipo: null,
        entidade_id: null,
        titulo: "Lucas fez push (3 commits)",
        metadados: "{corrompido",
        criado_em: "2026-08-09T10:00:00.000Z",
        usuario_nome: null,
      },
    ];
    const app = buildApp(poolEventos(eventos));
    const res = await request(app)
      .get("/projetos/1/eventos")
      .set("Authorization", `Bearer ${tokenPara({ id: 9 })}`);

    expect(res.status).toBe(200);
    expect(res.body.dados[0].metadados).toBeNull();
    expect(res.body.dados[0].titulo).toMatch(/push/);
  });

  it("resposta usa LIMIT ? parametrizado com default 50 (assert na chamada do pool)", async () => {
    const pool = poolEventos([]);
    const app = buildApp(pool);
    await request(app)
      .get("/projetos/1/eventos")
      .set("Authorization", `Bearer ${tokenPara({ id: 9 })}`);

    const chamada = buscarChamada(pool, /from eventos_projeto e/);
    expect(chamada).toBeTruthy();
    expect(chamada.params[1]).toBe(50);
  });
});

describe("service registrarEvento (ETAPA 15)", () => {
  function stubarDbParaEventos(handlers) {
    const poolFake = {
      chamadas: [],
      async query(sql, params) {
        poolFake.chamadas.push({ sql: String(sql).toLowerCase().replace(/\s+/g, " ").trim(), params });
        const normalizada = String(sql).toLowerCase().replace(/\s+/g, " ").trim();
        const handler = handlers.find((h) => h.match(normalizada));
        if (!handler) throw new Error(`Query não mapeada (eventosProjeto unit): ${normalizada}`);
        if (handler.erro) throw handler.erro;
        if (typeof handler.resposta === "function") return handler.resposta();
        return handler.resposta;
      },
    };
    Module._load = function (request, parent, isMain) {
      if (request === "../database/connection" || request.endsWith("/database/connection")) {
        return poolFake;
      }
      return originalLoad.apply(this, arguments);
    };
    return poolFake;
  }

  afterEach(() => {
    Module._load = originalLoad;
  });

  it("INSERT com metadados serializados em JSON", async () => {
    const pool = stubarDbParaEventos([
      {
        match: (s) => s.startsWith("insert into eventos_projeto"),
        resposta: () => [{ insertId: 42, affectedRows: 1 }, []],
      },
    ]);
    const { registrarEvento } = await loadService();
    const insertId = await registrarEvento({
      projeto_id: 1,
      usuario_id: 2,
      tipo: "task_criada",
      entidade_tipo: "tarefa",
      entidade_id: "7",
      titulo: "Task criada: X",
      metadados: { prioridade: "alta", deps: ["a", "b"] },
    });

    expect(insertId).toBe(42);
    const chamada = pool.chamadas.find((c) => c.sql.startsWith("insert into eventos_projeto"));
    expect(chamada).toBeTruthy();
    expect(chamada.params[6]).toBe(JSON.stringify({ prioridade: "alta", deps: ["a", "b"] }));
  });

  it("falha do INSERT não lança — retorna null (best-effort)", async () => {
    const pool = stubarDbParaEventos([
      {
        match: (s) => s.startsWith("insert into eventos_projeto"),
        erro: new Error("tabela temporariamente indisponível"),
      },
    ]);
    const { registrarEvento } = await loadService();
    const resultado = await registrarEvento({
      projeto_id: 1,
      usuario_id: null,
      tipo: "pr_mergeado",
      titulo: "PR #5 mergeado",
    });

    expect(resultado).toBeNull();
  });

  it("metadados não serializáveis (circular) → grava {} e retorna insertId", async () => {
    const pool = stubarDbParaEventos([
      {
        match: (s) => s.startsWith("insert into eventos_projeto"),
        resposta: () => [{ insertId: 43, affectedRows: 1 }, []],
      },
    ]);
    const { registrarEvento } = await loadService();
    const circular = {};
    circular.self = circular;

    const insertId = await registrarEvento({
      projeto_id: 1,
      usuario_id: 1,
      tipo: "task_concluida",
      titulo: "Task concluída: X",
      metadados: circular,
    });

    expect(insertId).toBe(43);
    const chamada = pool.chamadas.find((c) => c.sql.startsWith("insert into eventos_projeto"));
    expect(chamada.params[6]).toBe("{}");
  });
});
