// Matching Desenvolvedor ↔ Projeto (ETAPA 16 — docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md §19
// e docs/api.md §31)
//
// Recomenda projetos compatíveis com o perfil do usuário usando score
// DETERMINÍSTICO (sem IA), com pesos documentados em código:
//
//   PESOS_MATCHING (spec §19 — "Algoritmo inicial sugerido"):
//     40% habilidades       — interseção entre as habilidades do usuário e as
//                              habilidades necessárias do projeto
//     25% função            — existe vaga ABERTA cuja função é de interesse do
//                              usuário (funcoes_usuario da ETAPA 3)
//     15% nível             — nível médio do usuário nas habilidades em comum
//                              atende o nivel_desejado da vaga ('qualquer' = 100%)
//     10% disponibilidade   — usuario.disponibilidade_horas_semana >= 1
//                              (null = neutro 50%)
//     10% outras afinidades — projeto 'aberto' + com vagas abertas + usuário
//                              não é membro ativo do squad
//
// CONTRATO DA RESPOSTA (docs/api.md §31 — operativo; veredito no
// test/matching.security.test.js):
//   GET /matching/projetos → 200 { sucesso, message: "Projetos recomendados",
//   nItens, dados: { recomendacoes: [{ projeto: {id, titulo, descricao,
//   tecnologias[]}, score (0-100), fatores: {habilidades, funcao, nivel,
//   disponibilidade, outras} — cada fator um OBJETO {pontos, max, percentual,
//   detalhes[]} (a soma dos pontos É o score), explicacao: string[] (frases
//   pt-BR) }] } }, ordenado por score DESC.
//   Regras: não recomenda projetos em que o usuário já é membro ativo (filtro
//   NOT EXISTS na query de candidatos) nem projetos dos quais é o dono
//   (criador_id — docs §31); sem mudança de banco.
//
// Critério de aceite da etapa: "Score precisa ser explicável: API retorna os
// fatores que justificaram a recomendação" — fatores (pontos/max/percentual/
// detalhes por critério) + explicacao[] (frases) tornam o score auditável.
//
// Observação de arredondamento: cada fator arredonda seus pontos, então a
// soma dos pontos exibidos em `fatores` SEMPRE bate com o `score` (ex.:
// 27 + 25 + 15 + 10 + 10 = 87). Difere de arredondar só o total final por no
// máximo ±1 e mantém o score explicável fator a fator.
const db = require("../database/connection");

const PESOS_MATCHING = {
  habilidades: 0.4, // 40%
  funcao: 0.25, // 25%
  nivel: 0.15, // 15%
  disponibilidade: 0.1, // 10%
  outras: 0.1, // 10%
};

// ENUM de nível (Tabelas.sql) → valor numérico para comparação
const VALOR_NIVEL = { iniciante: 1, intermediario: 2, avancado: 3 };

function nivelParaValor(nivel) {
  return VALOR_NIVEL[nivel] || 0;
}

// Chave de habilidade para interseção: prefere habilidade_id (BD real);
// aceita habilidadeId (camelCase) e cai para o NOME quando a linha não traz id
// (defensivo — tolera mocks/views sem a coluna).
function chaveHabilidade(linha) {
  const id = linha.habilidade_id !== undefined ? linha.habilidade_id : linha.habilidadeId;
  if (id !== null && id !== undefined) {
    return `id:${Number(id)}`;
  }
  return `nome:${String(linha.nome || linha.habilidade || "").toLowerCase()}`;
}

// Chave de função para compatibilidade: id quando existe (funcao_id ou
// funcaoId), senão nome (funcao/nome/funcaoNome).
function chaveFuncao(linha) {
  const id = linha.funcao_id !== undefined ? linha.funcao_id : linha.funcaoId;
  if (id !== null && id !== undefined) {
    return `id:${Number(id)}`;
  }
  return `nome:${String(linha.nome || linha.funcao || linha.funcaoNome || "").toLowerCase()}`;
}

