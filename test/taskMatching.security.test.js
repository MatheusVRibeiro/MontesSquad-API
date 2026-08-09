// test/taskMatching.security.test.js — ETAPA 17 (Matching Desenvolvedor ↔ Task)
//
// Contract-first (skill montesquad-development, references/testes-seguranca-etapas.md):
// este arquivo codifica o CONTRATO da ETAPA 17 e roda contra o código ATUAL.
// Fonte do contrato:
//   • docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md §20 (linhas 1310-1359) —
//     GET /projetos/:projetoId/tasks/recomendadas (verificarToken +
//     somenteMembroOuDonoDoProjeto); retorno [{ taskId, compatibilidade 0-100,
//     motivos: string[] }]; considera habilidades do usuário, habilidades da
//     task, dificuldade, função no projeto, disponibilidade e task SEM
//     responsável; REGRA: "matching é recomendação, não autorização" (não
//     bloquear assumir task por score baixo); CRITÉRIO DE ACEITE:
//     "Recomendação é transparente e não impede escolha manual".
//   • docs/api.md: §32 AINDA NÃO publicado pelo agente pai (grep "recomendadas"
//     vazio em 2026-08-09) — o contrato abaixo usa a spec §20 do plano.
//
// ⚠️ DIVERGÊNCIAS DOCUMENTADAS (shape AINDA não fixado por docs/api.md):
//   (a) a spec §20 mostra o retorno como ARRAY puro de itens; a ETAPA 16
//       aninhou em dados.recomendacoes (objeto). Sem docs §32, o helper
//       extrairRecomendacoes() tolera AMBOS (array direto OU dados.recomendacoes)
//       e o contrato asserta o shape dos ITENS (taskId/compatibilidade/motivos)
//       + nItens === comprimento — quando o backend pousar, conferir o shape
//       real e, se preciso, fixar (nunca afrouxar).
//   (b) message do 200: a spec não fixa o texto ("Tasks recomendadas" é
//       inferência) — o contrato asserta apenas string não vazia.
//   (c) casos 7/8 (task com responsável / task excluída NÃO aparecem): o mock
//       não simula filtro de banco — o veredito sai de pool.chamadas (regra 5
//       do skill, precedente ETAPA 16 caso 7): a query de tarefas DEVE conter
//       `responsavel_id is null` e `excluida_em is null`. Se o backend filtrar
//       em memória (sem filtro no SQL), o assert falha → divergência honesta
//       a reportar.
//
// ⚠️ RESOLVIDAS NA RUN 3 (docs/api.md §32 publicado pelo agente pai NO MEIO da
// execução — alvo móvel, precedente ETAPA 15): §32 fixa `dados.recomendacoes`
// (objeto, não array puro), message EXATA "Tasks recomendadas", item com
// `titulo`, ordenação DESC e LIMIT 10. Os asserts foram ENDURECIDOS para o
// shape §32 (nunca afrouxados) e o caso 9 (LIMIT 10) foi ADICIONADO.
//
// CONTRATO (9 casos):
//   1. SEM token → 401 {sucesso:false, message:"Token não informado", dados:null}
//      (shape direto do verificarToken, src/middlewares/auth.js).
//   2. NÃO-membro (token de outro usuário; mock membros_equipe vazio) → 403
//      "Acesso negado: Requer ser proprietário do projeto ou membro do squad"
//      (somenteMembroOuDonoDoProjeto — 2 queries: SELECT criador_id FROM
//      projetos WHERE id=? LIMIT 1 + SELECT id FROM membros_equipe WHERE
//      projeto_id=? AND usuario_id=? LIMIT 1).
//   3. MEMBRO → 200 {sucesso:true, message:"Tasks recomendadas", nItens:0,
//      dados:{recomendacoes:[]}} (matching é recomendação, não autorização —
//      vazio é resposta válida).
//   4. CRITÉRIO DE ACEITE — TRANSPARÊNCIA: 1 task → taskId numérico, titulo
//      string, compatibilidade ∈ [0,100], motivos = array de strings (pode
//      ser vazio).
//   5. compatibilidade de TODAS as recomendadas ∈ [0,100].
//   6. 2 tasks → ordenadas por compatibilidade DESC (mais compatível primeiro).
//   7. Task com responsavel_id preenchido NÃO aparece — query com
//      `responsavel_id is null` (veredito via pool.chamadas).
//   8. Task excluída (excluida_em preenchido) NÃO aparece — query com
//      `excluida_em is null` (veredito via pool.chamadas).
//   9. LIMITE: no máximo 10 recomendações por chamada (docs/api.md §32,
//      publicado pelo agente pai DURANTE a execução — caso adicionado na
//      Run 3, precedente ETAPA 15).
//
// ESTADO HONESTO (2026-08-09):
//   Run 1 (11:59): git status --short LIMPO (sem src/services/taskMatching.js,
//   sem controller, sem rota "tasks/recomendadas" em src/routes/routes.js) →
//   8 RED / 0 GREEN: Express devolve 404 "Cannot GET" (HTML) em TODOS os
//   casos, ANTES de middleware/query. Backlog exato da etapa.
//   Run 2 (11:59, ALVO MÓVEL — backend pousou DURANTE a execução, padrão
//   ETAPA 11/14/15): src/services/taskMatching.js + src/controllers/
//   taskMatching.js + rota routes.js:160 → 7 GREEN / 1 RED. O RED era MOCK
//   MEU (não bug do backend): a query de habilidades das tasks usa aliases
//   CAMEL (`AS tarefaId, AS habilidadeId` — service lê linha.tarefaId/
//   habilidadeId) e meu mock devolvia snake (tarefa_id/habilidade_id) → a
//   interseção zerava para TODAS as tasks → 101 e 102 empatavam em 60 →
//   ordenação "falhava". Pitfall ETAPA 16: mock desatualizado ≠ bug.
//   Run 3 (12:00): mocks corrigidos para os aliases reais + asserts
//   ENDURECIDOS para o shape §32 (message exata, dados.recomendacoes, titulo)
//   + caso 9 (LIMIT 10) → 9 GREEN / 0 RED — CONTRATO ETAPA 17 100% VERDE.
//
// Pool: handlers espelhando as queries REAIS do middleware (auth.js,
// inalterado) e do service POUSADO na Run 2 (src/services/taskMatching.js:
// Q1 criador_id duplicado, Q2 membros_equipe JOIN funcoes com status='ativo',
// Q3 habilidades_usuario, Q4 usuarios disponibilidade, Q5 tarefas com
// responsavel_id is null + excluida_em is null + status not in done, Q6
// habilidades_tarefa com aliases CAMEL `AS tarefaId, AS habilidadeId` e
// `IN (?)` parametrizado com ARRAY). Matchers de dados são de PREFIXO (sem
// `$`) — o backend pode evoluir colunas/ORDER BY; o contrato asserta SÓ o
// shape público e os filtros via pool.chamadas. Rows entregam os aliases que
// o service LÊ (id/titulo/dificuldade/status/responsavel_id/excluida_em +
// tarefaId/habilidadeId/nome — pitfall ETAPA 11/16: mock devolve os aliases
// do SELECT, não as colunas do schema).

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

