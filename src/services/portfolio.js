// Portfólio verificável (ETAPA 11)
//
// Agrega por projeto as evidências GitHub de um usuário: função exercida,
// tasks verificadas por merge, commits, PRs mergeados e tecnologias.
//
// Endpoint público: GET /usuarios/:id/portfolio (perfil público mostra o
// agregado; a regra de privacidade da ETAPA 11/14 — não vazar detalhes de
// repositório privado — é respeitada expondo apenas contagens agregadas e,
// quando o projeto permite (visibilidade='publico' E permitir_portfolio_publico),
// a evidência por task do PRÓPRIO usuário. Projeto privado/sem autorização →
// privado:true e contribuicoes[] vazio).
//
// Retorno: { projetos: [{ projetoId, projetoNome, funcao, tasksVerificadas,
//   commits, prsMergeados, tecnologias[], contribuicoes[], privado? }] }
// null quando o usuário não existe.
const db = require("../database/connection");

async function obterPortfolio(usuarioId) {
  // 1. Usuário precisa existir (404 no controller)
  const [userRows] = await db.query("SELECT id FROM usuarios WHERE id = ? LIMIT 1", [usuarioId]);
  if (userRows.length === 0) return null;

  // 2. Participação em projetos — TODOS os status (ativo/saiu/removido):
  //    sair/remover do squad não elimina o portfólio (contrato ETAPA 10).
  //    Função vem de funcoes via membros_equipe.funcao_id ou vaga
  //    (vagas_projeto.funcao_id), com fallback para membros_equipe.funcao.
  //    ETAPA 14: visibilidade/permitir_portfolio_publico decidem se o
  //    projeto expõe as contribuições detalhadas publicamente (regra 3).
  const [membros] = await db.query(
    `SELECT p.id AS projetoId, p.titulo AS projetoNome,
            p.visibilidade AS visibilidade,
            p.permitir_portfolio_publico AS permitirPortfolioPublico,
            COALESCE(f.nome, me.funcao) AS funcao
     FROM membros_equipe me
     JOIN projetos p ON p.id = me.projeto_id
     LEFT JOIN vagas_projeto v ON v.id = me.vaga_id
     LEFT JOIN funcoes f ON f.id = COALESCE(me.funcao_id, v.funcao_id)
     WHERE me.usuario_id = ?
     ORDER BY me.entrou_em DESC`,
    [usuarioId]
  );

  if (membros.length === 0) return { projetos: [] };

  // 3. Tasks concluídas pelo usuário no projeto. Excluídas (soft-delete) não contam.
  const [tasksRows] = await db.query(
    `SELECT projeto_id AS projetoId, COUNT(*) AS total
     FROM tarefas
     WHERE responsavel_id = ? AND status = 'done' AND excluida_em IS NULL
     GROUP BY projeto_id`,
    [usuarioId]
  );

  // 4. Commits e PRs desativados temporariamente (implementação futura)
  const commitsRows = [];
  const prsRows = [];

  // 5. Tecnologias do projeto (habilidades_projeto JOIN habilidades).
  const [techsRows] = await db.query(
    `SELECT hp.projeto_id AS projetoId, h.nome
     FROM habilidades_projeto hp
     JOIN habilidades h ON h.id = hp.habilidade_id
     JOIN membros_equipe me ON me.projeto_id = hp.projeto_id AND me.usuario_id = ?
     ORDER BY h.nome`,
    [usuarioId]
  );

  // 6. Contribuições por task: tarefas concluídas pelo usuário
  const [contribRows] = await db.query(
    `SELECT t.id AS tarefaId, t.projeto_id AS projetoId, t.titulo, t.concluida_em AS mergeadoEm
     FROM tarefas t
     WHERE t.responsavel_id = ? AND t.status = 'done' AND t.excluida_em IS NULL
     ORDER BY t.concluida_em DESC`,
    [usuarioId]
  );

  // ── Agregação em memória por projeto ──
  const agruparTotal = (rows) => {
    const mapa = {};
    for (const r of rows) {
      const chave = String(r.projetoId);
      mapa[chave] = (mapa[chave] || 0) + Number(r.total || 0);
    }
    return mapa;
  };
  const tasksPorProjeto = agruparTotal(tasksRows);
  const commitsPorProjeto = {};
  const prsPorProjeto = {};

  const tecnologiasPorProjeto = {};
  for (const r of techsRows) {
    const chave = String(r.projetoId);
    if (!tecnologiasPorProjeto[chave]) tecnologiasPorProjeto[chave] = [];
    if (r.nome) tecnologiasPorProjeto[chave].push(r.nome);
  }

  const contribuicoesPorProjeto = {};
  for (const r of contribRows) {
    const chave = String(r.projetoId);
    if (!contribuicoesPorProjeto[chave]) contribuicoesPorProjeto[chave] = [];
    contribuicoesPorProjeto[chave].push({
      tarefaId: Number(r.tarefaId),
      titulo: r.titulo || null,
      prNumero: null,
      prUrl: null,
      commits: 0,
      mergeadoEm: r.mergeadoEm || null,
    });
  }

  const projetos = membros.map((m) => {
    const chave = String(m.projetoId);
    // ETAPA 14 (regra 3): projeto privado OU sem autorização de portfólio
    // público → marca privado:true e NÃO expõe as contribuições detalhadas
    // (titulo/prUrl/prNumero) — apenas contagens agregadas. O frontend
    // (VerifiedContributions.tsx) renderiza "Contribuição verificada em
    // projeto privado" quando privado=true. Fail-closed: coluna ausente
    // (undefined/0) também é tratada como privado.
    const ehPrivado = m.visibilidade === "privado" || !m.permitirPortfolioPublico;
    const projeto = {
      projetoId: Number(m.projetoId),
      projetoNome: m.projetoNome || "Projeto",
      funcao: m.funcao || null,
      tasksVerificadas: tasksPorProjeto[chave] || 0,
      commits: commitsPorProjeto[chave] || 0,
      prsMergeados: prsPorProjeto[chave] || 0,
      tecnologias: tecnologiasPorProjeto[chave] || [],
      contribuicoes: ehPrivado ? [] : contribuicoesPorProjeto[chave] || [],
    };
    if (ehPrivado) projeto.privado = true;
    return projeto;
  });

  return { projetos };
}

module.exports = { obterPortfolio };