function nomeFuncaoVaga(vaga) {
  return vaga.funcaoNome || vaga.funcao || vaga.nome || "?";
}

// Vaga aberta = status 'aberta' e (preenchidas < quantidade). Tolerante a
// linhas sem quantidade/preenchidas (tratadas como abertas — BD real sempre
// traz os dois campos, NOT NULL na Tabelas.sql).
function vagasAbertasDoProjeto(projeto) {
  return (projeto.vagas || []).filter((vaga) => {
    if (vaga.status !== "aberta") return false;
    const quantidade = vaga.quantidade;
    const preenchidas = vaga.preenchidas;
    if (quantidade === null || quantidade === undefined || preenchidas === null || preenchidas === undefined) {
      return true;
    }
    return Number(preenchidas) < Number(quantidade);
  });
}

// ── Fatores (cada um retorna { pontos, max, percentual, detalhes[] }) ──

// 40% — habilidades em comum: interseção usuário × projeto sobre o total de
// habilidades necessárias do projeto. Projeto sem habilidades → 0%.
function fatorHabilidades(usuario, projeto) {
  const chavesUsuario = new Set(usuario.habilidades.map(chaveHabilidade));
  const habilidadesProjeto = projeto.habilidades || [];
  const total = habilidadesProjeto.length;
  const emComum = habilidadesProjeto.filter((hp) => chavesUsuario.has(chaveHabilidade(hp)));
  const percentual = total > 0 ? emComum.length / total : 0;
  const nomes = emComum.map((hp) => hp.nome || hp.habilidade).filter(Boolean);
  const detalhes = [
    total > 0
      ? `${nomes.length > 0 ? `${nomes.join(", ")} em comum` : "Nenhuma habilidade em comum"} (${emComum.length} de ${total} habilidades)`
      : "Projeto sem habilidades cadastradas",
  ];
  return {
    pontos: Math.round(percentual * PESOS_MATCHING.habilidades * 100),
    max: PESOS_MATCHING.habilidades * 100,
    percentual,
    detalhes,
  };
}

// 25% — função: vaga ABERTA do projeto cuja função está nas funções de
// interesse do usuário (funcoes_usuario). Sem match → 0 (fator binário).
function fatorFuncao(usuario, projeto) {
  const vagasAbertas = vagasAbertasDoProjeto(projeto);
  const chavesInteresse = new Set(usuario.funcoes.map(chaveFuncao));
  const vagasCompativeis = vagasAbertas.filter((vaga) => chavesInteresse.has(chaveFuncao(vaga)));
  const compativel = vagasCompativeis.length > 0;
  const percentual = compativel ? 1 : 0;
  const detalhes = compativel
    ? vagasCompativeis.map((vaga) => `Função ${nomeFuncaoVaga(vaga)} compatível (vaga aberta)`)
    : ["Nenhuma vaga aberta para as funções de interesse"];
  return {
    pontos: Math.round(percentual * PESOS_MATCHING.funcao * 100),
    max: PESOS_MATCHING.funcao * 100,
    percentual,
    detalhes,
  };
}

