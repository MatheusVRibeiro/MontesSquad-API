// Matching Desenvolvedor ↔ Task (ETAPA 17 — docs/PLANO_EVOLUCAO_PRODUTO_MONTESQUAD.md §20)
//
// Recomenda tasks do projeto adequadas ao MEMBRO autenticado usando score
// DETERMINÍSTICO (sem IA), com pesos documentados em código:
//
//   PESOS_TASK_MATCHING (spec §20 — "Considerar: habilidades do usuário;
//   habilidades da task; dificuldade; função no projeto; disponibilidade;
//   task sem responsável"):
//     40% habilidades      — interseção entre as habilidades do usuário e as
//                              habilidades necessárias da task
//     25% dificuldade      — dificuldade da task ('iniciante'/'intermediaria'/
//                              'avancada', ETAPA 7) compatível com o nível
//                              médio do usuário nas skills cadastradas
//     15% função           — função do usuário NO PROJETO (membros_equipe
//                              funcao_id/funcao — ETAPA 6)
//     10% disponibilidade  — usuario.disponibilidade_horas_semana >= 1
//                              (null = neutro 50%)
//     10% sem responsável  — task livre (responsavel_id IS NULL). O serviço
//                              só recomenda tasks SEM responsável, então o
//                              fator é sempre 100% nas candidatas — ele
//                              existe para documentar a regra nos motivos.
//
// CONTRATO DA RESPOSTA:
//   GET /projetos/:projetoId/tasks/recomendadas → 200 { sucesso: true,
//   message: "Tasks recomendadas", nItens, dados: { recomendacoes: [{
//   taskId, titulo, compatibilidade (0-100), motivos: string[] }] } },
//   ordenado por compatibilidade DESC, LIMIT 10.
//   Regras: só tasks do projeto SEM responsável (responsavel_id IS NULL),
//   não excluídas (excluida_em IS NULL — soft-delete ETAPA 10) e não
//   concluídas (status != 'done').
//
// REGRA EXPLÍCITA DA SPEC §20: "Não bloquear usuário de assumir task por
// score baixo; matching é recomendação, não autorização." — este serviço só
// calcula e ordena; a rota /assumir continua livre para qualquer membro.
// Critério de aceite: "Recomendação é transparente e não impede escolha
// manual" — `motivos` traz frases pt-BR por fator (compatível, oportunidade
// de aprendizado, neutro, etc.), tornando o score auditável.
//
// Observação de arredondamento (mesma técnica da ETAPA 16): cada fator
// arredonda seus pontos, então a soma das contribuições SEMPRE bate com a
// `compatibilidade` final (ex.: 27 + 25 + 15 + 10 + 10 = 87).
const db = require("../database/connection");
const AppError = require("../utils/errors");

const PESOS_TASK_MATCHING = {
  habilidades: 0.4, // 40%
  dificuldade: 0.25, // 25%
  funcao: 0.15, // 15%
  disponibilidade: 0.1, // 10%
  semResponsavel: 0.1, // 10%
};

// ENUM de nível (Tabelas.sql) → valor numérico para comparação
const VALOR_NIVEL = { iniciante: 1, intermediario: 2, avancado: 3 };
// ENUM de dificuldade da task (ETAPA 7 — Tabelas.sql) → valor numérico
const VALOR_DIFICULDADE = { iniciante: 1, intermediaria: 2, avancada: 3 };

function nivelParaValor(nivel) {
  return VALOR_NIVEL[nivel] || 0;
}

// Chave de habilidade para interseção: prefere habilidade_id (BD real);
// aceita habilidadeId (camelCase) e cai para o NOME quando a linha não traz id
// (defensivo — tolera mocks/views sem a coluna, mesma técnica da ETAPA 16).
function chaveHabilidade(linha) {
  const id = linha.habilidade_id !== undefined ? linha.habilidade_id : linha.habilidadeId;
  if (id !== null && id !== undefined) {
    return `id:${Number(id)}`;
  }
  return `nome:${String(linha.nome || linha.habilidade || "").toLowerCase()}`;
}

// Nível médio do usuário nas habilidades cadastradas (habilidades_usuario.nivel).
// 0 quando o usuário não tem nenhuma habilidade cadastrada.
function nivelMedioDoUsuario(usuario) {
  const habilidades = usuario.habilidades || [];
  if (habilidades.length === 0) return 0;
  const soma = habilidades.reduce((acc, h) => acc + nivelParaValor(h.nivel), 0);
  return soma / habilidades.length;
}

