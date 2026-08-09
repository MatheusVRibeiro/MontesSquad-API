const db = require("../database/connection");
const AppError = require("../utils/errors");
const { criarNotificacao } = require("./notificacoes");

const PRIORIDADES_VALIDAS = ["low", "medium", "high"];
const STATUS_VALIDOS = ["todo", "doing", "review", "done"];
const DIFICULDADES_VALIDAS = ["iniciante", "intermediaria", "avancada"];

// ETAPA 7: carrega os NOMES das habilidades vinculadas a uma tarefa (JOIN
// habilidades_tarefa → habilidades). Usado em criar/atualizar (uma tarefa).
async function carregarHabilidadesTarefa(db, tarefaId) {
  const [rows] = await db.query(
    `SELECT h.nome
     FROM habilidades_tarefa ht
     JOIN habilidades h ON h.id = ht.habilidade_id
     WHERE ht.tarefa_id = ?
     ORDER BY h.nome`,
    [tarefaId]
  );
  return rows.map((r) => r.nome);
}

// ETAPA 7: valida o array de ids de habilidades (quando informado). Retorna a
// mensagem de erro ou null quando válido.
function validarHabilidades(habilidades) {
  if (habilidades === undefined) return null;
  if (!Array.isArray(habilidades)) {
    return "habilidades deve ser um array de ids";
  }
  if (habilidades.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
    return "habilidades deve conter apenas ids válidos";
  }
  return null;
}

// ETAPA 9: registra uma troca de responsável na tabela
// historico_responsaveis_tarefa. `usuarioId` é o responsável envolvido na ação
// e `realizadoPor` é quem executou (o próprio usuário em assumiu/abandonou; o
// owner em removido/reatribuido). O histórico NUNCA é apagado — é a evidência
// de contribuição exigida pelo critério de aceite da ETAPA 9.
async function registrarHistoricoResponsavel({ tarefaId, usuarioId, acao, realizadoPor }) {
  await db.query(
    `INSERT INTO historico_responsaveis_tarefa (tarefa_id, usuario_id, acao, realizado_por)
     VALUES (?, ?, ?, ?)`,
    [tarefaId, usuarioId, acao, realizadoPor ?? null]
  );
}