const USUARIO_MEMBRO = 5; // membro do squad (token dos casos 3-8)
const DONO_ID = 7; // dono do projeto — NUNCA é o usuário membro (para o
// caminho "membro" passar pela query 2 do middleware, não pelo owner)
const USUARIO_FORA = 99; // usuário sem vínculo (caso 2)

// Habilidades do usuário membro (Q habilidades_usuario — aliases reais do
// matching.js: hu.habilidade_id, h.nome, hu.nivel). IDs consistentes com as
// habilidades das tasks (pitfall ETAPA 16: interseção em memória precisa de
// IDs iguais, senão compatibilidade zera silenciosamente).
const HABILIDADES_USUARIO = [
  { habilidade_id: 1, nome: "Node.js", nivel: "avancado" },
  { habilidade_id: 2, nome: "SQL", nivel: "intermediario" },
  { habilidade_id: 3, nome: "JavaScript", nivel: "avancado" },
];

// Tasks do projeto 1 (Q tarefas). 101 ≫ 102 em compatibilidade (Node.js+SQL
// vs React — usuário não tem React). 103 tem responsável; 104 está excluída —
// NÃO podem aparecer (casos 7/8, veredito via query).
const TAREFAS = [
  {
    id: 101,
    titulo: "Implementar API de login",
    descricao: "Autenticação JWT.",
    status: "todo",
    dificuldade: "intermediaria",
    responsavel_id: null,
    excluida_em: null,
  },
  {
    id: 102,
    titulo: "Tela de receitas",
    descricao: "Frontend de receitas.",
    status: "todo",
    dificuldade: "iniciante",
    responsavel_id: null,
    excluida_em: null,
  },
  {
    id: 103,
    titulo: "Task já assumida",
    descricao: "Já tem responsável.",
    status: "doing",
    dificuldade: "intermediaria",
    responsavel_id: 7,
    excluida_em: null,
  },
  {
    id: 104,
    titulo: "Task excluída",
    descricao: "Soft-deletada.",
    status: "todo",
    dificuldade: "intermediaria",
    responsavel_id: null,
    excluida_em: "2026-08-01 10:00:00",
  },
];

