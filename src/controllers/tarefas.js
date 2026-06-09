const db = require("../database/connection");

module.exports = {
  async listarTarefas(request, response) {
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
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao listar tarefas",
        dados: error.message,
      });
    }
  },

  async criarTarefa(request, response) {
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

      return response.status(200).json({
        sucesso: true,
        message: "Tarefa criada com sucesso",
        dados: {
          id: result.insertId,
          projeto_id: projetoId,
          responsavel_id,
          titulo,
          descricao,
          status: "todo",
          prioridade: prioridade || "medium",
          data_vencimento,
          subtasks: [],
        },
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao criar tarefa",
        dados: error.message,
      });
    }
  },

  async atualizarTarefa(request, response) {
    try {
      const { projetoId, tarefaId } = request.params;
      const { titulo, descricao, status, responsavel_id, prioridade, data_vencimento, subtasks } = request.body;

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
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao atualizar tarefa",
        dados: error.message,
      });
    }
  },

  async apagarTarefa(request, response) {
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
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao excluir tarefa",
        dados: error.message,
      });
    }
  },
};