// ── Fatores (cada um retorna { pontos, percentual, motivos[] }) ──

// 40% — habilidades em comum: interseção usuário × task sobre o total de
// habilidades da task. Task sem habilidades → 0% (mesma regra do matching de
// projetos, ETAPA 16). Skills da task que o usuário NÃO tem aparecem nos
// motivos como "oportunidade de aprendizado" (transparência — spec §20).
function fatorHabilidades(usuario, task) {
  const chavesUsuario = new Set((usuario.habilidades || []).map(chaveHabilidade));
  const habilidadesTask = task.habilidades || [];
  const total = habilidadesTask.length;
  const emComum = habilidadesTask.filter((h) => chavesUsuario.has(chaveHabilidade(h)));
  const percentual = total > 0 ? emComum.length / total : 0;

  const motivos = [];
  for (const h of emComum) {
    motivos.push(`${h.nome || h.habilidade} compatível`);
  }
  for (const h of habilidadesTask) {
    if (!chavesUsuario.has(chaveHabilidade(h))) {
      motivos.push(`${h.nome || h.habilidade} é oportunidade de aprendizado`);
    }
  }
  if (total === 0) {
    motivos.push("Task sem habilidades cadastradas");
  }

  return {
    pontos: Math.round(percentual * PESOS_TASK_MATCHING.habilidades * 100),
    percentual,
    motivos,
  };
}

// 25% — dificuldade: compara a dificuldade da task com o nível médio do
// usuário nas skills cadastradas. Nível médio >= dificuldade → 100%; abaixo →
// proporcional (media/dificuldade). Usuário sem habilidades → 0% (não há
// como comparar). Não pune usuário sobre-qualificado (mesma regra da ETAPA 16:
// media >= desejado → 100%).
function fatorDificuldade(usuario, task) {
  const valorDificuldade = VALOR_DIFICULDADE[task.dificuldade];
  const media = nivelMedioDoUsuario(usuario);

  let percentual;
  let motivo;
  if (!valorDificuldade) {
    percentual = 0;
    motivo = "Dificuldade não informada";
  } else if (media === 0) {
    percentual = 0;
    motivo = "Sem habilidades cadastradas para comparar dificuldade";
  } else if (media >= valorDificuldade) {
    percentual = 1;
    motivo = `Dificuldade ${task.dificuldade} compatível com seu nível médio (${media.toFixed(1)})`;
  } else {
    percentual = media / valorDificuldade;
    motivo = `Dificuldade ${task.dificuldade} acima do seu nível médio (${media.toFixed(1)})`;
  }

  return {
    pontos: Math.round(percentual * PESOS_TASK_MATCHING.dificuldade * 100),
    percentual,
    motivos: [motivo],
  };
}

// 15% — função no projeto: BINÁRIA — o membro tem função registrada no
// projeto (membros_equipe.funcao_id JOIN funcoes, ou `funcao` legada em
// texto livre). Sem função registrada → 0. A task não tem coluna de função,
// então o critério avalia a atuação do membro no squad (ETAPA 6).
function fatorFuncao(usuario) {
  const funcao = usuario.funcaoProjeto;
  const temFuncao = Boolean(funcao && (funcao.funcaoId || funcao.nome));
  const percentual = temFuncao ? 1 : 0;
  const motivos = temFuncao
    ? [`Função no projeto: ${funcao.nome || `id ${funcao.funcaoId}`}`]
    : ["Você não tem função definida neste projeto"];
  return {
    pontos: Math.round(percentual * PESOS_TASK_MATCHING.funcao * 100),
    percentual,
    motivos,
  };
}

// 10% — disponibilidade: >= 1h → 100%; null/ausente → neutro 50% (perfil
// incompleto não pune nem favorece); 0 declarado → 0%.
function fatorDisponibilidade(usuario) {
  const horas = usuario.disponibilidadeHorasSemana;
  let percentual;
  let motivo;
  if (horas === null || horas === undefined) {
    percentual = 0.5;
    motivo = "Disponibilidade não informada — considerada neutra (50%)";
  } else if (Number(horas) >= 1) {
    percentual = 1;
    motivo = `Disponibilidade compatível (${horas}h/semana)`;
  } else {
    percentual = 0;
    motivo = "Disponibilidade declarada como 0h/semana";
  }
  return {
    pontos: Math.round(percentual * PESOS_TASK_MATCHING.disponibilidade * 100),
    percentual,
    motivos: [motivo],
  };
}