// 15% — nível: nível médio do usuário nas habilidades EM COMUM com o projeto
// comparado ao nivel_desejado de cada vaga aberta. 'qualquer' → sempre 100%.
// Usa a MELHOR vaga (máximo) — a recomendação é sobre preencher uma vaga.
function fatorNivel(usuario, projeto) {
  const vagasAbertas = vagasAbertasDoProjeto(projeto);
  const chavesProjeto = new Set((projeto.habilidades || []).map(chaveHabilidade));
  const habilidadesEmComum = usuario.habilidades.filter((h) => chavesProjeto.has(chaveHabilidade(h)));
  const media =
    habilidadesEmComum.length > 0
      ? habilidadesEmComum.reduce((soma, h) => soma + nivelParaValor(h.nivel), 0) / habilidadesEmComum.length
      : 0;

  const detalhes = [];
  if (habilidadesEmComum.length === 0 && vagasAbertas.some((v) => v.nivel_desejado !== "qualquer")) {
    detalhes.push("Sem habilidades em comum com o projeto para comparar nível");
  }
  let melhor = 0;
  for (const vaga of vagasAbertas) {
    if (vaga.nivel_desejado === "qualquer") {
      melhor = Math.max(melhor, 1);
      detalhes.push(`Vaga ${nomeFuncaoVaga(vaga)}: nível desejado 'qualquer' — sempre compatível`);
      continue;
    }
    const desejado = nivelParaValor(vaga.nivel_desejado);
    const percentualVaga = desejado > 0 ? Math.min(media / desejado, 1) : 0;
    melhor = Math.max(melhor, percentualVaga);
    detalhes.push(
      percentualVaga >= 1
        ? `Vaga ${nomeFuncaoVaga(vaga)}: nível médio ${media.toFixed(1)} atende o desejado (${vaga.nivel_desejado})`
        : `Vaga ${nomeFuncaoVaga(vaga)}: nível médio ${media.toFixed(1)} abaixo do desejado (${vaga.nivel_desejado})`
    );
  }
  if (vagasAbertas.length === 0) {
    detalhes.push("Projeto sem vagas abertas para comparar nível");
  }

  return {
    pontos: Math.round(melhor * PESOS_MATCHING.nivel * 100),
    max: PESOS_MATCHING.nivel * 100,
    percentual: melhor,
    detalhes,
  };
}

// 10% — disponibilidade: disponibilidade_horas_semana >= 1 → 100%; null/ausente
// → neutro 50% (perfil incompleto não pune nem favorece); 0 declarado → 0%.
function fatorDisponibilidade(usuario) {
  const horas = usuario.disponibilidadeHorasSemana;
  let percentual;
  let detalhe;
  if (horas === null || horas === undefined) {
    percentual = 0.5;
    detalhe = "Disponibilidade não informada — considerada neutra (50%)";
  } else if (Number(horas) >= 1) {
    percentual = 1;
    detalhe = `Disponibilidade compatível (${horas}h/semana)`;
  } else {
    percentual = 0;
    detalhe = "Disponibilidade declarada como 0h/semana";
  }
  return {
    pontos: Math.round(percentual * PESOS_MATCHING.disponibilidade * 100),
    max: PESOS_MATCHING.disponibilidade * 100,
    percentual,
    detalhes: [detalhe],
  };
}

// 10% — outras afinidades: 3 subcritérios de 1/3 cada: projeto 'aberto',
// projeto com vagas abertas e usuário não é membro ativo do squad.
function fatorOutras(usuario, projeto, contexto) {
  const ehMembroAtivo = Boolean(contexto && contexto.ehMembroAtivo);
  const temVagasAbertas = vagasAbertasDoProjeto(projeto).length > 0;
  const statusAberto = projeto.status === "aberto";

  const detalhes = [];
  let contagem = 0;
  if (statusAberto) {
    contagem += 1;
    detalhes.push("Projeto aberto");
  } else {
    detalhes.push("Projeto em andamento");
  }
  if (temVagasAbertas) {
    contagem += 1;
    detalhes.push("Projeto com vagas abertas");
  } else {
    detalhes.push("Projeto sem vagas abertas no momento");
  }
  if (!ehMembroAtivo) {
    contagem += 1;
    detalhes.push("Você não é membro do projeto");
  } else {
    detalhes.push("Você já é membro do projeto");
  }

  const percentual = contagem / 3;
  return {
    pontos: Math.round(percentual * PESOS_MATCHING.outras * 100),
    max: PESOS_MATCHING.outras * 100,
    percentual,
    detalhes,
  };
}

/**
 * Calcula o score determinístico 0-100 de um projeto para um usuário.
 * `usuario` = { id, disponibilidadeHorasSemana, habilidades: [{habilidadeId,
 * nome, nivel}], funcoes: [{funcaoId, nome, nivelInteresse}] }
 * `projeto` = { id, titulo, descricao, status, visibilidade, habilidades:
 * [{habilidadeId, nome}], vagas: [{id, funcaoId, funcaoNome, nivel_desejado,
 * quantidade, preenchidas, status}] }
 * `contexto` = { ehMembroAtivo? } (usado pelo fator 'outras').
 * @returns {{score: number, fatores: object, explicacao: string[]}}
 */
