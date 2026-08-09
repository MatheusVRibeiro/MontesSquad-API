// test/eventosProjeto.security.test.js — ETAPA 15 (Timeline de atividade do projeto)
//
// Contract-first (skill montesquad-development, references/testes-seguranca-etapas.md):
// este arquivo codifica o CONTRATO da ETAPA 15 (docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md
// §18) e roda contra o controller/rotas ATUAIS. Critério de aceite da spec:
//   "Timeline não substitui logs técnicos; é uma visão de produto para usuários."
//
// Spec §18:
//   - Tabela nova `eventos_projeto` (id, projeto_id, usuario_id NULL, tipo,
//     entidade_tipo NULL, entidade_id NULL, titulo, metadados JSON NULL, criado_em).
//   - Backend: src/services/eventosProjeto.js + src/controllers/eventosProjeto.js.
//   - Endpoint: GET /projetos/:projetoId/eventos (auth: verificarToken +
//     somenteMembroOuDonoDoProjeto — mesmo gate das tarefas/mensagens/vagas).
//   - Tipos de evento: membro_entrou, membro_saiu, task_criada, task_assumida,
//     task_abandonada, commit_detectado, pr_aberto, pr_mergeado, task_concluida,
//     reavaliacao.
//
// Contrato deste arquivo (8 casos de segurança/contrato):
//   1. sem token → 401 {sucesso:false, message, dados:null} (verificarToken);
//   2. NÃO-membro → 403 (somenteMembroOuDonoDoProjeto — 2 queries: SELECT
//      criador_id FROM projetos WHERE id=? LIMIT 1 + SELECT id FROM
//      membros_equipe WHERE projeto_id=? AND usuario_id=? LIMIT 1);
//   3. MEMBRO → 200 {sucesso:true, message, nItens:0, dados:[]} (vazio);
//   4. DONO → 200 com dados — shape público de cada item: id, tipo, titulo,
//      criado_em, usuario_nome (visão de produto, NÃO logs técnicos);
//   5. projeto inexistente → 404 (o gate valida existência no middleware:
//      owner SELECT vazio → 404 "Projeto não encontrado" — conferir no
//      relatório se o controller validar em outro lugar);
//   6. id não numérico ('abc') → 400 OU 404, NUNCA 500 (reportar qual —
//      hoje o middleware 404a por coerção do MySQL: WHERE id='abc' não casa);
//   7. visitante (sem vínculo) em projeto PRIVADO (visibilidade='privado',
//      ETAPA 14) → 403 — usuário fora do projeto não vê dados técnicos;
//   8. ordenação: eventos devolvidos DESC (mais recente primeiro) — assert na
//      ordem da resposta E no SQL (ORDER BY ... criado_em ... DESC via pool.chamadas);
//   9. limite: no máximo os 50 eventos mais recentes (docs/api.md §30, atualizado
//      pelo agente pai em 2026-08-09) — SELECT com LIMIT 50 OU resposta cortada.
//
// HISTÓRICO HONESTO (2026-08-09):
//   Run 1 (11:02, estado do repo: `git status --short` limpo; NENHUMA rota
//   /projetos/:projetoId/eventos em src/routes/routes.js; sem
//   src/services/eventosProjeto.js nem src/controllers/eventosProjeto.js):
//   8 RED / 0 GREEN — rota inexistente, Express devolve 404 "Cannot GET"
//   (HTML; index.js não tem handler 404 JSON). Perfil dos RED:
//     casos 1, 2, 7, 3, 4, 8 → "expected 404 to be 401/403/200" (status);
//     caso 5 → status 404 CASOU por coincidência, falha no shape do body
//       (res.body.sucesso undefined — body HTML vazio);
//     caso 6 → status [400,404] CASOU por coincidência, falha no shape.
//   Run 2 (11:04): caso 9 (LIMIT 50) adicionado após o agente pai publicar a
//   spec §30 em docs/api.md (98 linhas novas; `M docs/api.md` no git status) —
//   contrato da ETAPA 15 agora em 9 casos. Backend segue ausente → 9 RED.
//   Run 3 (11:07, ALVO MÓVEL — backend pousou DURANTE a execução, padrão
//   ETAPA 11/14): src/services/eventosProjeto.js + src/controllers/eventosProjeto.js
//   + rota routes.js:165 (verificarToken + somenteMembroOuDonoDoProjeto).
//   Contrato real conferido: service emite `SELECT e.*, u.nome AS usuario_nome
//   FROM eventos_projeto e LEFT JOIN usuarios u ... WHERE e.projeto_id = ?
//   ORDER BY e.criado_em DESC, e.id DESC LIMIT ?` (limite parametrizado, default
//   50, cap 200 via query string); controller valida id numérico (→ 400
//   "ID do projeto inválido", inalcançável p/ 'abc' pois o middleware 404a antes
//   pela coerção do MySQL) e NÃO valida existência — o 404 vem do middleware
//   (owner SELECT vazio → "Projeto não encontrado"); shape 200:
//   {sucesso:true, message:"Eventos do projeto", nItens, dados}. → **9 GREEN /
//   0 RED — CONTRATO ETAPA 15 100% VERDE.**
//   Re-rodar após o backend pousar (mesmo padrão ETAPA 11/14 — alvo móvel).
//
// Pool: handlers espelhando as queries REAIS do middleware (auth.js, inalterado)
// e a query esperada do controller futuro (SELECT ... FROM eventos_projeto ...).
// O matcher do SELECT de eventos é de PREFIXO (sem `$`): o backend pode
// acrescentar colunas/ORDER BY — o contrato asserta SÓ o shape público e o
// ORDER BY via pool.chamadas (regra 5/6 do skill).

