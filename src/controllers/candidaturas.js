const db = require("../database/connection");
const AppError = require("../utils/errors");
const { criarNotificacao } = require("./notificacoes");

module.exports = {
  async candidatarSe(request, response, next) {
    try {
      const { projetoId } = request.params;
      const { vaga_id, mensagem } = request.body;
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

      // Usuário já membro ATIVO do squad não pode se candidatar novamente (ETAPA 5/6)
      const [membroRows] = await db.query(
        "SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? AND status = 'ativo'",
        [projetoId, usuarioId]
      );
      if (membroRows.length > 0) {
        return response.status(400).json({
          sucesso: false,
          message: "Você já é membro deste projeto",
          dados: null,
        });
      }

      // Candidatura duplicada: pendente → 409; aceita → já membro (400)
      const [candidaturaExist] = await db.query(
        "SELECT id, status FROM candidaturas WHERE usuario_id = ? AND projeto_id = ?",
        [usuarioId, projetoId]
      );

      if (candidaturaExist.length > 0) {
        const c = candidaturaExist[0];
        if (c.status === "pendente") {
          return response.status(409).json({
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

      // Vaga opcional (ETAPA 5 — candidatura direcionada por vaga)
      let vagaIdFinal = null;
      if (vaga_id !== undefined && vaga_id !== null && vaga_id !== "") {
        const vagaIdNum = Number(vaga_id);
        if (!Number.isInteger(vagaIdNum) || vagaIdNum <= 0) {
          return response.status(400).json({
            sucesso: false,
            message: "vaga_id deve ser um número inteiro positivo",
            dados: null,
          });
        }

        // Vaga deve pertencer ao projeto e estar aberta
        const [vagaRows] = await db.query(
          "SELECT id, projeto_id, status FROM vagas_projeto WHERE id = ? AND projeto_id = ? LIMIT 1",
          [vagaIdNum, projetoId]
        );
        if (
          vagaRows.length === 0 ||
          Number(vagaRows[0].projeto_id) !== Number(projetoId)
        ) {
          return response.status(400).json({
            sucesso: false,
            message: "Vaga não pertence a este projeto",
            dados: null,
          });
        }
        if (vagaRows[0].status !== "aberta") {
          return response.status(400).json({
            sucesso: false,
            message: "Vaga não está aberta",
            dados: null,
          });
        }
        vagaIdFinal = vagaIdNum;
      }

      const sql = `
        INSERT INTO candidaturas (usuario_id, projeto_id, vaga_id, status, mensagem)
        VALUES (?, ?, ?, 'pendente', ?);
      `;
      const [result] = await db.query(sql, [usuarioId, projetoId, vagaIdFinal, mensagem]);

      // Notifica o dono do projeto sobre a nova candidatura
      if (projetoExist[0].criador_id !== usuarioId) {
        await criarNotificacao(db, {
          usuario_id: projetoExist[0].criador_id,
          tipo: "application",
          titulo: "Nova candidatura",
          descricao: `${request.usuarioAutenticado.nome || "Um usuário"} quer entrar no projeto`,
          link: `/projetos/${projetoId}`,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: "Candidatura enviada com sucesso",
        dados: {
          id: result.insertId,
          usuario_id: usuarioId,
          projeto_id: projetoId,
          vaga_id: vagaIdFinal,
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
               c.vaga_id,
               u.nome AS usuario_nome, u.bio AS usuario_bio,
               v.funcao_id, f.nome AS funcao_nome
        FROM candidaturas c
        JOIN usuarios u ON c.usuario_id = u.id
        LEFT JOIN vagas_projeto v ON c.vaga_id = v.id
        LEFT JOIN funcoes f ON v.funcao_id = f.id
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
      let connection;
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
            "SELECT COUNT(*) as total FROM membros_equipe WHERE projeto_id = ? AND status = 'ativo'",
            [projetoId]
          );

          const limit = projRows[0]?.limite_membros || 5;
          const currentCount = membrosRows[0]?.total || 0;

          if (currentCount >= limit) {
            return response.status(400).json({
              sucesso: false,
              message: "O projeto já atingiu o limite de membros",
              dados: null,
            });
          }
        }

        // Transação: atualiza o status da candidatura e, se aceita, insere na equipe
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Atualiza status da candidatura
        await connection.query(
          "UPDATE candidaturas SET status = ? WHERE id = ?",
          [status === "aceito" ? "aceito" : "rejeitado", candidaturaId]
        );

        // Se aceito, insere na equipe do squad
        if (status === "aceito") {
          // Verifica se já está na equipe (como membro ATIVO)
          const [membRows] = await connection.query(
            "SELECT id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? AND status = 'ativo'",
            [projetoId, candidatura.usuario_id]
          );

          if (membRows.length === 0) {
            // ETAPA 6 — função do membro: vaga_id vem da candidatura e funcao_id
            // preferencialmente da vaga (JOIN vagas_projeto.funcao_id); o nome
            // textual `funcao` é preenchido com o nome da função da vaga.
            let funcaoIdVaga = null;
            let funcaoNomeVaga = null;
            if (candidatura.vaga_id) {
              const [vagaInfo] = await connection.query(
                "SELECT v.funcao_id, f.nome AS funcao_nome FROM vagas_projeto v " +
                  "LEFT JOIN funcoes f ON v.funcao_id = f.id WHERE v.id = ? LIMIT 1",
                [candidatura.vaga_id]
              );
              if (vagaInfo.length > 0) {
                funcaoIdVaga = vagaInfo[0].funcao_id;
                funcaoNomeVaga = vagaInfo[0].funcao_nome;
              }
            }

            await connection.query(
              "INSERT INTO membros_equipe (usuario_id, projeto_id, vaga_id, funcao_id, funcao, status) " +
                "VALUES (?, ?, ?, ?, ?, 'ativo')",
              [
                candidatura.usuario_id,
                projetoId,
                candidatura.vaga_id || null,
                funcaoIdVaga,
                funcaoNomeVaga || "Membro",
              ]
            );

            // ETAPA 5 — candidatura por vaga: incrementa a ocupação da vaga
            // e fecha a vaga quando preenchidas >= quantidade
            if (candidatura.vaga_id) {
              await connection.query(
                "UPDATE vagas_projeto SET preenchidas = preenchidas + 1 WHERE id = ?",
                [candidatura.vaga_id]
              );

              const [vagaRows] = await connection.query(
                "SELECT quantidade, preenchidas FROM vagas_projeto WHERE id = ? LIMIT 1",
                [candidatura.vaga_id]
              );
              if (
                vagaRows.length > 0 &&
                Number(vagaRows[0].preenchidas) >= Number(vagaRows[0].quantidade)
              ) {
                await connection.query(
                  "UPDATE vagas_projeto SET status = 'fechada' WHERE id = ?",
                  [candidatura.vaga_id]
                );
              }
            }
          }
        }

        await connection.commit();
        connection.release();
        connection = null;

        // Notifica o candidato quando a candidatura é aprovada
        if (status === "aceito") {
          await criarNotificacao(db, {
            usuario_id: candidatura.usuario_id,
            tipo: "approved",
            titulo: "Candidatura aprovada",
            descricao: "Sua candidatura foi aprovada",
            link: `/projetos/${projetoId}`,
          });
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
        if (connection) {
          try {
            await connection.rollback();
          } catch (rollbackError) {
            // Ignora falha no rollback (a conexão será liberada abaixo)
          }
          connection.release();
        }
        return next(new AppError("Erro ao processar candidatura", 500, error));
      }
    },
};

