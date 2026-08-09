// test/taskMatching.test.js — ETAPA 17 (Matching Desenvolvedor ↔ Task)
//
// Cobertura:
//   - Unit (service src/services/taskMatching.js):
//     PESOS_TASK_MATCHING documentado em código (40/25/15/10/10);
//     calcularCompatibilidadeTask devolve compatibilidade 0-100 + motivos[]
//     legíveis em pt-BR (critério de aceite: recomendação transparente).
//   - API (GET /projetos/:projetoId/tasks/recomendadas — verificarToken +
//     somenteMembroOuDonoDoProjeto):
//     (a) 200 com recomendação {taskId, compatibilidade 0-100, motivos[]};
//     (b) transparência: motivos é array de strings não vazias;
//     (c) task com responsável NÃO aparece (filtro SQL + memória);
//     (d) task excluída (excluida_em) NÃO aparece (soft-delete ETAPA 10);
//     (e) sem token → 401 antes de qualquer query;
//     (f) vínculo antigo ('saiu'/'removido') sem ser dono → 403 do service
//         (o middleware deixa passar por ter linha em membros_equipe; o
//         service exige status='ativo' — decisão documentada no controller);
//     (g) ordenação desc por compatibilidade (2 tasks mockadas);
//     (h) dono SEM vínculo ativo → 200 (dono gerencia — spec/nota da rota);
//     (i) projetoId não numérico → 400 (request.params é string — pitfall);
//     (j) habilidades da task em snake_case ainda pontuam (chaves defensivas
//         — técnica ETAPA 16; o mock do security test do irmão usa snake_case).
//
// Handlers espelham as queries REAIS do service (SQL normalizado:
// lowercase + colapso de espaços), específicos antes de genéricos, resposta
// [[rows],[fields]].

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// ─────────────────────────────────────────────────────────────────────────────
// Unit — service (stub de db via Module._load, padrão matching.test.js)
// ─────────────────────────────────────────────────────────────────────────────
const { Module, createRequire } = await import("node:module");
const { pathToFileURL } = await import("node:url");
const requireModulo = createRequire(import.meta.url);

