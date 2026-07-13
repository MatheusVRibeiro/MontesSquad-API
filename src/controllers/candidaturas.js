const db = require("../database/connection");
const AppError = require("../utils/errors");

module.exports = {
  async candidatarSe(request, response, next) {
    try {
      const { projetoId } = request.params;
      const { mensagem } = request.body;
      const usuarioId = request.usuarioAutenticado.id;

      // Verifica se o projeto existe
      const [projetoExist] = await db.query(
        "SELECT id, criador_id FROM projetos WHERE id = ?",
        [projetoId]
      );
      if (projetoExist.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Projeto não encontrado",
          dados: null,
        });
      }

      // Dono do projeto não pode candidatar-se ao próprio projeto
      if (projetoExist[0].criador_id === usuarioId) {
        return response.status(400).json({
          sucesso: false,
          message: "Você não pode se candidatar ao seu próprio projeto",
          dados: null,
        });
      }

      // Verifica se já existe uma candidatura pendente ou aceita
      const [candidaturaExist] = await db.query(
        "SELECT id, status FROM candidaturas WHERE usuario_id = ? AND projeto_id = ?",
        [usuarioId, projetoId]
      );

      if (candidaturaExist.length > 0) {
        const c = candidaturaExist[0];
        if (c.status === "pendente") {
          return response.status(400).json({
            sucesso: false,
            message: "Você já possui uma candidatura pendente para este projeto",
            dados: null,
          });
        } else if (c.status === "aceito") {
          return response.status(400).json({
            sucesso: false,
            message: "Você já é membro deste projeto",
            dados: null,
          });
        }
      }

      const sql = `
        INSERT INTO candidaturas (usuario_id, projeto_id, status, mensagem)
        VALUES (?, ?, 'pendente', ?);
      `;
      const [result] = await db.query(sql, [usuarioId, projetoId, mensagem]);

      return response.status(200).json({
        sucesso: true,
        message: "Candidatura enviada com sucesso",
        dados: {
          id: result.insertId,
          usuario_id: usuarioId,
          projeto_id: projetoId,
          status: "pendente",
          mensagem,
        },
      });
    } catch (error) {
      return next(new AppError("Erro ao enviar candidatura", 500, error));
    }
  },

  async listarCandidaturas(request, response, next) {
    try {
      const { projetoId } = request.params;

      const sql = `
        SELECT c.id, c.usuario_id, c.status, c.mensagem, c.criado_em,
               u.nome AS usuario_nome, u.bio AS usuario_bio
        FROM candidaturas c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.projeto_id = ? AND c.status = 'pendente'
      `;

      const [rows] = await db.query(sql, [projetoId]);

      return response.status(200).json({
        sucesso: true,
        message: "Candidaturas pendentes",
        nItens: rows.length,
        dados: rows,
      });
    } catch (error) {
      return next(new AppError("Erro ao listar candidaturas", 500, error));
    }
  },

  async atualizarStatusCandidatura(request, response, next) {
    try {
      const { projetoId, candidaturaId } = request.params;
      const { status } = request.body; // 'aceito' ou 'rejeitado'

      if (status !== "aceito" && status !== "rejeitado") {
        return response.status(400).json({
          sucesso: false,
          message: "Status inválido (use 'aceito' ou 'rejeitado')",
          dados: null,
        });
      }

      // Busca a candidatura
      const [candRows] = await db.query(
        "SELECT * FROM candidaturas WHERE id = ? AND projeto_id = ? LIMIT 1",
        [candidaturaId, projetoId]
      );

      if (candRows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Candidatura não encontrada",
          dados: null,
        });
      }

      const candidatura = candRows[0];

      if (candidatura.status !== "pendente") {
        return response.status(400).json({
          sucesso: false,
          message: `Esta candidatura já foi ${candidatura.status === "aceito" ? "aceita" : "rejeitada"}`,
          dados: null,
        });
      }

      // Se for aceitar, verifica limite de membros do projeto
      if (status === "aceito") {
        const [projRows] = await db.query(
          "SELECT limite_membros FROM projetos WHERE id = ?",
          [projetoId]
        );
        const [membrosRows] = await db.query(
          "SELECT COUNT(*) as count FROM membros_equipe WHERE projeto_id = ?",
          [projetoId]
        );

        const limit = projRows[0]?.limite_membros || 5;
        const currentCount = membrosRows[0]?.count || 0;

        if (currentCount >= limit) {
          return response.status(400).json({
            sucesso: false,
            message: "O projeto já atingiu o limite de membros",
            dados: null,
          });
        }
      }

      // Atualiza status da candidatura
      await db.query(
        "UPDATE candidaturas SET status = ? WHERE id = ?",
        [status === "aceito" ? "aceito" : "rejeitado", candidaturaId]
      );

      // Se aceito, insere na equipe do squad
      if (status === "aceito") {
        // Verifica se já está na equipe
        const [membRows] = await db.query(
          "SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ?",
          [projetoId, candidatura.usuario_id]
        );

        if (membRows.length === 0) {
          await db.query(
            "INSERT INTO membros_equipe (usuario_id, projeto_id, funcao) VALUES (?, ?, ?)",
            [candidatura.usuario_id, projetoId, "Membro"]
          );
        }
      }

      return response.status(200).json({
        sucesso: true,
        message: `Candidatura ${status === "aceito" ? "aprovada" : "recusada"} com sucesso`,
        dados: {
          id: candidaturaId,
          status: status === "aceito" ? "aceito" : "rejeitado",
        },
      });
    } catch (error) {
      return next(new AppError("Erro ao processar candidatura", 500, error));
    }
  },
};