// Habilidades das tasks (Q habilidades_tarefa JOIN habilidades — aliases REAIS
// do service pousado: `AS tarefaId, AS habilidadeId, h.nome` — pitfall ETAPA
// 11/16: o mock devolve os aliases que o service LÊ (camelCase), não as
// colunas do schema; snake_case aqui zera a interseção silenciosamente).
const HABILIDADES_DAS_TAREFAS = {
  101: [
    { tarefaId: 101, habilidadeId: 1, nome: "Node.js" },
    { tarefaId: 101, habilidadeId: 2, nome: "SQL" },
  ],
  102: [{ tarefaId: 102, habilidadeId: 5, nome: "React" }],
  103: [{ tarefaId: 103, habilidadeId: 1, nome: "Node.js" }],
  104: [{ tarefaId: 104, habilidadeId: 2, nome: "SQL" }],
};

// ─────────────────────────────────────────────────────────────────────────────
// Pool fake do matching de tasks — espelha o middleware (auth.js) e as queries
// ESPERADAS do service futuro (src/services/taskMatching.js — ainda não
// existe). Ordens: específico (middleware) ANTES de genéricos (regra 1);
// fallback `^select` por último (regra 6).
function criarPoolTaskMatching({
  donoId = DONO_ID,
  membroIds = [], // ids de usuários com vínculo ativo no squad
  projetoExiste = true,
  tarefas = [], // rows de tarefas (ordem = o que o SELECT devolve)
} = {}) {
  return criarPoolFake([
    // somenteMembroOuDonoDoProjeto — SELECT criador_id (LIMIT 1).
    // Simula a coerção do MySQL: id não numérico não casa linha → 404
    // "Projeto não encontrado" no middleware (nunca 500).
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: (params) => {
        const pId = Number(params[0]);
        const idValido = Number.isInteger(pId) && pId > 0;
        return projetoExiste && idValido ? [[{ criador_id: donoId }], []] : [[], []];
      },
    },
    // somenteMembroOuDonoDoProjeto — SELECT vínculo (LIMIT 1); dono passa sem
    // chegar aqui (auth.js: criador_id === token.id → next() antes da query 2)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? limit 1$/.test(sql),
      resposta: (params) => (membroIds.includes(Number(params[1])) ? [[{ id: 7 }], []] : [[], []]),
    },
    // Service — SELECT das tarefas candidatas (matcher de PREFIXO, sem `$`:
    // o backend pode evoluir colunas/ORDER BY; os filtros responsavel_id is
    // null / excluida_em is null são assertados via pool.chamadas nos casos
    // 7/8). ⚠️ Deve vir ANTES de qualquer genérico de tabela.
    {
      match: (sql) => /from tarefas/.test(sql),
      resposta: () => [tarefas, []],
    },
    // Q habilidades do usuário (matching.js usa o mesmo shape)
    {
      match: (sql) => /from habilidades_usuario/.test(sql),
      resposta: () => [HABILIDADES_USUARIO, []],
    },
    // Q habilidades das tasks — pode ser parametrizada com ARRAY (`IN (?)`,
    // pitfall ETAPA 16): tolerar Array.isArray(params[0])
    {
      match: (sql) => /from habilidades_tarefa/.test(sql),
      resposta: (params) => {
        const ids = Array.isArray(params[0]) ? params[0] : [params[0]];
        return [ids.flatMap((id) => HABILIDADES_DAS_TAREFAS[Number(id)] || []), []];
      },
    },
    // Q perfil do usuário (disponibilidade — spec §20 "disponibilidade")
    {
      match: (sql) => /from usuarios where id = \?/.test(sql),
      resposta: () => [[{ id: USUARIO_MEMBRO, disponibilidade_horas_semana: 20 }], []],
    },
    // Q função do membro no projeto (spec §20 "função no projeto") — genérico
    // de membros_equipe DEPOIS do handler exato do middleware (regra 1)
    {
      match: (sql) => /from membros_equipe/.test(sql),
      resposta: () => [[{ funcao_id: 10, funcao_nome: "Backend" }], []],
    },
    // Fallback SELECT (regra 6) — sempre por último
    { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
  ]);
}