function calcularScore(usuario, projeto, contexto) {
  const fHabilidades = fatorHabilidades(usuario, projeto);
  const fFuncao = fatorFuncao(usuario, projeto);
  const fNivel = fatorNivel(usuario, projeto);
  const fDisponibilidade = fatorDisponibilidade(usuario);
  const fOutras = fatorOutras(usuario, projeto, contexto);

  const score = Math.max(
    0,
    Math.min(
      100,
      fHabilidades.pontos + fFuncao.pontos + fNivel.pontos + fDisponibilidade.pontos + fOutras.pontos
    )
  );

  const fatores = {
    habilidades: fHabilidades,
    funcao: fFuncao,
    nivel: fNivel,
    disponibilidade: fDisponibilidade,
    outras: fOutras,
  };

  const explicacao = [
    ...fHabilidades.detalhes,
    ...fFuncao.detalhes,
    ...fNivel.detalhes,
    ...fDisponibilidade.detalhes,
    ...fOutras.detalhes,
  ];

  return { score, fatores, explicacao };
}

/**
 * Recomenda até 10 projetos compatíveis com o perfil do usuário autenticado.
 * Candidatos: projetos PÚBLICOS (visibilidade='publico' — privado só aparece
 * para membros, que por serem membros/donos não recebem recomendação), status
 * 'aberto'/'em_andamento', com pelo menos uma vaga aberta (preenchidas <
 * quantidade) e onde o usuário NÃO é membro ativo (NOT EXISTS membros_equipe
 * com status='ativo' — 'saiu'/'removido' não bloqueiam). Projetos dos quais o
 * usuário é DONO (criador_id) também são excluídos (docs §31).
 * @param {number|string} usuarioId
 * @returns {Promise<Array<{projeto: object, score: number, fatores: object, explicacao: string[]}>>}
 */