// 10% — sem responsável: task livre (responsavel_id IS NULL) → 100%. O
// serviço só recomenda tasks SEM responsável (filtro na query + em memória),
// então o fator é sempre 100% para candidatas — a função é pura e documenta
// a regra; chamada direta com task já atribuída devolve 0.
function fatorSemResponsavel(task) {
  const semResponsavel = task.responsavel_id === null || task.responsavel_id === undefined;
  const percentual = semResponsavel ? 1 : 0;
  const motivos = semResponsavel
    ? ["Task disponível — sem responsável"]
    : ["Task já tem responsável"];
  return {
    pontos: Math.round(percentual * PESOS_TASK_MATCHING.semResponsavel * 100),
    percentual,
    motivos,
  };
}

/**
 * Calcula a compatibilidade 0-100 de uma task para um usuário, com motivos
 * legíveis em pt-BR por fator (critério de aceite da ETAPA 17: recomendação
 * transparente). Função PURA — não consulta o banco.
 * `usuario` = { id, disponibilidadeHorasSemana, habilidades: [{habilidadeId,
 * nome, nivel}], funcaoProjeto: {funcaoId, nome} | null }
 * `task` = { id, titulo, status, dificuldade, responsavel_id, habilidades:
 * [{habilidadeId, nome}] }
 * @returns {{compatibilidade: number, motivos: string[]}}
 */
function calcularCompatibilidadeTask(usuario, task) {
  const fHabilidades = fatorHabilidades(usuario, task);
  const fDificuldade = fatorDificuldade(usuario, task);
  const fFuncao = fatorFuncao(usuario);
  const fDisponibilidade = fatorDisponibilidade(usuario);
  const fSemResponsavel = fatorSemResponsavel(task);

  const compatibilidade = Math.max(
    0,
    Math.min(
      100,
      fHabilidades.pontos +
        fDificuldade.pontos +
        fFuncao.pontos +
        fDisponibilidade.pontos +
        fSemResponsavel.pontos
    )
  );

  const motivos = [
    ...fHabilidades.motivos,
    ...fDificuldade.motivos,
    ...fFuncao.motivos,
    ...fDisponibilidade.motivos,
    ...fSemResponsavel.motivos,
  ];

  return { compatibilidade, motivos };
}

/**
 * Recomenda até 10 tasks do projeto adequadas ao usuário autenticado.
 * Regras: (1) o usuário precisa ser membro ATIVO do projeto
 * (membros_equipe.status = 'ativo') OU o dono do projeto (criador_id — o
 * dono gerencia o squad e também pode ver, mesmo sem ser membro ativo);
 * vínculo antigo ('saiu'/'removido') NÃO vale → 403. (2) Candidatas: tasks
 * do projeto SEM responsável (responsavel_id IS NULL), não excluídas
 * (excluida_em IS NULL — soft-delete ETAPA 10) e não concluídas
 * (status != 'done'). (3) Ordenadas por compatibilidade DESC, LIMIT 10.
 * Matching é RECOMENDAÇÃO, não autorização (spec §20): score baixo NUNCA
 * bloqueia o usuário de assumir a task manualmente.
 * @param {number|string} projetoId
 * @param {number|string} usuarioId
 * @returns {Promise<Array<{taskId: number, titulo: string, compatibilidade: number, motivos: string[]}>|null>}
 *   null quando o projeto não existe (o controller responde 404).
 */