// db fake que NUNCA deve ser consultado pelas funções puras (calcularCompatibilidadeTask)
function criarDbFake() {
  return {
    query: async (sql) => {
      throw new Error(`Query não esperada no unit de taskMatching: ${String(sql).toLowerCase().replace(/\s+/g, " ")}`);
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
  const caminho = pathToFileURL(requireModulo.resolve("../src/services/taskMatching.js")).href;
  return import(`${caminho}?etapa17=${Date.now()}`);
}

// Usuário padrão dos unit: Node.js + SQL avancado (média 3.0), 20h/semana,
// função Backend no projeto.
const USUARIO_PADRAO_UNIT = {
  id: 42,
  disponibilidadeHorasSemana: 20,
  habilidades: [
    { habilidadeId: 1, nome: "Node.js", nivel: "avancado" },
    { habilidadeId: 2, nome: "SQL", nivel: "avancado" },
  ],
  funcaoProjeto: { funcaoId: 5, nome: "Backend" },
};

describe("ETAPA 17 — PESOS_TASK_MATCHING e calcularCompatibilidadeTask (unit)", () => {
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

  it("PESOS_TASK_MATCHING documentado em código (40/25/15/10/10)", async () => {
    expect(servico.PESOS_TASK_MATCHING).toEqual({
      habilidades: 0.4,
      dificuldade: 0.25,
      funcao: 0.15,
      disponibilidade: 0.1,
      semResponsavel: 0.1,
    });
    const soma = Object.values(servico.PESOS_TASK_MATCHING).reduce((a, b) => a + b, 0);
    expect(soma).toBe(1);
  });

  it("calcularCompatibilidadeTask devolve compatibilidade 0-100 com motivos pt-BR (transparente)", async () => {
    const task = {
      id: 38,
      titulo: "Criar API de autenticação",
      status: "todo",
      dificuldade: "iniciante",
      responsavel_id: null,
      habilidades: [
        { habilidadeId: 1, nome: "Node.js" },
        { habilidadeId: 2, nome: "SQL" },
        { habilidadeId: 7, nome: "JWT" },
      ],
    };

    const resultado = servico.calcularCompatibilidadeTask(USUARIO_PADRAO_UNIT, task);

    expect(resultado.compatibilidade).toBeGreaterThanOrEqual(0);
    expect(resultado.compatibilidade).toBeLessThanOrEqual(100);
    // 40% habilidades: 2/3 → 27 pts; 25% dificuldade: média 3 ≥ 1 → 25;
    // 15% função: Backend → 15; 10% disponibilidade: 20h → 10;
    // 10% sem responsável → 10. Total 87.
    expect(resultado.compatibilidade).toBe(87);
    // Motivos: frases legíveis pt-BR por fator (critério de aceite: transparente)
    expect(Array.isArray(resultado.motivos)).toBe(true);
    expect(resultado.motivos.every((frase) => typeof frase === "string" && frase.length > 0)).toBe(true);
    expect(resultado.motivos).toContain("Node.js compatível");
    expect(resultado.motivos).toContain("SQL compatível");
    expect(resultado.motivos).toContain("JWT é oportunidade de aprendizado");
    expect(resultado.motivos).toContain("Dificuldade iniciante compatível com seu nível médio (3.0)");
    expect(resultado.motivos).toContain("Função no projeto: Backend");
    expect(resultado.motivos).toContain("Disponibilidade compatível (20h/semana)");
    expect(resultado.motivos).toContain("Task disponível — sem responsável");
  });

  it("task com responsável → fator semResponsável 0 e motivo explícito", async () => {
    const task = {
      id: 40,
      titulo: "Task já atribuída",
      status: "todo",
      dificuldade: "iniciante",
      responsavel_id: 7, // alguém já assumiu
      habilidades: [
        { habilidadeId: 1, nome: "Node.js" },
        { habilidadeId: 2, nome: "SQL" },
        { habilidadeId: 7, nome: "JWT" },
      ],
    };

    const resultado = servico.calcularCompatibilidadeTask(USUARIO_PADRAO_UNIT, task);

    // 87 - 10 (semResponsável) = 77
    expect(resultado.compatibilidade).toBe(77);
    expect(resultado.motivos).toContain("Task já tem responsável");
  });

  it("usuário SEM habilidades → fatores de habilidade/dificuldade zerados, mas 200-compatível (matching não bloqueia)", async () => {
    const usuario = {
      id: 42,
      disponibilidadeHorasSemana: 20,
      habilidades: [],
      funcaoProjeto: { funcaoId: 5, nome: "Backend" },
    };
    const task = {
      id: 9,
      titulo: "Task Python/Docker",
      status: "todo",
      dificuldade: "intermediaria",
      responsavel_id: null,
      habilidades: [
        { habilidadeId: 7, nome: "Python" },
        { habilidadeId: 8, nome: "Docker" },
      ],
    };

    const resultado = servico.calcularCompatibilidadeTask(usuario, task);

    // 0 (habilidades) + 0 (dificuldade sem skills) + 15 + 10 + 10 = 35
    expect(resultado.compatibilidade).toBe(35);
    expect(resultado.motivos).toContain("Python é oportunidade de aprendizado");
    expect(resultado.motivos).toContain("Docker é oportunidade de aprendizado");
    expect(resultado.motivos).toContain("Sem habilidades cadastradas para comparar dificuldade");
    expect(resultado.motivos).toContain("Função no projeto: Backend");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API — GET /projetos/:projetoId/tasks/recomendadas
// ─────────────────────────────────────────────────────────────────────────────
// Queries REAIS do service (normalizadas — conferir src/services/taskMatching.js):
const SQL_PROJETO = /^select criador_id from projetos where id = \? limit 1$/;
const SQL_MEMBRO_ATIVO = /^select me\.funcao_id, me\.funcao as funcao_legada, f\.nome as funcao_nome from membros_equipe me left join funcoes f on f\.id = me\.funcao_id where me\.projeto_id = \? and me\.usuario_id = \? and me\.status = 'ativo' limit 1$/;
const SQL_MEMBRO_MIDDLEWARE = /^select id from membros_equipe where projeto_id = \? and usuario_id = \? limit 1$/;
const SQL_HABILIDADES_USUARIO = /^select hu\.habilidade_id, h\.nome, hu\.nivel from habilidades_usuario hu inner join habilidades h on h\.id = hu\.habilidade_id where hu\.usuario_id = \?$/;
const SQL_USUARIO = /^select id, disponibilidade_horas_semana from usuarios where id = \? limit 1$/;
const SQL_TAREFAS = /^select t\.id, t\.titulo, t\.descricao, t\.status, t\.dificuldade, t\.responsavel_id, t\.excluida_em from tarefas t where t\.projeto_id = \? and t\.responsavel_id is null and t\.excluida_em is null and t\.status not in \('done'\) order by t\.id$/;
const SQL_HABILIDADES_TAREFA = /^select ht\.tarefa_id as tarefaid, ht\.habilidade_id as habilidadeid, h\.nome from habilidades_tarefa ht inner join habilidades h on h\.id = ht\.habilidade_id where ht\.tarefa_id in \(\?\)$/;

const HABILIDADES_USUARIO_PADRAO = [
  { habilidade_id: 1, nome: "Node.js", nivel: "avancado" },
  { habilidade_id: 2, nome: "SQL", nivel: "avancado" },
];
const MEMBRO_ATIVO_PADRAO = [{ funcao_id: 5, funcao_legada: null, funcao_nome: "Backend" }];

// linha de tarefa no shape da query Q5 (aliases reais do SELECT)
function linhaTarefa({ id, titulo = "Task", status = "todo", dificuldade = "iniciante", responsavel_id = null, excluida_em = null }) {
  return { id, titulo, descricao: null, status, dificuldade, responsavel_id, excluida_em };
}

// Pool fake espelhando as queries REAIS de src/services/taskMatching.js +
// as do middleware somenteMembroOuDonoDoProjeto (auth.js). Ordem: específico
// (JOIN funcoes do service) ANTES do genérico do middleware (regra 1).
// membroAtivo = [] + criadorId ≠ usuário → simula vínculo antigo (o
// middleware passa, o service responde 403).
function criarPoolTaskMatching({
  criadorId = 99,
  membroAtivo = MEMBRO_ATIVO_PADRAO,
  habilidadesUsuario = HABILIDADES_USUARIO_PADRAO,
  disponibilidade = 20,
  tarefas = [],
  habilidadesTarefa = [],
} = {}) {
  return criarPoolFake([
    // Q2 — função do membro ATIVO no projeto (service — JOIN funcoes).
    // ESPECÍFICO antes do handler do middleware (ambos tocam membros_equipe).
    { match: (sql) => SQL_MEMBRO_ATIVO.test(sql), resposta: () => [membroAtivo, []] },
    // MW — middleware: vínculo do usuário com o projeto em QUALQUER status
    // (o middleware não filtra status; quem exige 'ativo' é o service)
    { match: (sql) => SQL_MEMBRO_MIDDLEWARE.test(sql), resposta: () => [[{}], []] },
    // Q1/MW — dono do projeto (mesma query no middleware e no service)
    { match: (sql) => SQL_PROJETO.test(sql), resposta: () => [[{ criador_id: criadorId }], []] },
    // Q3 — habilidades do usuário
    { match: (sql) => SQL_HABILIDADES_USUARIO.test(sql), resposta: () => [habilidadesUsuario, []] },
    // Q4 — disponibilidade declarada
    { match: (sql) => SQL_USUARIO.test(sql), resposta: () => [[{ id: 42, disponibilidade_horas_semana: disponibilidade }], []] },
    // Q5 — tasks disponíveis (responsavel_id IS NULL, excluida_em IS NULL, != done)
    { match: (sql) => SQL_TAREFAS.test(sql), resposta: () => [tarefas, []] },
    // Q6 — habilidades das tasks candidatas (parametrizado com ARRAY — IN (?))
    { match: (sql) => SQL_HABILIDADES_TAREFA.test(sql), resposta: () => [habilidadesTarefa, []] },
  ]);
}

describe("ETAPA 17 — GET /projetos/:projetoId/tasks/recomendadas (API)", () => {
  it("(a) 200 com recomendação {taskId, compatibilidade 0-100, motivos[]}", async () => {
    const pool = criarPoolTaskMatching({
      tarefas: [linhaTarefa({ id: 38, titulo: "Criar API de autenticação", dificuldade: "iniciante" })],
      habilidadesTarefa: [
        { tarefaId: 38, habilidadeId: 1, nome: "Node.js" },
        { tarefaId: 38, habilidadeId: 2, nome: "SQL" },
        { tarefaId: 38, habilidadeId: 7, nome: "JWT" },
      ],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Dev" });

    const res = await request(app)
      .get("/projetos/38/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Tasks recomendadas");
    expect(res.body.nItens).toBe(1);
    expect(res.body.dados.recomendacoes).toHaveLength(1);

    const rec = res.body.dados.recomendacoes[0];
    // Shape do contrato (spec §20 + titulo para o frontend)
    expect(rec.taskId).toBe(38);
    expect(rec.titulo).toBe("Criar API de autenticação");
    expect(typeof rec.compatibilidade).toBe("number");
    expect(rec.compatibilidade).toBeGreaterThanOrEqual(0);
    expect(rec.compatibilidade).toBeLessThanOrEqual(100);
    // 2/3 habilidades → 27 + 25 (dificuldade) + 15 (função) + 10 + 10 = 87
    expect(rec.compatibilidade).toBe(87);
    expect(Array.isArray(rec.motivos)).toBe(true);
  });

  it("(b) transparência: motivos é array de strings legíveis (critério de aceite)", async () => {
    const pool = criarPoolTaskMatching({
      tarefas: [linhaTarefa({ id: 38, titulo: "Criar API de autenticação", dificuldade: "iniciante" })],
      habilidadesTarefa: [
        { tarefaId: 38, habilidadeId: 1, nome: "Node.js" },
        { tarefaId: 38, habilidadeId: 2, nome: "SQL" },
        { tarefaId: 38, habilidadeId: 7, nome: "JWT" },
      ],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Dev" });

    const res = await request(app)
      .get("/projetos/38/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const motivos = res.body.dados.recomendacoes[0].motivos;
    expect(Array.isArray(motivos)).toBe(true);
    expect(motivos.length).toBeGreaterThan(0);
    expect(motivos.every((motivo) => typeof motivo === "string" && motivo.trim().length > 0)).toBe(true);
    expect(motivos).toContain("Node.js compatível");
    expect(motivos).toContain("JWT é oportunidade de aprendizado");
    expect(motivos).toContain("Task disponível — sem responsável");
  });

  it("(j) habilidades da task em snake_case (tarefa_id/habilidade_id) ainda pontuam — chaves defensivas", async () => {
    // O mock do security test do irmão entrega rows snake_case (tarefa_id/
    // habilidade_id); o SELECT do service usa aliases camelCase (tarefaId/
    // habilidadeId). O serviço deve aceitar AMBOS (técnica ETAPA 16).
    const pool = criarPoolTaskMatching({
      tarefas: [linhaTarefa({ id: 38, titulo: "Criar API de autenticação", dificuldade: "iniciante" })],
      habilidadesTarefa: [
        { tarefa_id: 38, habilidade_id: 1, nome: "Node.js" },
        { tarefa_id: 38, habilidade_id: 2, nome: "SQL" },
        { tarefa_id: 38, habilidade_id: 7, nome: "JWT" },
      ],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Dev" });

    const res = await request(app)
      .get("/projetos/38/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const rec = res.body.dados.recomendacoes[0];
    // 2/3 habilidades → 27 + 25 + 15 + 10 + 10 = 87 (mesmo do teste (a))
    expect(rec.compatibilidade).toBe(87);
    expect(rec.motivos).toContain("Node.js compatível");
    expect(rec.motivos).toContain("JWT é oportunidade de aprendizado");
  });

  it("(c) task com responsável NÃO aparece (filtro responsavel_id IS NULL no SQL + memória)", async () => {
    const pool = criarPoolTaskMatching({
      tarefas: [
        linhaTarefa({ id: 1, titulo: "Task livre" }),
        linhaTarefa({ id: 2, titulo: "Task com dono", responsavel_id: 7 }),
      ],
      habilidadesTarefa: [
        { tarefaId: 1, habilidadeId: 1, nome: "Node.js" },
        { tarefaId: 2, habilidadeId: 1, nome: "Node.js" },
      ],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Dev" });

    const res = await request(app)
      .get("/projetos/38/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nItens).toBe(1);
    expect(res.body.dados.recomendacoes.map((r) => r.taskId)).toEqual([1]);
    // Contrato SQL: a query de tasks exclui responsáveis
    const tarefas = buscarChamada(pool, SQL_TAREFAS);
    expect(tarefas).toBeDefined();
    expect(tarefas.sql).toContain("t.responsavel_id is null");
  });

  it("(d) task excluída (excluida_em) NÃO aparece (soft-delete ETAPA 10)", async () => {
    const pool = criarPoolTaskMatching({
      tarefas: [
        linhaTarefa({ id: 1, titulo: "Task ativa" }),
        linhaTarefa({ id: 2, titulo: "Task arquivada", excluida_em: "2026-01-01 10:00:00" }),
      ],
      habilidadesTarefa: [
        { tarefaId: 1, habilidadeId: 1, nome: "Node.js" },
        { tarefaId: 2, habilidadeId: 1, nome: "Node.js" },
      ],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Dev" });

    const res = await request(app)
      .get("/projetos/38/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nItens).toBe(1);
    expect(res.body.dados.recomendacoes.map((r) => r.taskId)).toEqual([1]);
    // Contrato SQL: a query de tasks exclui soft-deleted
    const tarefas = buscarChamada(pool, SQL_TAREFAS);
    expect(tarefas).toBeDefined();
    expect(tarefas.sql).toContain("t.excluida_em is null");
  });

  it("(e) sem token → 401 antes de qualquer query", async () => {
    // Pool SEM handlers: qualquer query derruba o teste — prova que o
    // verificarToken barra antes do banco.
    const app = buildApp(criarPoolFake([]));

    const res = await request(app).get("/projetos/38/tasks/recomendadas");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
  });

  it("(f) vínculo antigo ('saiu'/'removido') sem ser dono → 403 (service exige membro ATIVO)", async () => {
    // O middleware deixa passar (existe linha em membros_equipe, qualquer
    // status); o service exige status='ativo' e o usuário não é o dono → 403.
    const pool = criarPoolTaskMatching({ membroAtivo: [], criadorId: 99 });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Ex-membro" });

    const res = await request(app)
      .get("/projetos/38/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Acesso negado: Requer ser membro ativo do projeto");
    // Contrato SQL: o service consulta membros_equipe filtrando status='ativo'
    const membroAtivoQuery = buscarChamada(pool, SQL_MEMBRO_ATIVO);
    expect(membroAtivoQuery).toBeDefined();
    expect(membroAtivoQuery.sql).toContain("me.status = 'ativo'");
    expect(membroAtivoQuery.params).toEqual([38, 42]); // parametrizado (projeto, usuário)
  });

  it("(g) ordena decrescente por compatibilidade (2 tasks mockadas)", async () => {
    const pool = criarPoolTaskMatching({
      tarefas: [
        // ordem do mock DELIBERADAMENTE invertida (id 2 antes do id 1)
        linhaTarefa({ id: 2, titulo: "Task Python/Docker", dificuldade: "avancada" }),
        linhaTarefa({ id: 1, titulo: "Task Node/SQL", dificuldade: "iniciante" }),
      ],
      habilidadesTarefa: [
        // Task 1: Node.js+SQL — todas em comum → habilidades 100%
        { tarefaId: 1, habilidadeId: 1, nome: "Node.js" },
        { tarefaId: 1, habilidadeId: 2, nome: "SQL" },
        // Task 2: Python+Docker — nenhuma em comum
        { tarefaId: 2, habilidadeId: 7, nome: "Python" },
        { tarefaId: 2, habilidadeId: 8, nome: "Docker" },
      ],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Dev" });

    const res = await request(app)
      .get("/projetos/38/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nItens).toBe(2);
    const [primeiro, segundo] = res.body.dados.recomendacoes;
    // Task 1: 40 (2/2) + 25 (média 3 ≥ 1) + 15 + 10 + 10 = 100
    // Task 2: 0 + 25 (média 3 ≥ 3) + 15 + 10 + 10 = 60
    expect(primeiro.taskId).toBe(1);
    expect(primeiro.compatibilidade).toBe(100);
    expect(segundo.taskId).toBe(2);
    expect(segundo.compatibilidade).toBe(60);
    expect(primeiro.compatibilidade).toBeGreaterThan(segundo.compatibilidade);
  });

  it("(h) dono SEM vínculo ativo → 200 (dono gerencia — decisão documentada)", async () => {
    const pool = criarPoolTaskMatching({
      criadorId: 42, // o usuário autenticado É o dono
      membroAtivo: [],
      tarefas: [linhaTarefa({ id: 1, titulo: "Task livre" })],
      habilidadesTarefa: [{ tarefaId: 1, habilidadeId: 1, nome: "Node.js" }],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Dono" });

    const res = await request(app)
      .get("/projetos/38/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(1);
    expect(res.body.dados.recomendacoes[0].taskId).toBe(1);
  });

  it("(i) projetoId não numérico → 400 (request.params é string — pitfall do skill)", async () => {
    const app = buildApp(criarPoolTaskMatching());
    const token = tokenPara({ id: 42, nome: "Dev" });

    const res = await request(app)
      .get("/projetos/abc/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("ID do projeto inválido");
  });
});
