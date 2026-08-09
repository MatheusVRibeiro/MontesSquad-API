// test/matching.security.test.js — ETAPA 16 (Matching Desenvolvedor ↔ Projeto)
//
// Contract-first (skill montesquad-development, references/testes-seguranca-etapas.md):
// este arquivo codifica o CONTRATO da ETAPA 16 e roda contra o código ATUAL.
// Fontes do contrato:
//   • docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md §19 (linhas 1236-1308) — pesos
//     40% habilidades / 25% função / 15% nível / 10% disponibilidade / 10% outras;
//     CRITÉRIO DE ACEITE: "Score precisa ser explicável: API retorna os fatores que
//     justificaram a recomendação"; GET /matching/projetos com verificarToken.
//   • docs/api.md §31 (PUBLICADO PELO AGENTE PAI DURANTE ESTA EXECUÇÃO — pitfall
//     "spec do pai no meio do trabalho", ETAPAS 12/15) — shape operativo:
//     200 { sucesso:true, message:"Projetos recomendados", nItens,
//           dados:{ recomendacoes:[{ projeto:{id,titulo,descricao,status,
//                    visibilidade,tecnologias[]}, score (0-100), fatores:{...},
//                    explicacao[] (frases pt-BR) }] } },
//     ordenação por score DESC, NÃO recomenda projetos onde o usuário já é membro
//     ou dono, sem mudança de banco.
//
// ⚠️ DIVERGÊNCIAS DOCUMENTADAS vs. enunciado da tarefa / exemplo do docs:
//   (a) o docs §31 exemplifica fatores como números ("habilidades": 32); a
//       implementação REAL (src/services/matching.js — pousou na 2ª run) retorna
//       cada fator como OBJETO {pontos, max, percentual, detalhes[]} — pontos é a
//       contribuição (32 = pontos do peso 40), percentual ∈ [0,1]. O contrato
//       asserta o shape implementado (que materializa a intenção do docs: "os
//       percentuais por critério") E adiciona o assert mais forte de explicabilidade:
//       Σ pontos dos 5 fatores === score (comentário do próprio service garante).
//   (b) a tarefa pedia "fatores.habilidades.percentual existe" — satisfeito (e
//       reforçado) pelo shape acima.
//   (c) caso 7 (não recomenda próprios projetos) ADICIONADO por vir na spec §31; a
//       exclusão é feita NA QUERY de candidatos (NOT EXISTS membros_equipe ativo) —
//       veredito via pool.chamadas (regra 5 do skill: o 200 é alcançável com o mock
//       entregando qualquer lista; o CONTRATO é a query excluir membros).
//
// CONTRATO (7 casos):
//   1. SEM token → 401 {sucesso:false, message:"Token não informado", dados:null}
//      (shape direto do verificarToken, src/middlewares/auth.js).
//   2. Autenticado SEM candidatos → 200 {sucesso:true, message:"Projetos
//      recomendados", nItens:0, dados:{recomendacoes:[]}} (matching é
//      recomendação, não autorização — vazio é resposta válida).
//   3. CRITÉRIO DE ACEITE — score EXPLICÁVEL: 1 candidato → item com score [0,100];
//      fatores com as 5 chaves (habilidades/funcao/nivel/disponibilidade/outras),
//      cada uma {pontos [0,max], max=peso, percentual [0,1], detalhes[] de strings};
//      Σ pontos === score; explicacao = array de strings.
//   4. score de TODOS os recomendados dentro de [0,100].
//   5. 2 candidatos → ordenados por score DESC (mais compatível primeiro).
//   6. Token inválido (string lixo) ou assinado com segredo errado → 401
//      "Token inválido ou expirado" (verificarToken; token expirado percorre o
//      MESMO caminho — jwt.verify lança → AppError 401).
//   7. NÃO recomenda projeto em que o usuário já é membro: query de candidatos
//      contém NOT EXISTS membros_equipe parametrizado com o usuário (spec §31).
//
// ESTADO HONESTO (2026-08-09):
//   Run 1 (11:25): 6/6 RED — rota/backend inexistentes (404 default do Express
//     em TODOS os casos, ANTES de middleware/query). git status: só docs/api.md
//     modificado + arquivo novo. Backlog exato da etapa.
//   Run 2 (11:26): backend POUSOU (src/services/matching.js + matching.js +
//     rota routes.js:149 + test/matching.test.js do irmão) → 3 GREEN (1, 2, 6) /
//     4 RED (3, 4, 5, 7) — RED por MOCK DESATUALIZADO (não por bug do backend): a
//     query de candidatos é um JOIN projetos×vagas_projeto×funcoes com NOT EXISTS
//     membros_equipe (uma linha POR VAGA) e o meu handler genérico /from
//     vagas_projeto/ a interceptava devolvendo [] (params[0]=id do usuário) →
//     recomendacoes vazias; além disso as rows de habilidades/funções precisavam
//     de habilidade_id/funcao_id para a interseção do score funcionar.
//   Run 3 (11:27): mocks corrigidos para espelhar as queries REAIS (handlers
//     specific-first) → 6/7 GREEN; caso 7 falhou SÓ na regex do buscarChamada
//     (a normalização do pool colapsa whitespace: "not exists ( select 1 from
//     membros_equipe" — regex ajustada para `\(\s*select`).
//   Run 4 (11:28): 7/7 GREEN — CONTRATO ETAPA 16 100% VERDE contra o backend
//     recém-pousado (rota verificarToken, score explicável com Σ pontos === score,
//     ordenação DESC, exclusão de membros na query).
//
// Pool: handlers espelhando as queries REAIS de src/services/matching.js (lido na
// Run 2): Q1 habilidades_usuario, Q2 funcoes_usuario, Q3 perfil do usuário
// (disponibilidade), Q4 CANDIDATOS (JOIN projetos×vagas×funcoes, específico ANTES
// de qualquer genérico — regra 1), Q5 habilidades_projeto (parametrizado com
// ARRAY de ids — `IN (?)`), fallback `^select` por último (regra 6). Rows com os
// aliases EXATOS que o service lê (habilidade_id/funcao_id/vagaId/funcaoNome/
// nivelDesejado/vagaStatus — pitfall ETAPA 11: mock devolve os aliases do SELECT).
//
// Dados do mock (score esperado: Projeto 1 ≫ Projeto 2):
//   Usuário 5: habilidades Node.js(1)/SQL(2)/JavaScript(3) — niveis avancado/
//   intermediario/avancado; função Backend(10) interesse alto; disponibilidade 20h.
//   Projeto 1 "Sistema Financeiro": habilidades Node.js(1)+SQL(2); vaga Backend(10)
//   aberta nivel_desejado avancado → 40+25+12+10+10 = 97.
//   Projeto 2 "App de Receitas": habilidades Python(4)+React(5); vaga Frontend(11)
//   → 0+0+0+10+10 = 20. (mais compatível = Projeto 1 vem PRIMEIRO).

