const db = require("../database/connection");

module.exports = {
  async listarProjetos(request, response) {
    try {
      const sql = `
        SELECT 
          p.id, 
          p.criador_id, 
          u.nome AS criador_nome, 
          p.titulo, 
          p.descricao, 
          p.status, 
          p.limite_membros, 
          p.criado_em,
          p.repositorio_url,
          p.figma_url,
          p.discord_url,
          p.documentacao_url,
          (SELECT COUNT(*) FROM membros_equipe WHERE projeto_id = p.id) AS total_membros
        FROM projetos p
        LEFT JOIN usuarios u ON p.criador_id = u.id
      `;

      const [row] = await db.query(sql);
      const nItens = row.length;

      return response.status(200).json({
        sucesso: true,
        message: "Lista de projetos",
        nItens,
        dados: row,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro na listagem de projetos ",
        dados: error.message,
      });
    }
  },
  async cadastrarProjeto(request, response) {
    try {
      const criador_id = request.usuarioAutenticado ? request.usuarioAutenticado.id : request.body.criador_id;
      const titulo = request.body.titulo || request.body.name;
      const descricao = request.body.descricao || request.body.description;
      const status = request.body.status || "aberto";
      const limite_membros = request.body.limite_membros || request.body.membersLimit || 5;
      const repositorio_url = request.body.repositorio_url || request.body.repositorioUrl || null;
      const figma_url = request.body.figma_url || request.body.figmaUrl || null;
      const discord_url = request.body.discord_url || request.body.discordUrl || null;
      const documentacao_url = request.body.documentacao_url || request.body.documentacaoUrl || null;

      if (!titulo) {
        return response.status(400).json({
          sucesso: false,
          message: "O título do projeto é obrigatório",
          dados: null,
        });
      }

      const sql = `
        INSERT INTO projetos (criador_id, titulo, descricao, status, limite_membros, repositorio_url, figma_url, discord_url, documentacao_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      const values = [criador_id, titulo, descricao, status, limite_membros, repositorio_url, figma_url, discord_url, documentacao_url];

      const [result] = await db.query(sql, values);

      const dados = {
        id: result.insertId,
        criador_id,
        titulo,
        descricao,
        status,
        limite_membros,
        repositorio_url,
        figma_url,
        discord_url,
        documentacao_url,
      };
      return response.status(200).json({
        sucesso: true,
        message: "Cadastro de projeto realizado com sucesso",
        dados
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro no cadastro de projeto",
        dados: error.message,
      });
    }
  },
  async editarProjeto(request, response) {
    try {
      const {
        criador_id,
        titulo,
        descricao,
        status,
        limite_membros,
        repositorio_url,
        figma_url,
        discord_url,
        documentacao_url,
        repositorioUrl,
        figmaUrl,
        discordUrl,
        documentacaoUrl
      } = request.body;
      const { id } = request.params;

      const repoUrl = repositorio_url !== undefined ? repositorio_url : repositorioUrl;
      const fgmUrl = figma_url !== undefined ? figma_url : figmaUrl;
      const dscUrl = discord_url !== undefined ? discord_url : discordUrl;
      const docUrl = documentacao_url !== undefined ? documentacao_url : documentacaoUrl;

      const fields = [];
      const values = [];

      if (criador_id !== undefined) { fields.push("criador_id = ?"); values.push(criador_id); }
      if (titulo !== undefined) { fields.push("titulo = ?"); values.push(titulo); }
      if (descricao !== undefined) { fields.push("descricao = ?"); values.push(descricao); }
      if (status !== undefined) { fields.push("status = ?"); values.push(status); }
      if (limite_membros !== undefined) { fields.push("limite_membros = ?"); values.push(limite_membros); }
      if (repoUrl !== undefined) { fields.push("repositorio_url = ?"); values.push(repoUrl); }
      if (fgmUrl !== undefined) { fields.push("figma_url = ?"); values.push(fgmUrl); }
      if (dscUrl !== undefined) { fields.push("discord_url = ?"); values.push(dscUrl); }
      if (docUrl !== undefined) { fields.push("documentacao_url = ?"); values.push(docUrl); }

      if (fields.length > 0) {
        values.push(id);
        const sql = `UPDATE projetos SET ${fields.join(", ")} WHERE id = ?;`;
        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
          return response.status(404).json({
            sucesso: false,
            message: `Projeto não encontrado!`,
            dados: null,
          });
        }
      }

      // Busca dados atuais do projeto para responder com o objeto completo
      const [projRows] = await db.query(
        "SELECT id, criador_id, titulo, descricao, status, limite_membros, repositorio_url, figma_url, discord_url, documentacao_url FROM projetos WHERE id = ? LIMIT 1",
        [id]
      );

      const dados = projRows[0] || {
        id,
        criador_id,
        titulo,
        descricao,
        status,
        limite_membros,
      };

      return response.status(200).json({
        sucesso: true,
        message: `Projeto atualizado com sucesso!`,
        dados
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro na edição de projeto",
        dados: error.message,
      });
    }
  },
  async obterProjeto(request, response) {
    try {
      const { id, projetoId } = request.params;
      const pId = projetoId || id;
      const usuarioLogadoId = request.usuarioAutenticado.id;

      if (!pId) {
        return response.status(400).json({
          sucesso: false,
          message: "ID do projeto não fornecido",
          dados: null,
        });
      }

      // 1. Busca dados gerais do projeto
      const sqlProj = `
        SELECT 
          p.id, 
          p.criador_id, 
          u.nome AS criador_nome, 
          p.titulo AS name, 
          p.descricao AS description, 
          p.status, 
          p.limite_membros AS membersLimit, 
          p.repositorio_url AS repositorioUrl,
          p.figma_url AS figmaUrl,
          p.discord_url AS discordUrl,
          p.documentacao_url AS documentacaoUrl,
          p.criado_em AS createdAt,
          (SELECT COUNT(*) FROM membros_equipe WHERE projeto_id = p.id) + 1 AS membersCount
        FROM projetos p
        LEFT JOIN usuarios u ON p.criador_id = u.id
        WHERE p.id = ?
        LIMIT 1
      `;

      const [projRows] = await db.query(sqlProj, [pId]);

      if (projRows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Projeto não encontrado",
          dados: null,
        });
      }

      const projeto = projRows[0];

      // Formata status para o padrão do frontend
      let mappedStatus = "Aberto";
      if (projeto.status === "em_andamento") mappedStatus = "Em andamento";
      if (projeto.status === "finalizado") mappedStatus = "Finalizado";
      projeto.status = mappedStatus;

      // 2. Busca tecnologias necessárias
      const sqlTechs = `
        SELECT h.nome
        FROM habilidades_projeto hp
        JOIN habilidades h ON hp.habilidade_id = h.id
        WHERE hp.projeto_id = ?
      `;
      const [techRows] = await db.query(sqlTechs, [pId]);
      projeto.technologies = techRows.map(row => row.nome);

      // 3. Busca membros da equipe (incluindo o proprietário/criador)
      const sqlMembers = `
        SELECT u.id, u.nome, 'Membro' AS role
        FROM membros_equipe me
        JOIN usuarios u ON me.usuario_id = u.id
        WHERE me.projeto_id = ?
      `;
      const [memberRows] = await db.query(sqlMembers, [pId]);
      
      const members = [
        {
          id: String(projeto.criador_id),
          name: projeto.criador_nome || "Dono",
          role: "Owner",
          skills: []
        },
        ...memberRows.map(m => ({
          id: String(m.id),
          name: m.nome,
          role: m.role,
          skills: []
        }))
      ];

      // Popula habilidades para cada membro do squad
      for (const m of members) {
        const [skillRows] = await db.query(
          `SELECT h.nome FROM habilidades_usuario hu 
           JOIN habilidades h ON hu.habilidade_id = h.id 
           WHERE hu.usuario_id = ?`,
          [m.id]
        );
        m.skills = skillRows.map(s => s.nome);
      }
      projeto.members = members;

      // 4. Busca tarefas do Kanban (com subtarefas)
      const [tasks] = await db.query(
        `SELECT t.id, t.titulo AS title, t.descricao AS description, t.status, 
                u.nome AS assignee, t.prioridade AS priority, t.data_vencimento AS dueDate
         FROM tarefas t
         LEFT JOIN usuarios u ON t.responsavel_id = u.id
         WHERE t.projeto_id = ?`,
        [pId]
      );

      for (const t of tasks) {
        const [subs] = await db.query(
          "SELECT id, titulo AS title, concluida AS done FROM subtarefas WHERE tarefa_id = ?",
          [t.id]
        );
        t.subtasks = subs.map(s => ({
          id: String(s.id),
          title: s.title,
          done: !!s.done
        }));
        t.id = String(t.id);
        if (t.dueDate) t.dueDate = new Date(t.dueDate).toISOString().split('T')[0];
      }
      projeto.tasks = tasks;

      // 5. Busca mensagens do Mural (ordenadas por mais recentes)
      const [msgRows] = await db.query(
        `SELECT m.id, u.nome AS author, m.conteudo AS content, m.criado_em AS createdAt
         FROM mensagens m
         JOIN usuarios u ON m.remetente_id = u.id
         WHERE m.projeto_id = ?
         ORDER BY m.criado_em DESC`,
        [pId]
      );
      projeto.messages = msgRows.map(m => ({
        id: String(m.id),
        author: m.author,
        content: m.content,
        createdAt: new Date(m.createdAt).toISOString()
      }));

      // 6. Busca candidaturas (apenas se for o criador do projeto)
      const isOwner = projeto.criador_id === usuarioLogadoId;
      if (isOwner) {
        const [candRows] = await db.query(
          `SELECT c.id, u.nome, c.mensagem, c.status, c.criado_em AS createdAt
           FROM candidaturas c
           JOIN usuarios u ON c.usuario_id = u.id
           WHERE c.projeto_id = ?`,
          [pId]
        );
        
        const applications = [];
        for (const c of candRows) {
          const [skillRows] = await db.query(
            `SELECT h.nome FROM habilidades_usuario hu 
             JOIN habilidades h ON hu.habilidade_id = h.id 
             WHERE hu.usuario_id = (SELECT usuario_id FROM candidaturas WHERE id = ?)`,
            [c.id]
          );
          applications.push({
            id: String(c.id),
            name: c.nome,
            message: c.mensagem,
            skills: skillRows.map(s => s.nome),
            createdAt: new Date(c.createdAt).toISOString(),
            status: c.status
          });
        }
        
        projeto.applications = applications.map(app => {
          let mappedAppStatus = "pending";
          if (app.status === "aceito") mappedAppStatus = "approved";
          if (app.status === "rejeitado") mappedAppStatus = "rejected";
          return {
            ...app,
            status: mappedAppStatus
          };
        });
      } else {
        const [myCandRows] = await db.query(
          `SELECT c.id, u.nome, c.mensagem, c.status, c.criado_em AS createdAt
           FROM candidaturas c
           JOIN usuarios u ON c.usuario_id = u.id
           WHERE c.projeto_id = ? AND c.usuario_id = ?`,
          [pId, usuarioLogadoId]
        );
        projeto.applications = myCandRows.map(c => {
          let mappedAppStatus = "pending";
          if (c.status === "aceito") mappedAppStatus = "approved";
          if (c.status === "rejeitado") mappedAppStatus = "rejected";
          return {
            id: String(c.id),
            name: c.nome,
            message: c.mensagem,
            skills: [],
            createdAt: new Date(c.createdAt).toISOString(),
            status: mappedAppStatus
          };
        });
      }

      projeto.longDescription = (projeto.description || "") + 
        " Este squad se reúne semanalmente para alinhar metas, revisar entregas e planejar próximos passos.";

      projeto.id = String(projeto.id);
      projeto.createdBy = projeto.criador_nome || "Desconhecido";
      projeto.createdAt = new Date(projeto.createdAt).toISOString();

      return response.status(200).json({
        sucesso: true,
        message: "Detalhes do projeto carregados com sucesso",
        dados: projeto,
      });

    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao obter detalhes do projeto",
        dados: error.message,
      });
    }
  },
  async apagarProjeto(request, response) {
    try {
      const { id } = request.params;

      const sql = `DELETE FROM projetos WHERE id = ?`;

      const [result] = await db.query(sql, [id]);

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: `Projeto ${id} não encontrado!`,
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: `Projeto ${id} deletado com sucesso!`,
        dados: null,
      });
    } catch (error) {
      return response.status(500).json({
        sucesso: false,
        message: "Erro ao deletar projeto",
        dados: error.message,
      });
    }
  },
};