import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// ─────────────────────────────────────────────────────────────────────────────
// Pool da timeline de eventos — espelha somenteMembroOuDonoDoProjeto (auth.js:
// SELECT criador_id LIMIT 1 + SELECT id FROM membros_equipe LIMIT 1) e o SELECT
// esperado do controller (src/controllers/eventosProjeto.js — ainda não existe).
// A row do owner inclui `visibilidade` (coluna ETAPA 14) para documentar o
// contexto de projeto privado; o middleware lê só criador_id — chave extra no
// mock é inofensiva (mesmo padrão da ETAPA 14).
function criarPoolEventos({
  donoId = 5,
  membroIds = [], // ids de usuários com vínculo ativo no squad
  projetoExiste = true,
  visibilidade = "publico",
  eventos = [], // rows de eventos_projeto (ordem = o que o SELECT devolve)
} = {}) {
  return criarPoolFake([
    // somenteMembroOuDonoDoProjeto — SELECT criador_id (LIMIT 1).
    // Simula a coerção do MySQL: id não numérico (ex.: 'abc') não casa linha →
    // 404 "Projeto não encontrado" no middleware (caso 6 NUNCA vira 500).
    {
      match: (sql) => /^select criador_id from projetos where id = \? limit 1$/.test(sql),
      resposta: (params) => {
        const pId = Number(params[0]);
        const idValido = Number.isInteger(pId) && pId > 0;
        return projetoExiste && idValido ? [[{ criador_id: donoId, visibilidade }], []] : [[], []];
      },
    },
    // somenteMembroOuDonoDoProjeto — SELECT vínculo (LIMIT 1); dono passa sem
    // chegar aqui (auth.js: criador_id === token.id → next() antes da query 2)
    {
      match: (sql) => /^select id from membros_equipe where projeto_id = \? and usuario_id = \? and status = 'ativo' limit 1$/.test(sql),
      resposta: (params) => (membroIds.includes(Number(params[1])) ? [[{ id: 7 }], []] : [[], []]),
    },
    // Controller — SELECT da timeline (matcher de PREFIXO, sem `$`: o backend
    // pode evoluir colunas/ORDER BY; a ordenação DESC é assertada via
    // pool.chamadas no caso 8, não aqui)
    {
      match: (sql) => /from eventos_projeto/.test(sql),
      resposta: () => [eventos, []],
    },
    // Fallback SELECT (regra 6 do skill) — queries auxiliares de checagem que o
    // controller futuro possa emitir; SEMPRE por último. UPDATE/DELETE/INSERT
    // continuam estritos (write inesperado = teste falha alto).
    { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
  ]);
}

// Eventos de exemplo — visão de PRODUTO (id, tipo, titulo, criado_em,
// usuario_nome). As rows entregam snake E camel do alias do usuário (pitfall
// ETAPA 14: não se sabe o alias que o controller futuro vai ler); o contrato
// asserta SÓ o shape público (snake, definido no enunciado da ETAPA 15).
const EVENTO_RECENTE = {
  id: 2,
  projeto_id: 1,
  usuario_id: 5,
  tipo: "task_concluida",
  entidade_tipo: "tarefa",
  entidade_id: "11",
  titulo: "Task 'Integrar pagamento' concluída",
  criado_em: "2026-08-09T14:00:00.000Z",
  usuario_nome: "Dono",
  usuarioNome: "Dono",
};

const EVENTO_ANTIGO = {
  id: 1,
  projeto_id: 1,
  usuario_id: 9,
  tipo: "membro_entrou",
  entidade_tipo: null,
  entidade_id: null,
  titulo: "Matheus entrou no squad",
  criado_em: "2026-08-09T09:00:00.000Z",
  usuario_nome: "Membro",
  usuarioNome: "Membro",
};

// ─────────────────────────────────────────────────────────────────────────────
// Caso 1 — autenticação obrigatória
describe("ETAPA 15 — GET /projetos/:projetoId/eventos: autenticação", () => {
  it("sem token → 401 {sucesso:false, message, dados:null} (verificarToken)", async () => {
    const app = buildApp(criarPoolEventos());

    const res = await request(app).get("/projetos/1/eventos");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBe(null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Casos 2 e 7 — autorização: usuário fora do projeto não vê a timeline
describe("ETAPA 15 — GET /projetos/:projetoId/eventos: autorização (somenteMembroOuDonoDoProjeto)", () => {
  it("por NÃO-membro → 403 (middleware barra antes do controller consultar eventos)", async () => {
    const app = buildApp(criarPoolEventos({ donoId: 5, membroIds: [] }));
    const token = tokenPara({ id: 9, tipo: "membro" });

    const res = await request(app).get("/projetos/1/eventos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Acesso negado: Requer ser proprietário do projeto ou membro do squad");
    expect(res.body.dados).toBe(null);
  });

  it("por visitante (id=99, sem vínculo) em projeto PRIVADO (visibilidade='privado', ETAPA 14) → 403 — usuário fora do projeto não vê dados técnicos", async () => {
    const app = buildApp(criarPoolEventos({ donoId: 5, membroIds: [], visibilidade: "privado" }));
    const token = tokenPara({ id: 99, tipo: "membro" });

    const res = await request(app).get("/projetos/1/eventos").set("Authorization", `Bearer ${token}`);

    // O gate não consulta visibilidade: quem não é dono nem membro ativo é
    // barrado SEMPRE (projeto privado ou público) — regra ETAPA 14: usuário
    // fora do projeto não recebe dados técnicos pela API.
    expect(res.status).toBe(403);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.dados).toBe(null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Casos 3 e 4 — acesso autorizado e shape público (visão de produto)
describe("ETAPA 15 — GET /projetos/:projetoId/eventos: membro/dono autorizados", () => {
  it("por MEMBRO (vínculo ativo) → 200 {sucesso:true, message, nItens:0, dados:[]} quando não há eventos", async () => {
    const pool = criarPoolEventos({ donoId: 5, membroIds: [9] });
    const app = buildApp(pool);
    const token = tokenPara({ id: 9, tipo: "membro" });

    const res = await request(app).get("/projetos/1/eventos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(typeof res.body.message).toBe("string");
    expect(res.body.nItens).toBe(0);
    expect(res.body.dados).toEqual([]);
    // Contrato do gate: o membro passou pela query 2 do middleware (vínculo)
    expect(buscarChamada(pool, /^select id from membros_equipe where projeto_id/)).toBeDefined();
  });

  it("por DONO → 200 com dados — shape público de cada item: id, tipo, titulo, criado_em, usuario_nome", async () => {
    const app = buildApp(criarPoolEventos({ donoId: 5, eventos: [EVENTO_RECENTE, EVENTO_ANTIGO] }));
    const token = tokenPara({ id: 5, tipo: "membro" });

    const res = await request(app).get("/projetos/1/eventos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(2);
    expect(Array.isArray(res.body.dados)).toBe(true);
    expect(res.body.dados.length).toBe(2);
    for (const item of res.body.dados) {
      // Contrato ETAPA 15: campos da visão de produto existem (assert explícito)
      expect(item, "ETAPA 15: item da timeline deve ter id").toHaveProperty("id");
      expect(item, "ETAPA 15: item da timeline deve ter tipo").toHaveProperty("tipo");
      expect(item, "ETAPA 15: item da timeline deve ter titulo").toHaveProperty("titulo");
      expect(item, "ETAPA 15: item da timeline deve ter criado_em").toHaveProperty("criado_em");
      expect(item, "ETAPA 15: item da timeline deve ter usuario_nome").toHaveProperty("usuario_nome");
      expect(typeof item.tipo).toBe("string");
      expect(typeof item.titulo).toBe("string");
      expect(typeof item.criado_em).toBe("string");
    }
    // Valor real chega ao cliente (não default silencioso do fallback — regra 6/12)
    expect(res.body.dados[0].tipo).toBe("task_concluida");
    expect(res.body.dados[0].titulo).toBe("Task 'Integrar pagamento' concluída");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Casos 5 e 6 — validação de existência/identificador
describe("ETAPA 15 — GET /projetos/:projetoId/eventos: projeto inexistente / id inválido", () => {
  it("GET /projetos/999999/eventos por dono → 404 (projeto não existe — o gate valida existência no middleware: owner SELECT vazio)", async () => {
    const app = buildApp(criarPoolEventos({ projetoExiste: false }));
    const token = tokenPara({ id: 5, tipo: "membro" });

    const res = await request(app).get("/projetos/999999/eventos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Projeto não encontrado");
    expect(res.body.dados).toBe(null);
  });

  it("GET /projetos/abc/eventos (id não numérico) → 400 OU 404, NUNCA 500", async () => {
    const app = buildApp(criarPoolEventos());
    const token = tokenPara({ id: 5, tipo: "membro" });

    const res = await request(app).get("/projetos/abc/eventos").set("Authorization", `Bearer ${token}`);

    // Hoje (middleware atual): 404 "Projeto não encontrado" — o mock simula a
    // coerção do MySQL (WHERE id='abc' não casa linha). Se o backend futuro
    // adicionar validação numérica explícita → 400. Ambas dentro do contrato;
    // 500 jamais (assert abaixo garante).
    expect([400, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
    expect(res.body.sucesso).toBe(false);
    expect(typeof res.body.message).toBe("string");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso 8 — ordenação: mais recente primeiro (visão de produto)
describe("ETAPA 15 — GET /projetos/:projetoId/eventos: ordenação DESC", () => {
  it("2 eventos com criado_em diferentes → devolvidos DESC (mais recente primeiro), com ORDER BY criado_em DESC no SQL", async () => {
    const pool = criarPoolEventos({ donoId: 5, eventos: [EVENTO_RECENTE, EVENTO_ANTIGO] });
    const app = buildApp(pool);
    const token = tokenPara({ id: 5, tipo: "membro" });

    const res = await request(app).get("/projetos/1/eventos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.dados.length).toBe(2);
    // Ordem da resposta: mais recente primeiro
    expect(res.body.dados[0].id).toBe(2);
    expect(res.body.dados[1].id).toBe(1);
    expect(
      new Date(res.body.dados[0].criado_em).getTime() > new Date(res.body.dados[1].criado_em).getTime()
    ).toBe(true);
    // Ordenação pedida ao banco (veredito via pool.chamadas — regra 5 do skill)
    const chamada = buscarChamada(pool, /order by .*criado_em.*desc/);
    expect(
      chamada,
      "ETAPA 15: SELECT da timeline deve pedir ORDER BY criado_em DESC (mais recente primeiro)"
    ).toBeDefined();
  });

  it("limite: no máximo os 50 eventos mais recentes (docs/api.md §30) — SELECT com LIMIT 50 OU resposta cortada", async () => {
    const muitosEventos = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      tipo: "task_criada",
      titulo: `Task ${i + 1} criada`,
      criado_em: new Date(2026, 7, 9, 8, 0, i).toISOString(),
      usuario_nome: "Dono",
      usuarioNome: "Dono",
    }));
    const pool = criarPoolEventos({ donoId: 5, eventos: muitosEventos });
    const app = buildApp(pool);
    const token = tokenPara({ id: 5, tipo: "membro" });

    const res = await request(app).get("/projetos/1/eventos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // O mock não aplica LIMIT (devolve as 60 rows): se o controller confia no
    // SQL, a resposta virá com 60 e o contrato é satisfeito pelo LIMIT ? no
    // SELECT (veredito via pool.chamadas — regra 5/8 do skill: SQL parametrizado,
    // o valor 50 vai em params); se corta em JS, <= 50 na resposta.
    const chamada = buscarChamada(pool, /limit \?/);
    const dentroDoLimite = res.body.dados.length <= 50;
    expect(
      dentroDoLimite || Boolean(chamada),
      "ETAPA 15: timeline limitada aos 50 eventos mais recentes (spec §30)"
    ).toBe(true);
    if (!dentroDoLimite) {
      expect(
        chamada,
        "ETAPA 15: com >50 eventos, o SELECT DEVE pedir LIMIT (resposta não cortada)"
      ).toBeDefined();
      expect(chamada.params[1]).toBe(50);
    }
  });
});