async function recomendarTasks(projetoId, usuarioId) {
  const idProjeto = Number(projetoId);
  const idUsuario = Number(usuarioId);

  // 1. Projeto existe + quem é o dono. Defesa em profundidade: o middleware
  //    somenteMembroOuDonoDoProjeto já garantiu 404/403 na rota, mas o
  //    service é chamável direto (testes/outros callers).
  const [projetoRows] = await db.query("SELECT criador_id FROM projetos WHERE id = ? LIMIT 1", [idProjeto]);
  if (projetoRows.length === 0) return null;
  const ehDono = Number(projetoRows[0].criador_id) === idUsuario;

  // 2. Função do usuário NO PROJETO (membros_equipe ETAPA 6 — só 'ativo').
  //    LEFT JOIN funcoes: o nome canônico vem de funcoes.nome; `funcao`
  //    (texto livre legado) é o fallback. O middleware deixou o usuário
  //    passar por ser dono OU por ter vínculo antigo — aqui o vínculo precisa
  //    ser ATIVO (spec §20: recomendar tasks "adequadas ao membro").
  const [membroRows] = await db.query(
    `SELECT me.funcao_id, me.funcao AS funcao_legada, f.nome AS funcao_nome
     FROM membros_equipe me
     LEFT JOIN funcoes f ON f.id = me.funcao_id
     WHERE me.projeto_id = ? AND me.usuario_id = ? AND me.status = 'ativo'
     LIMIT 1`,
    [idProjeto, idUsuario]
  );

  if (membroRows.length === 0 && !ehDono) {
    throw new AppError("Acesso negado: Requer ser membro ativo do projeto", 403);
  }

  // 3. Habilidades do usuário (ETAPA 3 — habilidades_usuario)
  const [habilidadesRows] = await db.query(
    `SELECT hu.habilidade_id, h.nome, hu.nivel
     FROM habilidades_usuario hu
     INNER JOIN habilidades h ON h.id = hu.habilidade_id
     WHERE hu.usuario_id = ?`,
    [idUsuario]
  );

  // 4. Disponibilidade declarada (ETAPA 3 — usuarios.disponibilidade_horas_semana)
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
    funcaoProjeto:
      membroRows.length > 0
        ? {
            funcaoId: membroRows[0].funcao_id,
            nome: membroRows[0].funcao_nome || membroRows[0].funcao_legada || null,
          }
        : null,
  };

  // 5. Tasks disponíveis do projeto: SEM responsável, não excluídas (ETAPA 10
  //    soft-delete) e não concluídas. Sem LIMIT: o Kanban de um projeto tem
  //    dezenas de tasks e truncar ANTES do score viesaria o top-10.
  const [tarefasRows] = await db.query(
    `SELECT t.id, t.titulo, t.descricao, t.status, t.dificuldade, t.responsavel_id, t.excluida_em
     FROM tarefas t
     WHERE t.projeto_id = ?
       AND t.responsavel_id IS NULL
       AND t.excluida_em IS NULL
       AND t.status NOT IN ('done')
     ORDER BY t.id`,
    [idProjeto]
  );

  if (tarefasRows.length === 0) return [];

  // 6. Habilidades das tasks candidatas (habilidades_tarefa → habilidades)
  const tarefaIds = [...new Set(tarefasRows.map((linha) => Number(linha.id)))];
  const [habilidadesTarefaRows] = await db.query(
    `SELECT ht.tarefa_id AS tarefaId, ht.habilidade_id AS habilidadeId, h.nome
     FROM habilidades_tarefa ht
     INNER JOIN habilidades h ON h.id = ht.habilidade_id
     WHERE ht.tarefa_id IN (?)`,
    [tarefaIds]
  );
  const habilidadesPorTarefa = {};
  for (const linha of habilidadesTarefaRows) {
    // Chaves defensivas (técnica da ETAPA 16): o SELECT usa aliases
    // camelCase (tarefaId/habilidadeId), mas o mock/DB pode entregar
    // snake_case (tarefa_id/habilidade_id) — aceita ambos.
    const tarefaId = linha.tarefaId !== undefined ? linha.tarefaId : linha.tarefa_id;
    const habilidadeId = linha.habilidadeId !== undefined ? linha.habilidadeId : linha.habilidade_id;
    const chave = String(tarefaId);
    if (!habilidadesPorTarefa[chave]) habilidadesPorTarefa[chave] = [];
    habilidadesPorTarefa[chave].push({ habilidadeId, nome: linha.nome });
  }

  // 7. Filtro em memória (defesa — espelha o WHERE do SQL para tolerar
  //    views/mocks sem as cláusulas): só tasks livres, não excluídas e não
  //    concluídas.
  const tarefas = tarefasRows
    .filter((t) => t.responsavel_id === null || t.responsavel_id === undefined)
    .filter((t) => !t.excluida_em)
    .filter((t) => t.status !== "done")
    .map((t) => ({
      id: Number(t.id),
      titulo: t.titulo,
      status: t.status,
      dificuldade: t.dificuldade,
      responsavel_id: t.responsavel_id,
      habilidades: habilidadesPorTarefa[String(t.id)] || [],
    }));

  // 8. Score por task, ordena decrescente e limita a 10 recomendações
  const recomendacoes = tarefas
    .map((task) => {
      const { compatibilidade, motivos } = calcularCompatibilidadeTask(usuario, task);
      return { taskId: task.id, titulo: task.titulo, compatibilidade, motivos };
    })
    .sort((a, b) => b.compatibilidade - a.compatibilidade)
    .slice(0, 10);

  return recomendacoes;
}

module.exports = {
  PESOS_TASK_MATCHING,
  calcularCompatibilidadeTask,
  recomendarTasks,
};
