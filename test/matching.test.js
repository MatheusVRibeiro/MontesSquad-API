// test/matching.test.js — ETAPA 16 (Matching Desenvolvedor ↔ Projeto)
//
// Cobertura:
//   - Unit (service src/services/matching.js):
//     PESOS_MATCHING documentado em código (40/25/15/10/10); calcularScore
//     devolve score 0-100, fatores por critério (OBJETOS {pontos, max,
//     percentual, detalhes[]} — a soma dos pontos É o score) e explicacao[]
//     legível em pt-BR (critério de aceite: score explicável).
//   - API (GET /matching/projetos — verificarToken):
//     (a) 200 com recomendação: score numérico 0-100 + fatores presentes;
//     (b) ordenação decrescente por score (2 projetos mockados);
//     (c) usuário SEM habilidades → score baixo, mas 200 (fatores presentes);
//     (d) sem token → 401 antes de qualquer query;
//     (e) usuário membro ATIVO não recebe o projeto (NOT EXISTS membros_equipe
//         na query de candidatos + resposta vazia quando o filtro age);
//     (f) projeto PRIVADO não aparece para não-membro (WHERE visibilidade='publico'
//         na query de candidatos + resposta vazia quando o filtro age).
//
// Handlers espelham as queries REAIS do service (SQL normalizado:
// lowercase + colapso de espaços), específicos antes de genéricos, resposta
// [[rows],[fields]].

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { buildApp, criarPoolFake, tokenPara, buscarChamada } from "./helpers/bootstrap.js";

// ─────────────────────────────────────────────────────────────────────────────
// Unit — service (stub de db via Module._load, padrão githubPrivacy.test.js)
// ─────────────────────────────────────────────────────────────────────────────
const { Module, createRequire } = await import("node:module");
const { pathToFileURL } = await import("node:url");
const requireModulo = createRequire(import.meta.url);

