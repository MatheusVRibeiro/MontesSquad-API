// Privacidade GitHub (ETAPA 14 — privacidade e repositórios privados)
//
// Funções conceituais (spec §17):
//   - canViewRepositoryActivity(userId, projectId): decide se o usuário pode
//     ver a ATIVIDADE do repositório (branch/commit/PR) de um projeto.
//     Verdadeiro APENAS quando:
//       1. usuário é o dono (criador_id); OU
//       2. usuário é membro ATIVO do squad (membros_equipe.status='ativo'); OU
//       3. o projeto é PÚBLICO (visibilidade='publico') e o usuário está
//          autenticado (userId != null). Visitante (sem usuário) nunca vê.
//     Regras do plano: (1) visitante não vê detalhes GitHub privados;
//     (2) usuário fora do projeto não vê branch/commit/PR privado.
//
//   - canExposeContributionPublicly(projectId, contribution): decide se uma
//     contribuição detalhada (titulo, prUrl, prNumero) pode ser exposta
//     PUBLICAMENTE (ex.: portfólio público). Verdadeiro APENAS quando
//     visibilidade='publico' E permitir_portfolio_publico=TRUE. Caso
//     contrário devolve { privado: true } — o frontend renderiza
//     "Contribuição verificada em projeto privado" (regra 3 do plano).
//
// Regra 5 (tokens nunca vão para frontend), 6 (logs sem secrets) e 7
// (payloads minimizados) são garantidas pelos controllers/serviços que
// consomem este módulo — nenhum token/segredo é lido ou logado aqui.
const db = require("../database/connection");

// Resolve os campos de privacidade do projeto. Aceita o id OU um objeto de
// projeto já carregado (evita query extra quando o chamador já tem o projeto).
async function obterPrivacidadeProjeto(projectId) {
  if (projectId && typeof projectId === "object") {
    return {
      id: projectId.id,
      criador_id: projectId.criador_id,
      visibilidade: projectId.visibilidade,
      permitir_portfolio_publico: projectId.permitir_portfolio_publico,
    };
  }
  const [rows] = await db.query(
    "SELECT id, criador_id, visibilidade, permitir_portfolio_publico FROM projetos WHERE id = ? LIMIT 1",
    [projectId]
  );
  return rows[0] || null;
}

/**
 * Decide se o usuário pode ver a atividade do repositório (branch/commit/PR)
 * do projeto. Dono e membro ativo sempre podem; projeto público libera para
 * qualquer usuário autenticado; visitante (userId null) nunca vê.
 * @param {number|string|null} userId id do usuário autenticado (null = visitante)
 * @param {number|string|object} projectId id do projeto (ou objeto já carregado)
 * @returns {Promise<boolean>}
 */
async function canViewRepositoryActivity(userId, projectId) {
  // Regra 1: visitante (sem usuário autenticado) não vê atividade de repositório
  if (userId === null || userId === undefined) return false;

  const projeto = await obterPrivacidadeProjeto(projectId);
  if (!projeto) return false;

  // Dono sempre pode
  if (Number(projeto.criador_id) === Number(userId)) return true;

  // Membro ATIVO do squad pode (status='ativo' — saiu/removido perde o acesso)
  const [membros] = await db.query(
    "SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? AND status = 'ativo' LIMIT 1",
    [projeto.id, userId]
  );
  if (membros.length > 0) return true;

  // Projeto PÚBLICO: qualquer usuário autenticado pode ver a atividade
  if (projeto.visibilidade === "publico") return true;

  return false;
}

/**
 * Decide se a contribuição detalhada (titulo, prUrl, prNumero) pode ser
 * exposta publicamente (portfólio público). Retorna `true` quando
 * visibilidade='publico' E permitir_portfolio_publico=TRUE; caso contrário
 * retorna { privado: true } (sinalizador que o frontend usa para renderizar
 * "Contribuição verificada em projeto privado").
 * @param {number|string|object} projectId id do projeto (ou objeto já carregado)
 * @param {object} [contribution] contribuição detalhada (ignorada na decisão)
 * @returns {Promise<true|{privado: true}>}
 */
async function canExposeContributionPublicly(projectId, contribution) {
  const projeto = await obterPrivacidadeProjeto(projectId);
  const podeExpor =
    projeto &&
    projeto.visibilidade === "publico" &&
    Boolean(projeto.permitir_portfolio_publico);

  if (podeExpor) return true;

  // Regra 3: sem autorização, não expõe a contribuição detalhada — sinaliza
  // privado para o frontend mostrar o aviso em vez do titulo/prUrl/prNumero.
  return { privado: true };
}

module.exports = {
  canViewRepositoryActivity,
  canExposeContributionPublicly,
  obterPrivacidadeProjeto,
};