import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

const USUARIO_ID = 5;

// Q1 — habilidades do usuário (aliases reais: hu.habilidade_id, h.nome, hu.nivel)
const HABILIDADES_USUARIO = [
  { habilidade_id: 1, nome: "Node.js", nivel: "avancado" },
  { habilidade_id: 2, nome: "SQL", nivel: "intermediario" },
  { habilidade_id: 3, nome: "JavaScript", nivel: "avancado" },
];

// Q2 — funções de interesse (aliases reais: fu.funcao_id, f.nome, fu.nivel_interesse)
const FUNCOES_USUARIO = [{ funcao_id: 10, nome: "Backend", nivel_interesse: "alto" }];

// Q4 — candidatos: UMA LINHA POR VAGA ABERTA (JOIN do service; aliases reais com AS)
const CANDIDATOS_POR_VAGA = [
  {
    id: 1,
    titulo: "Sistema Financeiro",
    descricao: "Plataforma de controle financeiro.",
    status: "aberto",
    visibilidade: "publico",
    vagaId: 101,
    funcaoId: 10,
    funcaoNome: "Backend",
    nivelDesejado: "avancado",
    quantidade: 1,
    preenchidas: 0,
    vagaStatus: "aberta",
  },
  {
    id: 2,
    titulo: "App de Receitas",
    descricao: "App de receitas culinárias.",
    status: "aberto",
    visibilidade: "publico",
    vagaId: 102,
    funcaoId: 11,
    funcaoNome: "Frontend",
    nivelDesejado: "intermediario",
    quantidade: 1,
    preenchidas: 0,
    vagaStatus: "aberta",
  },
];