module.exports = {
  async listarTarefas(request, response, next) {
    try {
      const { projetoId } = request.params;

      // ETAPA 10: filtra tarefas arquivadas (soft-delete) — excluida_em IS NULL.
      // Tarefa excluída SOME do Kanban, mas a linha (e todo o histórico vinculado:
      // commits/PRs GitHub, historico_responsaveis_tarefa) permanece no banco.
      const [tasks] = await db.query(
        `SELECT t.*, u.nome AS responsavel_nome
         FROM tarefas t
         LEFT JOIN usuarios u ON t.responsavel_id = u.id
         WHERE t.projeto_id = ? AND t.excluida_em IS NULL`,
        [projetoId]
      );

      // Carrega subtarefas para cada tarefa
      for (const t of tasks) {
        const [subs] = await db.query(
          "SELECT id, titulo, concluida AS done FROM subtarefas WHERE tarefa_id = ?",
          [t.id]
        );
        t.subtasks = subs.map(s => ({
          ...s,
          done: !!s.done // Converte 1/0 para boolean
        }));
      }

      // ETAPA 7: carrega as habilidades (nomes) de todas as tarefas do projeto
      // em uma única query (JOIN habilidades_tarefa → habilidades) e agrupa.
      const [habRows] = await db.query(
        `SELECT ht.tarefa_id, h.nome
         FROM habilidades_tarefa ht
         JOIN habilidades h ON h.id = ht.habilidade_id
         JOIN tarefas t ON t.id = ht.tarefa_id
         WHERE t.projeto_id = ?
         ORDER BY h.nome`,
        [projetoId]
      );
      const habilidadesPorTarefa = {};
      for (const row of habRows) {
        (habilidadesPorTarefa[row.tarefa_id] ||= []).push(row.nome);
      }
      for (const t of tasks) {
        t.habilidades = habilidadesPorTarefa[t.id] || [];
      }

      return response.status(200).json({
        sucesso: true,
        message: "Lista de tarefas do Kanban",
        nItens: tasks.length,
        dados: tasks,
      });
    } catch (error) {
      return next(new AppError("Erro ao listar tarefas", 500, error));
    }
  },

  async criarTarefa(request, response, next) {
    try {
      const { projetoId } = request.params;
      const { titulo, descricao, responsavel_id, prioridade, data_vencimento, dificuldade, habilidades } = request.body;

      if (!titulo) {
        return response.status(400).json({
          sucesso: false,
          message: "O título da tarefa é obrigatório",
          dados: null,
        });
      }

      // Valida prioridade (se fornecida)
      if (prioridade !== undefined && !PRIORIDADES_VALIDAS.includes(prioridade)) {
        return response.status(400).json({
          sucesso: false,
          message: "Prioridade inválida (use 'low', 'medium' ou 'high')",
          dados: null,
        });
      }

      // ETAPA 7: valida dificuldade (se fornecida)
      if (dificuldade !== undefined && !DIFICULDADES_VALIDAS.includes(dificuldade)) {
        return response.status(400).json({
          sucesso: false,
          message: "Dificuldade inválida (use 'iniciante', 'intermediaria' ou 'avancada')",
          dados: null,
        });
      }

      // ETAPA 7: valida habilidades (se fornecidas)
      const erroHabilidades = validarHabilidades(habilidades);
      if (erroHabilidades) {
        return response.status(400).json({
          sucesso: false,
          message: erroHabilidades,
          dados: null,
        });
      }

      const sql = `
        INSERT INTO tarefas (projeto_id, responsavel_id, titulo, descricao, status, prioridade, data_vencimento, dificuldade)
        VALUES (?, ?, ?, ?, 'todo', ?, ?, ?);
      `;
      const values = [
        projetoId,
        responsavel_id || null,
        titulo,
        descricao || null,
        prioridade || "medium",
        data_vencimento || null,
        dificuldade || "intermediaria",
      ];

      const [result] = await db.query(sql, values);
      const novaTarefaId = result.insertId;

      // ETAPA 7: vincula as habilidades à tarefa recém-criada (best-effort —
      // id inexistente não derruba a criação; o DELETE em cascata das FKs
      // cuida da consistência quando a tarefa/habilidade for removida).
      if (Array.isArray(habilidades) && habilidades.length > 0) {
        try {
          for (const habilidadeId of habilidades) {
            await db.query(
              "INSERT INTO habilidades_tarefa (tarefa_id, habilidade_id) VALUES (?, ?)",
              [novaTarefaId, habilidadeId]
            );
          }
        } catch (e) {
          console.error("[tarefas] Falha ao vincular habilidades:", e.message);
        }
      }

      // ETAPA 7: se o projeto tem GitHub conectado, gera branch sugerida já na criação
      // (independentemente de responsável — o ID já existe).
      let githubBranch = null;
      const [projRows] = await db.query(
        "SELECT github_repository_id FROM projetos WHERE id = ? LIMIT 1",
        [projetoId]
      );
      if (projRows[0]?.github_repository_id) {
        const { gerarBranchTask } = require("../utils/slugify");
        githubBranch = gerarBranchTask(novaTarefaId, titulo);
        await db.query(
          "UPDATE tarefas SET github_branch = ? WHERE id = ? AND projeto_id = ?",
          [githubBranch, novaTarefaId, projetoId]
        );
      }

      // Notifica o responsável quando a tarefa é atribuída
      if (responsavel_id) {
        await criarNotificacao(db, {
          usuario_id: responsavel_id,
          tipo: "task",
          titulo: "Nova tarefa atribuída",
          descricao: "Você recebeu uma nova tarefa",
          link: `/projetos/${projetoId}`,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: "Tarefa criada com sucesso",
        dados: {
          id: novaTarefaId,
          projeto_id: projetoId,
          responsavel_id,
          titulo,
          descricao,
          status: "todo",
          prioridade: prioridade || "medium",
          data_vencimento,
          dificuldade: dificuldade || "intermediaria",
          habilidades: await carregarHabilidadesTarefa(db, novaTarefaId),
          github_branch: githubBranch,
          subtasks: [],
        },
      });
    } catch (error) {
      return next(new AppError("Erro ao criar tarefa", 500, error));
    }
  },

  async atualizarTarefa(request, response, next) {
    try {
      const { projetoId, tarefaId } = request.params;
      const { titulo, descricao, status, responsavel_id, prioridade, data_vencimento, dificuldade, habilidades, subtasks } = request.body;

      // Valida prioridade e status (quando fornecidos)
      if (prioridade !== undefined && !PRIORIDADES_VALIDAS.includes(prioridade)) {
        return response.status(400).json({
          sucesso: false,
          message: "Prioridade inválida (use 'low', 'medium' ou 'high')",
          dados: null,
        });
      }

      if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
        return response.status(400).json({
          sucesso: false,
          message: "Status inválido (use 'todo', 'doing', 'review' ou 'done')",
          dados: null,
        });
      }

      // ETAPA 7: valida dificuldade (se fornecida)
      if (dificuldade !== undefined && !DIFICULDADES_VALIDAS.includes(dificuldade)) {
        return response.status(400).json({
          sucesso: false,
          message: "Dificuldade inválida (use 'iniciante', 'intermediaria' ou 'avancada')",
          dados: null,
        });
      }

      // ETAPA 7: valida habilidades (se fornecidas)
      const erroHabilidades = validarHabilidades(habilidades);
      if (erroHabilidades) {
        return response.status(400).json({
          sucesso: false,
          message: erroHabilidades,
          dados: null,
        });
      }

      // 1. Atualiza dados da tarefa se fornecidos
      const fields = [];
      const values = [];

      if (titulo !== undefined) { fields.push("titulo = ?"); values.push(titulo); }
      if (descricao !== undefined) { fields.push("descricao = ?"); values.push(descricao); }
      if (status !== undefined) { fields.push("status = ?"); values.push(status); }
      if (responsavel_id !== undefined) { fields.push("responsavel_id = ?"); values.push(responsavel_id || null); }
      if (prioridade !== undefined) { fields.push("prioridade = ?"); values.push(prioridade); }
      if (data_vencimento !== undefined) { fields.push("data_vencimento = ?"); values.push(data_vencimento || null); }
      if (dificuldade !== undefined) { fields.push("dificuldade = ?"); values.push(dificuldade); }

      if (fields.length > 0) {
        values.push(tarefaId, projetoId);
        const sql = `UPDATE tarefas SET ${fields.join(", ")} WHERE id = ? AND projeto_id = ?`;
        await db.query(sql, values);
      }

      // ETAPA 7: substitui a lista de habilidades da tarefa (DELETE + INSERT)
      if (habilidades !== undefined) {
        await db.query("DELETE FROM habilidades_tarefa WHERE tarefa_id = ?", [tarefaId]);
        for (const habilidadeId of habilidades) {
          await db.query(
            "INSERT INTO habilidades_tarefa (tarefa_id, habilidade_id) VALUES (?, ?)",
            [tarefaId, habilidadeId]
          );
        }
      }

      // ETAPA 10: conclusão MANUAL — XP concedido pelo backend (idempotente).
      // Se a tarefa mudou para 'done' e possui responsável, concede XP manual.
      if (status === "done") {
        try {
          const [antes] = await db.query(
            "SELECT status, responsavel_id FROM tarefas WHERE id = ? AND projeto_id = ? LIMIT 1",
            [tarefaId, projetoId]
          );
          const linha = antes[0];
          if (linha && linha.status === "done" && linha.responsavel_id) {
            const xpService = require("../services/xp");
            await xpService.awardXpPorConclusaoManual({
              usuarioId: linha.responsavel_id,
              tarefaId: Number(tarefaId),
            });
            // ETAPA 12 — reputação técnica SEPARADA do XP: recalcula do banco ao
            // lado do XP (best-effort: falha não derruba a conclusão). Conclusão
            // manual não soma tasks_verificadas (só github_merge conta), mas o
            // recálculo mantém a tabela coerente com o restante das evidências.
            try {
              const reputacaoTecnica = require("../services/reputacaoTecnica");
              await reputacaoTecnica.recalcularReputacao(linha.responsavel_id);
            } catch (repError) {
              console.error("[tarefas] Falha ao recalcular reputação técnica:", repError.message);
            }
            // ETAPA 9 — registrar conclusão manual no histórico de responsáveis
            // (best-effort: falha não derruba a atualização da tarefa).
            try {
              await registrarHistoricoResponsavel({
                tarefaId: Number(tarefaId),
                usuarioId: linha.responsavel_id,
                acao: "concluiu",
                realizadoPor: linha.responsavel_id,
              });
            } catch (historicoError) {
              // histórico não deve derrubar a conclusão
            }
          }
        } catch (e) {
          // XP não deve derrubar a atualização da tarefa
          console.error("[tarefas] Falha ao conceder XP manual:", e.message);
        }
      }

      // 2. Atualiza checklist de subtarefas se fornecido
      if (Array.isArray(subtasks)) {
        // Limpa subtarefas anteriores
        await db.query("DELETE FROM subtarefas WHERE tarefa_id = ?", [tarefaId]);

        // Insere as novas
        for (const sub of subtasks) {
          await db.query(
            "INSERT INTO subtarefas (tarefa_id, titulo, concluida) VALUES (?, ?, ?)",
            [tarefaId, sub.title || sub.titulo, sub.done || sub.concluida || false]
          );
        }
      }

      // Retorna a tarefa atualizada
      const [taskRows] = await db.query(
        "SELECT * FROM tarefas WHERE id = ? AND projeto_id = ? LIMIT 1",
        [tarefaId, projetoId]
      );

      if (taskRows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Tarefa não encontrada",
          dados: null,
        });
      }

      const updatedTask = taskRows[0];
      const [subs] = await db.query(
        "SELECT id, titulo, concluida AS done FROM subtarefas WHERE tarefa_id = ?",
        [tarefaId]
      );
      updatedTask.subtasks = subs.map(s => ({ ...s, done: !!s.done }));
      updatedTask.habilidades = await carregarHabilidadesTarefa(db, tarefaId);

      return response.status(200).json({
        sucesso: true,
        message: "Tarefa atualizada com sucesso",
        dados: updatedTask,
      });
    } catch (error) {
      return next(new AppError("Erro ao atualizar tarefa", 500, error));
    }
  },

  async apagarTarefa(request, response, next) {
    try {
      const { projetoId, tarefaId } = request.params;

      // ETAPA 10: soft-delete — a tarefa NUNCA é apagada fisicamente (o histórico
      // de participação — subtarefas, habilidades, commits/PRs GitHub e
      // historico_responsaveis_tarefa — permanece como evidência). A linha só é
      // marcada com excluida_em = NOW() e some do Kanban (listarTarefas filtra
      // `excluida_em IS NULL`).
      const [result] = await db.query(
        "UPDATE tarefas SET excluida_em = NOW() WHERE id = ? AND projeto_id = ?",
        [tarefaId, projetoId]
      );

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Tarefa não encontrada",
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: "Tarefa excluída com sucesso",
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao excluir tarefa", 500, error));
    }
  },

  /**
   * POST /projetos/:projetoId/tarefas/:tarefaId/assumir — membro assume task livre (ETAPA 7).
   * Atômico: UPDATE com `responsavel_id IS NULL` — só um usuário vence a corrida.
   * Se projeto tem GitHub conectado, gera a branch task/{id}-{slug}.
   */
  async assumirTarefa(request, response, next) {
    const { gerarBranchTask } = require("../utils/slugify");
    try {
      const { projetoId, tarefaId } = request.params;
      const usuarioLogadoId = request.usuarioAutenticado.id;

      const [result] = await db.query(
        `UPDATE tarefas
         SET responsavel_id = ?, status = 'doing', assumida_em = NOW()
         WHERE id = ? AND projeto_id = ? AND responsavel_id IS NULL`,
        [usuarioLogadoId, tarefaId, projetoId]
      );

      if (result.affectedRows === 0) {
        // Consulta para distinguir 404 de 409
        const [rows] = await db.query(
          "SELECT id, responsavel_id FROM tarefas WHERE id = ? AND projeto_id = ? LIMIT 1",
          [tarefaId, projetoId]
        );
        if (rows.length === 0) {
          return response.status(404).json({
            sucesso: false,
            message: "Tarefa não encontrada",
            dados: null,
          });
        }
        return response.status(409).json({
          sucesso: false,
          message: "Tarefa já possui responsável",
          dados: null,
        });
      }

      // ETAPA 9: registra a assunção no histórico (evidência de contribuição).
      await registrarHistoricoResponsavel({
        tarefaId,
        usuarioId: usuarioLogadoId,
        acao: "assumiu",
        realizadoPor: usuarioLogadoId,
      });

      // Gera branch se o projeto estiver conectado ao GitHub
      const [projRows] = await db.query(
        "SELECT github_repository_id FROM projetos WHERE id = ? LIMIT 1",
        [projetoId]
      );
      let githubBranch = null;
      if (projRows[0]?.github_repository_id) {
        const [taskRows] = await db.query(
          "SELECT id, titulo FROM tarefas WHERE id = ? LIMIT 1",
          [tarefaId]
        );
        if (taskRows[0]) {
          githubBranch = gerarBranchTask(taskRows[0].id, taskRows[0].titulo);
          await db.query(
            "UPDATE tarefas SET github_branch = ? WHERE id = ? AND projeto_id = ?",
            [githubBranch, tarefaId, projetoId]
          );
        }
      }

      const [task] = await db.query(
        `SELECT t.id, t.titulo, t.status, t.github_branch, t.assumida_em,
                u.nome AS responsavel_nome
         FROM tarefas t
         LEFT JOIN usuarios u ON t.responsavel_id = u.id
         WHERE t.id = ? AND t.projeto_id = ?`,
        [tarefaId, projetoId]
      );

      return response.status(200).json({
        sucesso: true,
        message: "Tarefa assumida com sucesso",
        dados: task[0] || { id: tarefaId, status: "doing", github_branch: githubBranch },
      });
    } catch (error) {
      return next(new AppError("Erro ao assumir tarefa", 500, error));
    }
  },

  /**
   * POST /projetos/:projetoId/tarefas/:tarefaId/abandonar — apenas o responsável
   * ATUAL abandona a task (ETAPA 9). responsavel_id -> NULL, status volta para
   * 'todo'; commits já registrados e o histórico permanecem.
   */
  async abandonarTarefa(request, response, next) {
    try {
      const { projetoId, tarefaId } = request.params;
      const usuarioLogadoId = request.usuarioAutenticado.id;

      const [rows] = await db.query(
        "SELECT id, responsavel_id, status FROM tarefas WHERE id = ? AND projeto_id = ? LIMIT 1",
        [tarefaId, projetoId]
      );
      if (rows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Tarefa não encontrada",
          dados: null,
        });
      }

      const tarefa = rows[0];
      if (!tarefa.responsavel_id) {
        return response.status(409).json({
          sucesso: false,
          message: "Tarefa não possui responsável",
          dados: null,
        });
      }

      if (Number(tarefa.responsavel_id) !== Number(usuarioLogadoId)) {
        return response.status(403).json({
          sucesso: false,
          message: "Apenas o responsável atual pode abandonar a tarefa",
          dados: null,
        });
      }

      await db.query(
        "UPDATE tarefas SET responsavel_id = NULL, status = 'todo' WHERE id = ? AND projeto_id = ? AND responsavel_id = ?",
        [tarefaId, projetoId, usuarioLogadoId]
      );

      // ETAPA 9: histórico — quem abandonou também é o realizado_por.
      await registrarHistoricoResponsavel({
        tarefaId,
        usuarioId: usuarioLogadoId,
        acao: "abandonou",
        realizadoPor: usuarioLogadoId,
      });

      return response.status(200).json({
        sucesso: true,
        message: "Tarefa abandonada com sucesso",
        dados: { id: tarefa.id, status: "todo", responsavel_id: null },
      });
    } catch (error) {
      return next(new AppError("Erro ao abandonar tarefa", 500, error));
    }
  },

  /**
   * POST /projetos/:projetoId/tarefas/:tarefaId/remover-responsavel — somente
   * owner remove o responsável (ETAPA 9). responsavel_id -> NULL e o histórico
   * registra acao='removido' com realizado_por = owner.
   */
  async removerResponsavelTarefa(request, response, next) {
    try {
      const { projetoId, tarefaId } = request.params;
      const ownerId = request.usuarioAutenticado.id;

      const [rows] = await db.query(
        "SELECT id, responsavel_id, status FROM tarefas WHERE id = ? AND projeto_id = ? LIMIT 1",
        [tarefaId, projetoId]
      );
      if (rows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Tarefa não encontrada",
          dados: null,
        });
      }

      const tarefa = rows[0];
      if (!tarefa.responsavel_id) {
        return response.status(409).json({
          sucesso: false,
          message: "Tarefa não possui responsável",
          dados: null,
        });
      }

      await db.query(
        "UPDATE tarefas SET responsavel_id = NULL WHERE id = ? AND projeto_id = ? AND responsavel_id IS NOT NULL",
        [tarefaId, projetoId]
      );

      // ETAPA 9: histórico — usuario_id é quem foi removido; realizado_por é o owner.
      await registrarHistoricoResponsavel({
        tarefaId,
        usuarioId: tarefa.responsavel_id,
        acao: "removido",
        realizadoPor: ownerId,
      });

      return response.status(200).json({
        sucesso: true,
        message: "Responsável removido com sucesso",
        dados: { id: tarefa.id, status: tarefa.status, responsavel_id: null },
      });
    } catch (error) {
      return next(new AppError("Erro ao remover responsável da tarefa", 500, error));
    }
  },

  /**
   * POST /projetos/:projetoId/tarefas/:tarefaId/reatribuir — somente owner
   * reatribui a task a outro membro ATIVO do projeto (ETAPA 9). O histórico
   * registra acao='reatribuido' com realizado_por = owner.
   */
  async reatribuirTarefa(request, response, next) {
    try {
      const { projetoId, tarefaId } = request.params;
      const ownerId = request.usuarioAutenticado.id;
      const { usuario_id } = request.body;

      if (
        usuario_id === undefined ||
        usuario_id === null ||
        !Number.isInteger(Number(usuario_id)) ||
        Number(usuario_id) <= 0
      ) {
        return response.status(400).json({
          sucesso: false,
          message: "usuario_id (novo responsável) é obrigatório",
          dados: null,
        });
      }
      const novoResponsavelId = Number(usuario_id);

      const [rows] = await db.query(
        "SELECT id, responsavel_id FROM tarefas WHERE id = ? AND projeto_id = ? LIMIT 1",
        [tarefaId, projetoId]
      );
      if (rows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Tarefa não encontrada",
          dados: null,
        });
      }

      // Novo responsável precisa ser membro ATIVO do projeto
      const [membros] = await db.query(
        "SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? AND status = 'ativo' LIMIT 1",
        [projetoId, novoResponsavelId]
      );
      if (membros.length === 0) {
        return response.status(400).json({
          sucesso: false,
          message: "Novo responsável deve ser membro ativo do projeto",
          dados: null,
        });
      }

      await db.query(
        "UPDATE tarefas SET responsavel_id = ? WHERE id = ? AND projeto_id = ?",
        [novoResponsavelId, tarefaId, projetoId]
      );

      // ETAPA 9: histórico — usuario_id é o novo responsável; realizado_por é o owner.
      await registrarHistoricoResponsavel({
        tarefaId,
        usuarioId: novoResponsavelId,
        acao: "reatribuido",
        realizadoPor: ownerId,
      });

      const [taskRows] = await db.query(
        "SELECT id, titulo, status, responsavel_id FROM tarefas WHERE id = ? AND projeto_id = ? LIMIT 1",
        [tarefaId, projetoId]
      );

      return response.status(200).json({
        sucesso: true,
        message: "Tarefa reatribuída com sucesso",
        dados: taskRows[0] || { id: tarefaId, responsavel_id: novoResponsavelId },
      });
    } catch (error) {
      return next(new AppError("Erro ao reatribuir tarefa", 500, error));
    }
  },

  /**
   * GET /projetos/:projetoId/tarefas/:tarefaId/historico-responsaveis — membro/dono
   * consulta o histórico de responsáveis da task (ETAPA 9), com nome do usuário
   * (JOIN usuarios) e de quem realizou a ação.
   */
  async historicoResponsaveisTarefa(request, response, next) {
    try {
      const { tarefaId } = request.params;

      const [rows] = await db.query(
        `SELECT h.id, h.tarefa_id, h.usuario_id, h.acao, h.realizado_por, h.criado_em,
                u.nome AS usuario_nome, r.nome AS realizado_por_nome
         FROM historico_responsaveis_tarefa h
         LEFT JOIN usuarios u ON u.id = h.usuario_id
         LEFT JOIN usuarios r ON r.id = h.realizado_por
         WHERE h.tarefa_id = ?
         ORDER BY h.criado_em DESC, h.id DESC`,
        [tarefaId]
      );

      return response.status(200).json({
        sucesso: true,
        message: "Histórico de responsáveis da tarefa",
        nItens: rows.length,
        dados: rows,
      });
    } catch (error) {
      return next(new AppError("Erro ao listar histórico de responsáveis", 500, error));
    }
  },
};