async function recomendarProjetos(usuarioId) {
  const idUsuario = Number(usuarioId);

  // 1. Habilidades do usuário (ETAPA 3)
  const [habilidadesRows] = await db.query(
    `SELECT hu.habilidade_id, h.nome, hu.nivel
     FROM habilidades_usuario hu
     INNER JOIN habilidades h ON h.id = hu.habilidade_id
     WHERE hu.usuario_id = ?`,
    [idUsuario]
  );

  // 2. Funções de interesse do usuário (ETAPA 3 — funcoes_usuario)
  const [funcoesRows] = await db.query(
    `SELECT fu.funcao_id, f.nome, fu.nivel_interesse
     FROM funcoes_usuario fu
     INNER JOIN funcoes f ON f.id = fu.funcao_id
     WHERE fu.usuario_id = ?`,
    [idUsuario]
  );

  // 3. Disponibilidade declarada (ETAPA 3 — usuarios.disponibilidade_horas_semana)
  const [userRows] = await db.query(
    "SELECT id, disponibilidade_horas_semana FROM usuarios WHERE id = ? LIMIT 1",
    [idUsuario]
  );
  if (userRows.length === 0) return [];

  const usuario = {
    id: idUsuario,
    disponibilidadeHorasSemana: userRows[0].disponibilidade_horas_semana,
    habilidades: habilidadesRows.map((h) => ({
      habilidadeId: h.habilidade_id,
      nome: h.nome || h.habilidade,
      nivel: h.nivel,
    })),
    funcoes: funcoesRows.map((f) => ({
      funcaoId: f.funcao_id,
      nome: f.nome || f.funcao,
      nivelInteresse: f.nivel_interesse,
    })),
  };

  // 4. Projetos candidatos: públicos, abertos/em_andamento, com vaga aberta e
  //    sem vínculo ATIVO do usuário (NOT EXISTS). Uma linha por vaga aberta —
  //    projetos com várias vagas aparecem repetidos e são agrupados abaixo.
  const [candidatosRows] = await db.query(
    `SELECT p.id, p.titulo, p.descricao, p.status, p.visibilidade, p.criador_id,
            v.id AS vagaId, v.funcao_id AS funcaoId, f.nome AS funcaoNome,
            v.nivel_desejado AS nivelDesejado, v.quantidade, v.preenchidas,
            v.status AS vagaStatus
     FROM projetos p
     INNER JOIN vagas_projeto v
       ON v.projeto_id = p.id AND v.status = 'aberta' AND v.preenchidas < v.quantidade
     INNER JOIN funcoes f ON f.id = v.funcao_id
     WHERE p.visibilidade = 'publico'
       AND p.status IN ('aberto', 'em_andamento')
       AND NOT EXISTS (
         SELECT 1 FROM membros_equipe me
         WHERE me.projeto_id = p.id AND me.usuario_id = ? AND me.status = 'ativo'
       )
     ORDER BY p.id
     LIMIT 100`,
    [idUsuario]
  );

  if (candidatosRows.length === 0) return [];

  // 5. Habilidades necessárias dos projetos candidatos (habilidades_projeto)
  const projetoIds = [...new Set(candidatosRows.map((linha) => Number(linha.id)))];
  const [habilidadesProjetoRows] = await db.query(
    `SELECT hp.projeto_id AS projetoId, hp.habilidade_id AS habilidadeId, h.nome
     FROM habilidades_projeto hp
     INNER JOIN habilidades h ON h.id = hp.habilidade_id
     WHERE hp.projeto_id IN (?)`,
    [projetoIds]
  );
  const habilidadesPorProjeto = {};
  for (const linha of habilidadesProjetoRows) {
    const chave = String(linha.projetoId);
    if (!habilidadesPorProjeto[chave]) habilidadesPorProjeto[chave] = [];
    habilidadesPorProjeto[chave].push({ habilidadeId: linha.habilidadeId, nome: linha.nome });
  }

  // 6. Monta os projetos (agrupando vagas por projeto) e exclui os que o
  //    usuário é dono (docs §31 — "membro ou dono não entram na recomendação")
  const projetos = [];
  for (const linha of candidatosRows) {
    const projetoId = Number(linha.id);
    let projeto = projetos.find((p) => p.id === projetoId);
    if (!projeto) {
      if (Number(linha.criador_id) === idUsuario) continue; // é dono → não recomenda
      projeto = {
        id: projetoId,
        titulo: linha.titulo,
        descricao: linha.descricao,
        status: linha.status,
        visibilidade: linha.visibilidade,
        criador_id: linha.criador_id,
        habilidades: habilidadesPorProjeto[String(projetoId)] || [],
        vagas: [],
      };
      projetos.push(projeto);
    }
    projeto.vagas.push({
      id: Number(linha.vagaId),
      funcaoId: linha.funcaoId,
      funcaoNome: linha.funcaoNome || linha.funcao || linha.nome,
      nivel_desejado: linha.nivelDesejado,
      quantidade: linha.quantidade,
      preenchidas: linha.preenchidas,
      status: linha.vagaStatus,
    });
  }

  // 7. Score por candidato, ordena decrescente e limita a 10 recomendações
  const recomendacoes = projetos
    .map((projeto) => {
      const resultado = calcularScore(usuario, projeto, { ehMembroAtivo: false });
      return {
        projeto: {
          id: projeto.id,
          titulo: projeto.titulo,
          descricao: projeto.descricao,
          status: projeto.status,
          visibilidade: projeto.visibilidade,
          tecnologias: projeto.habilidades.map((h) => h.nome).filter(Boolean),
        },
        score: resultado.score,
        fatores: resultado.fatores,
        explicacao: resultado.explicacao,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return recomendacoes;
}

module.exports = {
  PESOS_MATCHING,
  calcularScore,
  recomendarProjetos,
};