// Q5 — habilidades necessárias dos projetos candidatos (IN (?))
const HABILIDADES_DOS_PROJETOS = {
  1: [
    { projetoId: 1, habilidadeId: 1, nome: "Node.js" },
    { projetoId: 1, habilidadeId: 2, nome: "SQL" },
  ],
  2: [
    { projetoId: 2, habilidadeId: 4, nome: "Python" },
    { projetoId: 2, habilidadeId: 5, nome: "React" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Pool fake do matching — espelha as queries REAIS de src/services/matching.js
// (lido na Run 2). Ordens: específico (Q4 JOIN) ANTES de genéricos (regra 1);
// fallback `^select` por último (regra 6).
function criarPoolMatching({ candidatos = CANDIDATOS_POR_VAGA } = {}) {
  return criarPoolFake([
    // Q1 — habilidades do usuário
    {
      match: (sql) => /from habilidades_usuario/.test(sql),
      resposta: () => [HABILIDADES_USUARIO, []],
    },
    // Q2 — funções de interesse do usuário
    {
      match: (sql) => /from funcoes_usuario/.test(sql),
      resposta: () => [FUNCOES_USUARIO, []],
    },
    // Q3 — perfil do usuário (disponibilidade_horas_semana)
    {
      match: (sql) => /^select .* from usuarios where id = \?/.test(sql),
      resposta: () => [[{ id: USUARIO_ID, disponibilidade_horas_semana: 20 }], []],
    },
    // Q4 — PROJETOS CANDIDATOS (JOIN projetos×vagas_projeto×funcoes + NOT EXISTS
    // membros_equipe). SPECIFIC-FIRST: sem ele, o genérico /from vagas_projeto/
    // interceptaria a query e devolveria lixo (params[0] = id do usuário).
    {
      match: (sql) => /from projetos p inner join vagas_projeto/.test(sql),
      resposta: () => [candidatos, []],
    },
    // Q5 — habilidades necessárias dos projetos candidatos (parametrizado com ARRAY)
    {
      match: (sql) => /from habilidades_projeto/.test(sql),
      resposta: (params) => {
        const ids = Array.isArray(params[0]) ? params[0] : [params[0]];
        return [ids.flatMap((id) => HABILIDADES_DOS_PROJETOS[Number(id)] || []), []];
      },
    },
    // Fallback SELECT (regra 6) — sempre por último
    { match: (sql) => /^select/.test(sql), resposta: () => [[], []] },
  ]);
}

// Extrai o id do projeto de uma recomendação (shape §31: projeto.id aninhado)
function idDoProjeto(item) {
  return (item.projeto && item.projeto.id) ?? item.projetoId ?? item.id;
}

// ─────────────────────────────────────────────────────────────────────────────
describe("ETAPA 16 — GET /matching/projetos (contrato de segurança/shape)", () => {
  it("1. sem token → 401 {sucesso:false, message:'Token não informado', dados:null}", async () => {
    const app = buildApp(criarPoolMatching());

    const res = await request(app).get("/matching/projetos");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
    expect(res.body.dados).toBeNull();
  });

  it("2. autenticado SEM candidatos → 200 {sucesso:true, message:'Projetos recomendados', nItens:0, dados:{recomendacoes:[]}}", async () => {
    const app = buildApp(criarPoolMatching({ candidatos: [] }));
    const token = tokenPara({ id: USUARIO_ID, tipo: "membro" });

    const res = await request(app)
      .get("/matching/projetos")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Projetos recomendados");
    expect(res.body.nItens).toBe(0);
    expect(res.body.dados).toBeTruthy();
    expect(Array.isArray(res.body.dados.recomendacoes)).toBe(true);
    expect(res.body.dados.recomendacoes).toHaveLength(0);
  });

  it("3. CRITÉRIO DE ACEITE — score explicável: 1 candidato → score [0,100], fatores {pontos,max,percentual,detalhes} por critério, Σ pontos === score, explicacao = array de strings", async () => {
    const app = buildApp(criarPoolMatching({ candidatos: [CANDIDATOS_POR_VAGA[0]] }));
    const token = tokenPara({ id: USUARIO_ID, tipo: "membro" });

    const res = await request(app)
      .get("/matching/projetos")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Projetos recomendados");
    expect(res.body.nItens).toBe(1);
    const item = res.body.dados.recomendacoes[0];

    // score numérico 0-100 (pesos 40/25/15/10/10 somam 100 — spec §19/§31)
    expect(typeof item.score).toBe("number");
    expect(item.score).toBeGreaterThanOrEqual(0);
    expect(item.score).toBeLessThanOrEqual(100);

    // CRITÉRIO DE ACEITE — score explicável: fatores com os percentuais/pontos por
    // critério (docs §31: "habilidades": 32 = pontos do peso 40). Cada fator é um
    // OBJETO {pontos [0,max], max=peso, percentual [0,1], detalhes[] de strings} —
    // shape da implementação REAL (src/services/matching.js, comentário do próprio
    // código: "a soma dos pontos exibidos SEMPRE bate com o score").
    expect(item.fatores, "ETAPA 16: item precisa expor fatores").toBeTruthy();
    const pesos = { habilidades: 40, funcao: 25, nivel: 15, disponibilidade: 10, outras: 10 };
    let somaPontos = 0;
    for (const [chave, peso] of Object.entries(pesos)) {
      const fator = item.fatores[chave];
      expect(fator, `ETAPA 16: fatores.${chave} obrigatório`).toBeTruthy();
      expect(typeof fator.pontos, `ETAPA 16: fatores.${chave}.pontos numérico`).toBe("number");
      expect(fator.pontos).toBeGreaterThanOrEqual(0);
      expect(fator.pontos).toBeLessThanOrEqual(peso);
      expect(fator.max).toBe(peso);
      expect(typeof fator.percentual, `ETAPA 16: fatores.${chave}.percentual numérico`).toBe("number");
      expect(fator.percentual).toBeGreaterThanOrEqual(0);
      expect(fator.percentual).toBeLessThanOrEqual(1);
      expect(Array.isArray(fator.detalhes)).toBe(true);
      for (const detalhe of fator.detalhes) {
        expect(typeof detalhe).toBe("string");
      }
      somaPontos += fator.pontos;
    }
    // Explicabilidade forte: a soma dos pontos fator a fator É o score (nunca
    // caixa-preta) — assert direto do critério de aceite da spec §19.
    expect(somaPontos, "ETAPA 16: Σ pontos dos fatores deve ser exatamente o score").toBe(item.score);

    // explicacao: array de strings em pt-BR (pode ser vazio quando não há match)
    expect(Array.isArray(item.explicacao)).toBe(true);
    for (const frase of item.explicacao) {
      expect(typeof frase).toBe("string");
    }

    // shape do projeto aninhado (§31: projeto:{id, titulo, descricao, tecnologias})
    expect(item.projeto).toBeTruthy();
    expect(typeof item.projeto.id).toBe("number");
    expect(typeof item.projeto.titulo).toBe("string");
    expect(Array.isArray(item.projeto.tecnologias)).toBe(true);
    for (const tech of item.projeto.tecnologias) {
      expect(typeof tech).toBe("string");
    }
  });

  it("4. score de TODOS os recomendados dentro de [0,100]", async () => {
    const app = buildApp(criarPoolMatching());
    const token = tokenPara({ id: USUARIO_ID, tipo: "membro" });

    const res = await request(app)
      .get("/matching/projetos")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.dados.recomendacoes.length).toBeGreaterThanOrEqual(1);
    for (const item of res.body.dados.recomendacoes) {
      expect(typeof item.score).toBe("number");
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(100);
    }
  });

  it("5. 2 candidatos → ordenados por score DESC (mais compatível primeiro)", async () => {
    const app = buildApp(criarPoolMatching());
    const token = tokenPara({ id: USUARIO_ID, tipo: "membro" });

    const res = await request(app)
      .get("/matching/projetos")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const recomendacoes = res.body.dados.recomendacoes;
    expect(recomendacoes).toHaveLength(2);
    const [primeiro, segundo] = recomendacoes;
    // Mock desenhado para Projeto 1 (Node.js+SQL + vaga Backend) ≫ Projeto 2
    // (Python+React + vaga Frontend): 97 vs 20 com a fórmula 40/25/15/10/10 —
    // a ordenação DESC é o contrato (§31).
    expect(primeiro.score).toBeGreaterThan(segundo.score);
    expect(
      idDoProjeto(primeiro),
      "ETAPA 16: projeto mais compatível (Sistema Financeiro) deve vir primeiro"
    ).toBe(1);
  });

  it("6. token inválido ou assinado com segredo errado → 401 (verificarToken)", async () => {
    const app = buildApp(criarPoolMatching());
    // Token com segredo errado → jwt.verify lança JsonWebTokenError; token
    // expirado percorre o MESMO caminho (TokenExpiredError → AppError 401)
    const tokenSegredoErrado = jwt.sign(
      { id: USUARIO_ID, email: "usuario@email.com", nome: "Usuário", tipo: "membro" },
      "segredo-errado-teste"
    );

    for (const tokenRuim of ["token-invalido", tokenSegredoErrado]) {
      const res = await request(app)
        .get("/matching/projetos")
        .set("Authorization", `Bearer ${tokenRuim}`);

      expect(res.status).toBe(401);
      expect(res.body.sucesso).toBe(false);
      expect(res.body.message).toBe("Token inválido ou expirado");
    }
  });

  it("7. NÃO recomenda projeto em que o usuário já é membro — query de candidatos exclui via NOT EXISTS membros_equipe (spec §31)", async () => {
    const pool = criarPoolMatching();
    const app = buildApp(pool);
    const token = tokenPara({ id: USUARIO_ID, tipo: "membro" });

    const res = await request(app)
      .get("/matching/projetos")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // A exclusão de projetos onde o usuário já é membro ativo é feita NA QUERY de
    // candidatos (NOT EXISTS membros_equipe parametrizado com o usuário) — veredito
    // via pool.chamadas (regra 5 do skill: o 200 é alcançável com qualquer lista
    // que o mock entregue; o CONTRATO é a query excluir membros).
    // Normalização do pool colapsa whitespace → "not exists ( select 1 from ..."
    const chamada = buscarChamada(pool, /not exists \(\s*select 1 from membros_equipe/);
    expect(
      chamada,
      "ETAPA 16: query de candidatos deve excluir projetos onde o usuário é membro ativo (NOT EXISTS membros_equipe)"
    ).toBeDefined();
    expect(chamada.params[0], "ETAPA 16: NOT EXISTS deve ser parametrizado com o usuário autenticado").toBe(USUARIO_ID);
  });
});