// Shape FIXADO pelo docs/api.md §32 (publicado na Run 3): o array de
// recomendações fica em `dados.recomendacoes` (mesmo padrão ETAPA 16).
function extrairRecomendacoes(dados) {
  return dados && Array.isArray(dados.recomendacoes) ? dados.recomendacoes : [];
}

// ─────────────────────────────────────────────────────────────────────────────
describe("ETAPA 17 — GET /projetos/:projetoId/tasks/recomendadas (contrato de segurança/shape)", () => {
  it("1. sem token → 401 {sucesso:false, message:'Token não informado', dados:null}", async () => {
    const app = buildApp(criarPoolTaskMatching());

    const res = await request(app).get("/projetos/1/tasks/recomendadas");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });

  it("2. NÃO-membro (outro usuário, membros_equipe vazio) → 403 (somenteMembroOuDonoDoProjeto)", async () => {
    const app = buildApp(criarPoolTaskMatching({ membroIds: [] }));
    const token = tokenPara({ id: USUARIO_FORA, tipo: "membro" });

    const res = await request(app)
      .get("/projetos/1/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Acesso negado: Requer ser proprietário do projeto ou membro do squad");
    expect(res.body.dados).toBeNull();
  });

  it("3. MEMBRO → 200 {sucesso:true, message, nItens, dados} (pode ser vazio — 200 com nItens 0; matching é recomendação, não autorização)", async () => {
    const app = buildApp(criarPoolTaskMatching({ membroIds: [USUARIO_MEMBRO], tarefas: [] }));
    const token = tokenPara({ id: USUARIO_MEMBRO, tipo: "membro" });

    const res = await request(app)
      .get("/projetos/1/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    // §32 fixa a message exata — endurecido na Run 3
    expect(res.body.message).toBe("Tasks recomendadas");
    expect(res.body.nItens).toBe(0);
    // §32 fixa dados.recomendacoes (objeto, não array puro)
    expect(Array.isArray(res.body.dados.recomendacoes)).toBe(true);
    expect(res.body.dados.recomendacoes).toHaveLength(0);
  });

  it("4. CRITÉRIO DE ACEITE — TRANSPARÊNCIA: 1 task → taskId numérico, compatibilidade [0,100], motivos = array de strings (pode ser vazio)", async () => {
    const app = buildApp(
      criarPoolTaskMatching({ membroIds: [USUARIO_MEMBRO], tarefas: [TAREFAS[0]] })
    );
    const token = tokenPara({ id: USUARIO_MEMBRO, tipo: "membro" });

    const res = await request(app)
      .get("/projetos/1/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Tasks recomendadas");
    expect(res.body.nItens).toBe(1);
    const item = extrairRecomendacoes(res.body.dados)[0];

    // taskId numérico (spec §20: "taskId": 38; §32 item.taskId)
    expect(typeof item.taskId, "ETAPA 17: taskId numérico obrigatório").toBe("number");

    // titulo string (§32 — o consumidor precisa do nome para exibir)
    expect(typeof item.titulo).toBe("string");
    expect(item.titulo.length).toBeGreaterThan(0);

    // compatibilidade 0-100 (spec §20: "compatibilidade": 95)
    expect(typeof item.compatibilidade).toBe("number");
    expect(item.compatibilidade).toBeGreaterThanOrEqual(0);
    expect(item.compatibilidade).toBeLessThanOrEqual(100);

    // CRITÉRIO DE ACEITE — recomendação TRANSPARENTE: motivos = array de
    // strings em pt-BR (pode ser vazio quando não há match — o contrato é o
    // campo existir e ser legível, não o conteúdo)
    expect(Array.isArray(item.motivos), "ETAPA 17: motivos (array) obrigatório — critério de aceite 'Recomendação é transparente'").toBe(true);
    for (const motivo of item.motivos) {
      expect(typeof motivo).toBe("string");
    }
  });

  it("5. compatibilidade de TODAS as recomendadas dentro de [0,100]", async () => {
    const app = buildApp(
      criarPoolTaskMatching({ membroIds: [USUARIO_MEMBRO], tarefas: [TAREFAS[0], TAREFAS[1]] })
    );
    const token = tokenPara({ id: USUARIO_MEMBRO, tipo: "membro" });

    const res = await request(app)
      .get("/projetos/1/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const recomendacoes = extrairRecomendacoes(res.body.dados);
    expect(recomendacoes.length).toBeGreaterThanOrEqual(1);
    for (const item of recomendacoes) {
      expect(typeof item.compatibilidade).toBe("number");
      expect(item.compatibilidade).toBeGreaterThanOrEqual(0);
      expect(item.compatibilidade).toBeLessThanOrEqual(100);
    }
  });

  it("6. 2 tasks → ordenadas por compatibilidade DESC (mais compatível primeiro)", async () => {
    // Mock devolve [102, 101] (ordem "do banco"); o service DEVE ordenar por
    // compatibilidade DESC — 101 (Node.js+SQL) ≫ 102 (React, usuário não tem)
    const app = buildApp(
      criarPoolTaskMatching({ membroIds: [USUARIO_MEMBRO], tarefas: [TAREFAS[1], TAREFAS[0]] })
    );
    const token = tokenPara({ id: USUARIO_MEMBRO, tipo: "membro" });

    const res = await request(app)
      .get("/projetos/1/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const recomendacoes = extrairRecomendacoes(res.body.dados);
    expect(recomendacoes).toHaveLength(2);
    const [primeira, segunda] = recomendacoes;
    expect(primeira.compatibilidade).toBeGreaterThanOrEqual(segunda.compatibilidade);
    expect(
      primeira.taskId,
      "ETAPA 17: task mais compatível (Implementar API de login, Node.js+SQL) deve vir primeiro"
    ).toBe(101);
  });

  it("7. Task com responsavel_id preenchido NÃO aparece — query com `responsavel_id is null` (spec §20: 'task sem responsável')", async () => {
    const pool = criarPoolTaskMatching({ membroIds: [USUARIO_MEMBRO], tarefas: TAREFAS });
    const app = buildApp(pool);
    const token = tokenPara({ id: USUARIO_MEMBRO, tipo: "membro" });

    const res = await request(app)
      .get("/projetos/1/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // O mock não simula filtro de banco — o CONTRATO é a query excluir tasks
    // com responsável (regra 5 do skill; mesmo padrão ETAPA 16 caso 7).
    const chamada = buscarChamada(pool, /responsavel_id is null/);
    expect(
      chamada,
      "ETAPA 17: query de tarefas deve excluir tasks com responsável (responsavel_id is null)"
    ).toBeDefined();
  });

  it("8. Task excluída (excluida_em preenchido) NÃO aparece — query com `excluida_em is null` (soft-delete ETAPA 10)", async () => {
    const pool = criarPoolTaskMatching({ membroIds: [USUARIO_MEMBRO], tarefas: TAREFAS });
    const app = buildApp(pool);
    const token = tokenPara({ id: USUARIO_MEMBRO, tipo: "membro" });

    const res = await request(app)
      .get("/projetos/1/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Mesmo padrão do caso 7: o contrato é a query excluir tasks arquivadas
    // (excluida_em is null — soft-delete da ETAPA 10).
    const chamada = buscarChamada(pool, /excluida_em is null/);
    expect(
      chamada,
      "ETAPA 17: query de tarefas deve excluir tasks arquivadas (excluida_em is null)"
    ).toBeDefined();
  });

  it("9. LIMITE: no máximo 10 recomendações por chamada (docs/api.md §32, publicado pelo agente pai na Run 3)", async () => {
    // 12 tasks candidatas com as MESMAS skills (Node.js+SQL) — todas com
    // compatibilidade alta; o LIMIT 10 é o contrato, não a ordenação.
    const muitas = Array.from({ length: 12 }, (_, i) => ({
      ...TAREFAS[0],
      id: 1000 + i,
      titulo: `Task ${i + 1}`,
    }));
    const muitasHabilidades = {};
    for (const t of muitas) {
      muitasHabilidades[t.id] = [
        { tarefaId: t.id, habilidadeId: 1, nome: "Node.js" },
        { tarefaId: t.id, habilidadeId: 2, nome: "SQL" },
      ];
    }
    const pool = criarPoolFake([
      {
        match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
        resposta: () => [[{ criador_id: DONO_ID }], []],
      },
      {
        match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? limit 1$/.test(sql),
        resposta: () => [[{ id: 7 }], []],
      },
      { match: (sql) => /from tarefas/.test(sql), resposta: () => [muitas, []] },
      { match: (sql) => /from habilidades_usuario/.test(sql), resposta: () => [HABILIDADES_USUARIO, []] },
      {
        match: (sql) => /from habilidades_tarefa/.test(sql),
        resposta: (params) => {
          const ids = Array.isArray(params[0]) ? params[0] : [params[0]];
          return [ids.flatMap((id) => muitasHabilidades[Number(id)] || []), []];
        },
      },
      { match: (sql) => /from usuarios where id = \?/.test(sql), resposta: () => [[{ id: USUARIO_MEMBRO, disponibilidade_horas_semana: 20 }], []] },
      { match: (sql) => /from membros_equipe/.test(sql), resposta: () => [[{ funcao_id: 10, funcao_nome: "Backend" }], []] },
      { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
    ]);
    const app = buildApp(pool);
    const token = tokenPara({ id: USUARIO_MEMBRO, tipo: "membro" });

    const res = await request(app)
      .get("/projetos/1/tasks/recomendadas")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const recomendacoes = extrairRecomendacoes(res.body.dados);
    expect(recomendacoes.length).toBeGreaterThan(0);
    // docs §32: "no máximo 10 recomendações por chamada"
    expect(recomendacoes.length).toBeLessThanOrEqual(10);
    expect(res.body.nItens).toBe(recomendacoes.length);
  });
});