// db fake que NUNCA deve ser consultado pelas funções puras (calcularScore)
function criarDbFake() {
  return {
    query: async (sql) => {
      throw new Error(`Query não esperada no unit de matching: ${String(sql).toLowerCase().replace(/\s+/g, " ")}`);
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
  const caminho = pathToFileURL(requireModulo.resolve("../src/services/matching.js")).href;
  return import(`${caminho}?etapa16=${Date.now()}`);
}

describe("ETAPA 16 — PESOS_MATCHING e calcularScore (unit)", () => {
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

  it("PESOS_MATCHING documentado em código (40/25/15/10/10)", async () => {
    expect(servico.PESOS_MATCHING).toEqual({
      habilidades: 0.4,
      funcao: 0.25,
      nivel: 0.15,
      disponibilidade: 0.1,
      outras: 0.1,
    });
    const soma = Object.values(servico.PESOS_MATCHING).reduce((a, b) => a + b, 0);
    expect(soma).toBe(1);
  });

  it("calcularScore devolve score 0-100 com fatores explicáveis", async () => {
    const usuario = {
      id: 42,
      disponibilidadeHorasSemana: 20,
      habilidades: [
        { habilidadeId: 1, nome: "Node.js", nivel: "avancado" },
        { habilidadeId: 2, nome: "SQL", nivel: "intermediario" },
      ],
      funcoes: [{ funcaoId: 5, nome: "Backend", nivelInteresse: "alto" }],
    };
    const projeto = {
      id: 1,
      titulo: "Sistema Financeiro",
      descricao: "desc",
      status: "aberto",
      visibilidade: "publico",
      habilidades: [
        { habilidadeId: 1, nome: "Node.js" },
        { habilidadeId: 2, nome: "SQL" },
        { habilidadeId: 3, nome: "Git" },
      ],
      vagas: [
        { id: 10, funcaoId: 5, funcaoNome: "Backend", nivel_desejado: "intermediario", quantidade: 2, preenchidas: 0, status: "aberta" },
      ],
    };

    const resultado = servico.calcularScore(usuario, projeto, { ehMembroAtivo: false });

    expect(resultado.score).toBeGreaterThanOrEqual(0);
    expect(resultado.score).toBeLessThanOrEqual(100);
    // 40% habilidades: 2/3 → 27 pts; 25% função: match → 25; 15% nível:
    // média (3+2)/2 = 2.5 ≥ 2 → 15; 10% disponibilidade: 20h → 10;
    // 10% outras: aberto+vagas+não-membro → 10. Total 87.
    expect(resultado.score).toBe(87);
    // Fatores: objetos {pontos, max, percentual, detalhes[]} — soma = score
    expect(resultado.fatores.habilidades).toEqual(
      expect.objectContaining({ pontos: 27, max: 40, percentual: expect.closeTo(2 / 3, 10) })
    );
    expect(resultado.fatores.habilidades.detalhes).toContain("Node.js, SQL em comum (2 de 3 habilidades)");
    expect(resultado.fatores.funcao.percentual).toBe(1);
    expect(resultado.fatores.funcao.detalhes).toContain("Função Backend compatível (vaga aberta)");
    expect(resultado.fatores.nivel.percentual).toBe(1);
    expect(resultado.fatores.disponibilidade.percentual).toBe(1);
    expect(resultado.fatores.disponibilidade.detalhes).toContain("Disponibilidade compatível (20h/semana)");
    expect(resultado.fatores.outras.percentual).toBe(1);
    expect(resultado.fatores.outras.detalhes).toContain("Você não é membro do projeto");
    // Explicação = frases legíveis em pt-BR (critério de aceite: score explicável)
    expect(Array.isArray(resultado.explicacao)).toBe(true);
    expect(resultado.explicacao.length).toBeGreaterThan(0);
    expect(resultado.explicacao.every((frase) => typeof frase === "string" && frase.length > 0)).toBe(true);
    // Soma dos pontos dos fatores bate com o score (contrato explicável)
    const somaPontos = Object.values(resultado.fatores).reduce((soma, f) => soma + f.pontos, 0);
    expect(somaPontos).toBe(resultado.score);
  });

  it("'qualquer' como nivel_desejado → fator nível sempre 100% (15 pts)", async () => {
    const usuario = {
      id: 42,
      disponibilidadeHorasSemana: null,
      habilidades: [],
      funcoes: [],
    };
    const projeto = {
      id: 1,
      titulo: "P",
      descricao: null,
      status: "aberto",
      visibilidade: "publico",
      habilidades: [],
      vagas: [{ id: 10, funcaoId: 9, funcaoNome: "Product", nivel_desejado: "qualquer", quantidade: 1, preenchidas: 0, status: "aberta" }],
    };

    const resultado = servico.calcularScore(usuario, projeto, { ehMembroAtivo: false });
    expect(resultado.fatores.nivel.percentual).toBe(1);
    expect(resultado.fatores.nivel.detalhes[0]).toContain("'qualquer' — sempre compatível");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API — GET /matching/projetos
// ─────────────────────────────────────────────────────────────────────────────
// Queries REAIS do service (normalizadas — conferir src/services/matching.js):
const SQL_HABILIDADES_USUARIO = /^select hu\.habilidade_id, h\.nome, hu\.nivel from habilidades_usuario hu inner join habilidades h on h\.id = hu\.habilidade_id where hu\.usuario_id = \?$/;
const SQL_FUNCOES_USUARIO = /^select fu\.funcao_id, f\.nome, fu\.nivel_interesse from funcoes_usuario fu inner join funcoes f on f\.id = fu\.funcao_id where fu\.usuario_id = \?$/;
const SQL_USUARIO = /^select id, disponibilidade_horas_semana from usuarios where id = \? limit 1$/;
const SQL_CANDIDATOS = /^select p\.id, p\.titulo, p\.descricao, p\.status, p\.visibilidade, p\.criador_id, v\.id as vagaid, v\.funcao_id as funcaoid, f\.nome as funcaonome, v\.nivel_desejado as niveldesejado, v\.quantidade, v\.preenchidas, v\.status as vagastatus from projetos p inner join vagas_projeto v on v\.projeto_id = p\.id and v\.status = 'aberta' and v\.preenchidas < v\.quantidade inner join funcoes f on f\.id = v\.funcao_id where p\.visibilidade = 'publico' and p\.status in \('aberto', 'em_andamento'\) and not exists \( select 1 from membros_equipe me where me\.projeto_id = p\.id and me\.usuario_id = \? and me\.status = 'ativo' \) order by p\.id limit 100/;
const SQL_HABILIDADES_PROJETO = /^select hp\.projeto_id as projetoid, hp\.habilidade_id as habilidadeid, h\.nome from habilidades_projeto hp inner join habilidades h on h\.id = hp\.habilidade_id where hp\.projeto_id in \(\?\)$/;

const HABILIDADES_USUARIO_PADRAO = [
  { habilidade_id: 1, nome: "Node.js", nivel: "avancado" },
  { habilidade_id: 2, nome: "SQL", nivel: "avancado" },
];
const FUNCOES_USUARIO_PADRAO = [{ funcao_id: 5, nome: "Backend", nivel_interesse: "alto" }];

// candidatos: linhas da query de projetos (uma por vaga aberta)
function linhaCandidato({ id, titulo = "Projeto", descricao = null, status = "aberto", criador_id = 99, vagaId = 10, funcaoId = 5, funcaoNome = "Backend", nivelDesejado = "qualquer", quantidade = 2, preenchidas = 0 }) {
  return {
    id, titulo, descricao, status, visibilidade: "publico", criador_id,
    vagaId, funcaoId, funcaoNome, nivelDesejado, quantidade, preenchidas, vagaStatus: "aberta",
  };
}

function criarPoolMatching({
  habilidadesUsuario = HABILIDADES_USUARIO_PADRAO,
  funcoesUsuario = FUNCOES_USUARIO_PADRAO,
  disponibilidade = 20,
  candidatos = [],
  habilidadesProjeto = [],
  usuarioInexistente = false,
  membroAtivo = false, // true → simula o NOT EXISTS excluindo (candidatos vazios)
  somentePublicos = false, // true → simula WHERE visibilidade='publico' excluindo (candidatos vazios)
} = {}) {
  return criarPoolFake([
    // Habilidades do usuário (Q1)
    { match: (sql) => SQL_HABILIDADES_USUARIO.test(sql), resposta: () => [habilidadesUsuario, []] },
    // Funções de interesse (Q2)
    { match: (sql) => SQL_FUNCOES_USUARIO.test(sql), resposta: () => [funcoesUsuario, []] },
    // Disponibilidade do usuário (Q3)
    { match: (sql) => SQL_USUARIO.test(sql), resposta: () => [usuarioInexistente ? [] : [{ id: 42, disponibilidade_horas_semana: disponibilidade }], []] },
    // Projetos candidatos (Q4) — específico antes de qualquer genérico
    {
      match: (sql) => SQL_CANDIDATOS.test(sql),
      resposta: () => (membroAtivo || somentePublicos ? [[], []] : [candidatos, []]),
    },
    // Habilidades necessárias dos candidatos (Q5 — IN (?))
    { match: (sql) => SQL_HABILIDADES_PROJETO.test(sql), resposta: () => [habilidadesProjeto, []] },
  ]);
}

describe("ETAPA 16 — GET /matching/projetos (API)", () => {
  it("(a) 200 com recomendação: score 0-100, fatores explicáveis e shape do contrato", async () => {
    const pool = criarPoolMatching({
      candidatos: [
        linhaCandidato({ id: 1, titulo: "Sistema Financeiro", descricao: "ERP completo" }),
      ],
      habilidadesProjeto: [
        { projetoId: 1, habilidadeId: 1, nome: "Node.js" },
        { projetoId: 1, habilidadeId: 2, nome: "SQL" },
        { projetoId: 1, habilidadeId: 3, nome: "Git" },
      ],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Dev" });

    const res = await request(app).get("/matching/projetos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.message).toBe("Projetos recomendados");
    expect(res.body.nItens).toBe(1);
    expect(res.body.dados.recomendacoes).toHaveLength(1);

    const rec = res.body.dados.recomendacoes[0];
    // Projeto: shape {id, titulo, descricao, tecnologias[]}
    expect(rec.projeto.id).toBe(1);
    expect(rec.projeto.titulo).toBe("Sistema Financeiro");
    expect(rec.projeto.descricao).toBe("ERP completo");
    expect(rec.projeto.tecnologias).toEqual(["Node.js", "SQL", "Git"]);
    // Score determinístico 0-100 (2/3 habilidades → 27 + 25 + 15 + 10 + 10 = 87)
    expect(typeof rec.score).toBe("number");
    expect(rec.score).toBeGreaterThanOrEqual(0);
    expect(rec.score).toBeLessThanOrEqual(100);
    expect(rec.score).toBe(87);
    // Explicabilidade: fatores presentes com {pontos, max, percentual, detalhes}
    expect(rec.fatores.habilidades).toBeDefined();
    expect(rec.fatores.habilidades).toEqual(
      expect.objectContaining({ pontos: expect.any(Number), max: expect.any(Number), percentual: expect.any(Number) })
    );
    expect(Array.isArray(rec.fatores.habilidades.detalhes)).toBe(true);
    expect(rec.fatores.habilidades.detalhes[0]).toContain("Node.js, SQL em comum (2 de 3 habilidades)");
    expect(rec.fatores.funcao.percentual).toBe(1);
    expect(rec.fatores.nivel.percentual).toBe(1); // 'qualquer' → sempre 100%
    expect(rec.fatores.disponibilidade.percentual).toBe(1);
    expect(rec.fatores.outras.percentual).toBe(1);
    expect(Array.isArray(rec.explicacao)).toBe(true);
    expect(rec.explicacao.length).toBeGreaterThan(0);
    // Soma dos pontos dos fatores = score (contrato explicável)
    const somaPontos = Object.values(rec.fatores).reduce((soma, f) => soma + f.pontos, 0);
    expect(somaPontos).toBe(rec.score);
  });

  it("(b) ordena decrescente por score (2 projetos mockados)", async () => {
    const pool = criarPoolMatching({
      habilidadesUsuario: [
        { habilidade_id: 1, nome: "Node.js", nivel: "intermediario" },
        { habilidade_id: 2, nome: "SQL", nivel: "avancado" },
        { habilidade_id: 3, nome: "Git", nivel: "iniciante" },
      ],
      candidatos: [
        linhaCandidato({ id: 2, titulo: "App de Delivery", vagaId: 20, funcaoId: 9, funcaoNome: "Product", nivelDesejado: "intermediario" }),
        linhaCandidato({ id: 1, titulo: "Sistema Financeiro", vagaId: 10, funcaoId: 5, funcaoNome: "Backend", nivelDesejado: "intermediario" }),
      ],
      habilidadesProjeto: [
        // Projeto 1: Node.js+SQL+Git — todas em comum → habilidades 100%
        { projetoId: 1, habilidadeId: 1, nome: "Node.js" },
        { projetoId: 1, habilidadeId: 2, nome: "SQL" },
        { projetoId: 1, habilidadeId: 3, nome: "Git" },
        // Projeto 2: Python+Docker — nenhuma em comum
        { projetoId: 2, habilidadeId: 7, nome: "Python" },
        { projetoId: 2, habilidadeId: 8, nome: "Docker" },
      ],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Dev" });

    const res = await request(app).get("/matching/projetos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nItens).toBe(2);
    const [primeiro, segundo] = res.body.dados.recomendacoes;
    // Projeto 1: 40 (3/3) + 25 (função Backend) + 15 (média 2 ≥ 2) + 10 + 10 = 100
    // Projeto 2: 0 + 0 + 0 + 10 + 10 = 20
    expect(primeiro.projeto.id).toBe(1);
    expect(primeiro.score).toBe(100);
    expect(segundo.projeto.id).toBe(2);
    expect(segundo.score).toBe(20);
    expect(primeiro.score).toBeGreaterThan(segundo.score);
  });

  it("(c) usuário SEM habilidades → score baixo, mas 200 com fatores presentes", async () => {
    const pool = criarPoolMatching({
      habilidadesUsuario: [],
      funcoesUsuario: [],
      disponibilidade: null,
      candidatos: [
        linhaCandidato({ id: 1, titulo: "App de Delivery", vagaId: 20, funcaoId: 9, funcaoNome: "Product", nivelDesejado: "intermediario" }),
      ],
      habilidadesProjeto: [
        { projetoId: 1, habilidadeId: 7, nome: "Python" },
        { projetoId: 1, habilidadeId: 8, nome: "Docker" },
      ],
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Dev" });

    const res = await request(app).get("/matching/projetos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.sucesso).toBe(true);
    expect(res.body.nItens).toBe(1);
    const rec = res.body.dados.recomendacoes[0];
    expect(rec.fatores.habilidades.percentual).toBe(0);
    expect(rec.fatores.habilidades.detalhes[0]).toContain("Nenhuma habilidade em comum");
    // 0 (habilidades) + 0 (função) + 0 (nível) + 5 (disp neutra) + 10 (outras) = 15
    expect(rec.score).toBe(15);
    expect(rec.score).toBeLessThan(40);
    // Explicabilidade mantida mesmo com score baixo
    expect(rec.fatores).toHaveProperty("funcao");
    expect(rec.fatores).toHaveProperty("nivel");
    expect(rec.fatores).toHaveProperty("disponibilidade");
    expect(rec.fatores).toHaveProperty("outras");
  });

  it("(d) sem token → 401 antes de qualquer query", async () => {
    // Pool SEM handlers: qualquer query derruba o teste — prova que o
    // verificarToken barra antes do banco.
    const app = buildApp(criarPoolFake([]));

    const res = await request(app).get("/matching/projetos");

    expect(res.status).toBe(401);
    expect(res.body.sucesso).toBe(false);
    expect(res.body.message).toBe("Token não informado");
  });

  it("(e) usuário membro ATIVO não recebe o projeto (NOT EXISTS no SQL + vazio)", async () => {
    const pool = criarPoolMatching({
      candidatos: [linhaCandidato({ id: 1, titulo: "Squad Interno" })],
      habilidadesProjeto: [{ projetoId: 1, habilidadeId: 1, nome: "Node.js" }],
      membroAtivo: true, // simula o NOT EXISTS excluindo o projeto do usuário
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Membro" });

    const res = await request(app).get("/matching/projetos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nItens).toBe(0);
    expect(res.body.dados.recomendacoes).toEqual([]);
    // Contrato SQL: a query de candidatos exclui vínculo ATIVO (NOT EXISTS)
    const candidatos = buscarChamada(pool, SQL_CANDIDATOS);
    expect(candidatos).toBeDefined();
    expect(candidatos.sql).toContain("not exists");
    expect(candidatos.sql).toContain("membros_equipe me");
    expect(candidatos.sql).toContain("me.status = 'ativo'");
    expect(candidatos.params[0]).toBe(42); // parametrizado com o usuário autenticado
  });

  it("(f) projeto PRIVADO não aparece para não-membro (WHERE visibilidade='publico')", async () => {
    const pool = criarPoolMatching({
      candidatos: [linhaCandidato({ id: 1, titulo: "Squad Secreto" })],
      habilidadesProjeto: [{ projetoId: 1, habilidadeId: 1, nome: "Node.js" }],
      somentePublicos: true, // simula o WHERE visibilidade='publico' excluindo
    });
    const app = buildApp(pool);
    const token = tokenPara({ id: 42, nome: "Forasteiro" });

    const res = await request(app).get("/matching/projetos").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.nItens).toBe(0);
    expect(res.body.dados.recomendacoes).toEqual([]);
    // Contrato SQL: só projetos públicos, abertos/em_andamento entram
    const candidatos = buscarChamada(pool, SQL_CANDIDATOS);
    expect(candidatos).toBeDefined();
    expect(candidatos.sql).toContain("p.visibilidade = 'publico'");
    expect(candidatos.sql).toContain("p.status in ('aberto', 'em_andamento')");
    expect(candidatos.sql).toContain("v.status = 'aberta'");
  });
});