const db = require("../database/connection");
const AppError = require("../utils/errors");
const { criarNotificacao } = require("./notificacoes");

const PRIORIDADES_VALIDAS = ["low", "medium", "high"];
const STATUS_VALIDOS = ["todo", "doing", "review", "done"];

module.exports = {
  async listarTarefas(request, response, next) {
    try {
      const { projetoId } = request.params;

      const [tasks] = await db.query(
        `SELECT t.*, u.nome AS responsavel_nome
         FROM tarefas t
         LEFT JOIN usuarios u ON t.responsavel_id = u.id
         WHERE t.projeto_id = ?`,
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
      const { titulo, descricao, responsavel_id, prioridade, data_vencimento } = request.body;

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

      const sql = `
        INSERT INTO tarefas (projeto_id, responsavel_id, titulo, descricao, status, prioridade, data_vencimento)
        VALUES (?, ?, ?, ?, 'todo', ?, ?);
      `;
      const values = [
        projetoId,
        responsavel_id || null,
        titulo,
        descricao || null,
        prioridade || "medium",
        data_vencimento || null,
      ];

      const [result] = await db.query(sql, values);
      const novaTarefaId = result.insertId;

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
      const { titulo, descricao, status, responsavel_id, prioridade, data_vencimento, subtasks } = request.body;

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

      // 1. Atualiza dados da tarefa se fornecidos
      const fields = [];
      const values = [];

      if (titulo !== undefined) { fields.push("titulo = ?"); values.push(titulo); }
      if (descricao !== undefined) { fields.push("descricao = ?"); values.push(descricao); }
      if (status !== undefined) { fields.push("status = ?"); values.push(status); }
      if (responsavel_id !== undefined) { fields.push("responsavel_id = ?"); values.push(responsavel_id || null); }
      if (prioridade !== undefined) { fields.push("prioridade = ?"); values.push(prioridade); }
      if (data_vencimento !== undefined) { fields.push("data_vencimento = ?"); values.push(data_vencimento || null); }

      if (fields.length > 0) {
        values.push(tarefaId, projetoId);
        const sql = `UPDATE tarefas SET ${fields.join(", ")} WHERE id = ? AND projeto_id = ?`;
        await db.query(sql, values);
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

      const [result] = await db.query(
        "DELETE FROM tarefas WHERE id = ? AND projeto_id = ?",
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
};

