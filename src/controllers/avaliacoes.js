const db = require("../database/connection");
const AppError = require("../utils/errors");

module.exports = {
  async cadastrarAvaliacao(request, response, next) {
    try {
      const { projetoId, id } = request.params;
      const pId = Number(projetoId || id);
      const avaliadorId = Number(request.usuarioAutenticado?.id);

      const avaliadoId = Number(request.body.avaliado_id ?? request.body.avaliadoId);
      const nota = Number(request.body.nota);
      const comentario =
        typeof request.body.comentario === "string" && request.body.comentario.trim()
          ? request.body.comentario.trim()
          : null;

      if (!pId || Number.isNaN(pId)) {
        return response.status(400).json({
          sucesso: false,
          message: "ID do projeto inválido",
          dados: null,
        });
      }

      if (!avaliadoId || Number.isNaN(avaliadoId)) {
        return response.status(400).json({
          sucesso: false,
          message: "ID do usuário avaliado é obrigatório",
          dados: null,
        });
      }

      if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
        return response.status(400).json({
          sucesso: false,
          message: "A nota deve ser um número inteiro entre 1 e 5",
          dados: null,
        });
      }

      if (avaliadorId === avaliadoId) {
        return response.status(400).json({
          sucesso: false,
          message: "Você não pode avaliar a si mesmo",
          dados: null,
        });
      }

      // 1. Verifica se o projeto existe
      const [projRows] = await db.query(
        "SELECT id, criador_id, titulo, status FROM projetos WHERE id = ? LIMIT 1",
        [pId]
      );

      if (projRows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Projeto não encontrado",
          dados: null,
        });
      }

      const projeto = projRows[0];

      // 2. Avaliações só são permitidas após a finalização do projeto
      if (projeto.status !== "finalizado") {
        return response.status(400).json({
          sucesso: false,
          message: "Avaliações só podem ser realizadas após a finalização do projeto",
          dados: null,
        });
      }

      // 3. Valida se o avaliador fez parte do squad (dono ou membro)
      const ehAvaliadorDono = Number(projeto.criador_id) === avaliadorId;
      const [membroAvaliadorRows] = await db.query(
        "SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? AND (status IS NULL OR status = 'ativo') LIMIT 1",
        [pId, avaliadorId]
      );
      const ehAvaliadorMembro = membroAvaliadorRows.length > 0;

      if (!ehAvaliadorDono && !ehAvaliadorMembro) {
        return response.status(403).json({
          sucesso: false,
          message: "Acesso negado: Apenas participantes do squad deste projeto podem avaliar",
          dados: null,
        });
      }

      // 4. Valida se o avaliado fez parte do squad (dono ou membro)
      const ehAvaliadoDono = Number(projeto.criador_id) === avaliadoId;
      const [membroAvaliadoRows] = await db.query(
        "SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? AND (status IS NULL OR status = 'ativo') LIMIT 1",
        [pId, avaliadoId]
      );
      const ehAvaliadoMembro = membroAvaliadoRows.length > 0;

      if (!ehAvaliadoDono && !ehAvaliadoMembro) {
        return response.status(400).json({
          sucesso: false,
          message: "O usuário avaliado não faz parte deste squad",
          dados: null,
        });
      }

      // 5. Garante unicidade: cada pessoa só pode avaliar outra pessoa UMA vez por projeto
      const [existenteRows] = await db.query(
        "SELECT id FROM avaliacoes WHERE projeto_id = ? AND avaliador_id = ? AND avaliado_id = ? LIMIT 1",
        [pId, avaliadorId, avaliadoId]
      );

      if (existenteRows.length > 0) {
        return response.status(409).json({
          sucesso: false,
          message: "Você já avaliou este colega neste projeto",
          dados: null,
        });
      }

      // 6. Insere a avaliação
      const [insertResult] = await db.query(
        `INSERT INTO avaliacoes (avaliador_id, avaliado_id, projeto_id, nota, comentario)
         VALUES (?, ?, ?, ?, ?)`,
        [avaliadorId, avaliadoId, pId, nota, comentario]
      );

      // 7. Atualiza médias e total de avaliações do usuário avaliado (best-effort)
      try {
        await db.query(
          `UPDATE usuarios
           SET 
             media_notas = (SELECT ROUND(COALESCE(AVG(nota), 0), 2) FROM avaliacoes WHERE avaliado_id = ?),
             total_avaliacoes = (SELECT COUNT(*) FROM avaliacoes WHERE avaliado_id = ?)
           WHERE id = ?`,
          [avaliadoId, avaliadoId, avaliadoId]
        );
      } catch {
        // Silencioso em mocks que não possuem triggers/tabelas completas
      }

      // 8. Envia notificação ao usuário avaliado (best-effort)
      try {
        await db.query(
          `INSERT INTO notificacoes (usuario_id, tipo, mensagem, lida)
           VALUES (?, 'avaliacao', ?, 0)`,
          [
            avaliadoId,
            `Você recebeu uma nova avaliação no projeto "${projeto.titulo}".`,
          ]
        );
      } catch {
        // Silencioso em mocks
      }

      return response.status(201).json({
        sucesso: true,
        message: "Avaliação registrada com sucesso!",
        dados: {
          id: insertResult.insertId,
          projeto_id: pId,
          avaliador_id: avaliadorId,
          avaliado_id: avaliadoId,
          nota,
          comentario,
        },
      });
    } catch (error) {
      return next(new AppError("Erro ao registrar avaliação", 500, error));
    }
  },

  async listarAvaliacoesProjeto(request, response, next) {
    try {
      const { projetoId, id } = request.params;
      const pId = Number(projetoId || id);
      const usuarioLogadoId = Number(request.usuarioAutenticado?.id);

      if (!pId || Number.isNaN(pId)) {
        return response.status(400).json({
          sucesso: false,
          message: "ID do projeto inválido",
          dados: null,
        });
      }

      const [projRows] = await db.query(
        "SELECT id, criador_id, status FROM projetos WHERE id = ? LIMIT 1",
        [pId]
      );

      if (projRows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Projeto não encontrado",
          dados: null,
        });
      }

      // Busca todas as avaliações deste projeto
      const [rows] = await db.query(
        `SELECT a.id, a.projeto_id, a.avaliador_id, u1.nome AS avaliador_nome,
                a.avaliado_id, u2.nome AS avaliado_nome,
                a.nota, a.comentario, a.criado_em
         FROM avaliacoes a
         JOIN usuarios u1 ON a.avaliador_id = u1.id
         JOIN usuarios u2 ON a.avaliado_id = u2.id
         WHERE a.projeto_id = ?
         ORDER BY a.criado_em DESC`,
        [pId]
      );

      // Mapeia os IDs dos usuários que o usuário logado já avaliou neste projeto
      const avaliadosPeloUsuario = rows
        .filter((r) => Number(r.avaliador_id) === usuarioLogadoId)
        .map((r) => Number(r.avaliado_id));

      return response.status(200).json({
        sucesso: true,
        message: "Avaliações do projeto",
        dados: {
          avaliacoes: rows,
          avaliadosPorMim: avaliadosPeloUsuario,
        },
      });
    } catch (error) {
      return next(new AppError("Erro ao listar avaliações do projeto", 500, error));
    }
  },
};

