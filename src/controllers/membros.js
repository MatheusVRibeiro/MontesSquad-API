// Membros do squad — Evolução ETAPA 6 (função do membro com soft-delete)
//
// GET    /projetos/:projetoId/membros            (qualquer logado)  — lista SOMENTE
//         membros com status='ativo' (com vaga_id/funcao_id/funcao_nome para
//         responder "quem faz o quê"); histórico preservado nas linhas inativas.
// DELETE /projetos/:projetoId/membros/:usuarioId (owner)            — vira SOFT-DELETE:
//         UPDATE membros_equipe SET status='removido', saiu_em=NOW() (NUNCA DELETE
//         físico — commits/tasks/histórico permanecem) e libera a vaga vinculada
//         (preenchidas - 1, reabrindo quando preenchidas < quantidade).
// POST   /projetos/:projetoId/sair                (membro autenticado) — saída
//         voluntária: SOFT-DELETE status='saiu' + libera a vaga. Owner NÃO pode sair (400).
const db = require("../database/connection");
const AppError = require("../utils/errors");
const { registrarEvento } = require("../services/eventosProjeto");

const STATUS_ATIVO = "ativo";

// Libera a vaga vinculada ao membro: decrementa preenchidas (nunca abaixo de 0)
// e reabre a vaga (status='aberta') quando preenchidas < quantidade.
async function liberarVaga(conn, vagaId) {
  await conn.query(
    "UPDATE vagas_projeto SET preenchidas = GREATEST(preenchidas - 1, 0) WHERE id = ?",
    [vagaId]
  );

  const [vagaRows] = await conn.query(
    "SELECT quantidade, preenchidas, status FROM vagas_projeto WHERE id = ? LIMIT 1",
    [vagaId]
  );

  if (vagaRows.length > 0) {
    const vaga = vagaRows[0];
    if (
      Number(vaga.preenchidas) < Number(vaga.quantidade) &&
      vaga.status === "fechada"
    ) {
      await conn.query("UPDATE vagas_projeto SET status = 'aberta' WHERE id = ?", [
        vagaId,
      ]);
    }
  }
}

// Soft-delete do vínculo + liberação da vaga (comum à remoção pelo owner e à saída).
// Retorna true se algum vínculo ativo foi atualizado (senão 404).
async function aplicarSoftDelete(conn, projetoId, usuarioId, novoStatus) {
  const [result] = await conn.query(
    "UPDATE membros_equipe SET status = ?, saiu_em = NOW() " +
      "WHERE projeto_id = ? AND usuario_id = ? AND status = ?",
    [novoStatus, projetoId, usuarioId, STATUS_ATIVO]
  );

  if (result.affectedRows === 0) {
    return false;
  }

  // Vaga vinculada ao vínculo recém-inativado (último registro do usuário no projeto)
  const [membRows] = await conn.query(
    "SELECT vaga_id FROM membros_equipe WHERE projeto_id = ? AND usuario_id = ? " +
      "AND status = ? ORDER BY id DESC LIMIT 1",
    [projetoId, usuarioId, novoStatus]
  );

  if (membRows.length > 0 && membRows[0].vaga_id) {
    await liberarVaga(conn, membRows[0].vaga_id);
  }

  return true;
}

module.exports = {
  async listarMembros(request, response, next) {
    try {
      const { projetoId } = request.params;

      // ETAPA 6: apenas membros ATIVOS na listagem normal (o histórico com
      // status completo fica preservado no banco e no perfil/reputação).
      const sql = `
        SELECT me.id, me.usuario_id, me.funcao, me.funcao_id, f.nome AS funcao_nome,
               me.vaga_id, me.status, me.entrou_em, me.saiu_em,
               u.nome AS usuario_nome, u.email AS usuario_email, u.bio AS usuario_bio, u.localizacao AS usuario_localizacao
        FROM membros_equipe me
        JOIN usuarios u ON me.usuario_id = u.id
        LEFT JOIN funcoes f ON me.funcao_id = f.id
        WHERE me.projeto_id = ? AND me.status = 'ativo'
        ORDER BY me.entrou_em
      `;

      const [rows] = await db.query(sql, [projetoId]);

      return response.status(200).json({
        sucesso: true,
        message: "Membros do squad",
        nItens: rows.length,
        dados: rows,
      });
    } catch (error) {
      return next(new AppError("Erro ao listar membros do squad", 500, error));
    }
  },

  async removerMembro(request, response, next) {
    try {
      const { projetoId, usuarioId } = request.params;

      // Impede o dono de remover a si próprio (ele pode encerrar ou gerenciar, mas deve continuar dono)
      const [projRows] = await db.query(
        "SELECT criador_id FROM projetos WHERE id = ? LIMIT 1",
        [projetoId]
      );

      if (projRows.length > 0 && projRows[0].criador_id == usuarioId) {
        return response.status(400).json({
          sucesso: false,
          message: "O proprietário do projeto não pode ser removido da equipe",
          dados: null,
        });
      }

      // ETAPA 6: SOFT-DELETE (preserva histórico de commits/tasks) + libera vaga
      const aplicado = await aplicarSoftDelete(db, projetoId, usuarioId, "removido");

      if (!aplicado) {
        return response.status(404).json({
          sucesso: false,
          message: "Membro não encontrado neste projeto",
          dados: null,
        });
      }

      // Também coloca a candidatura dele como rejeitado/removido para poder se candidatar novamente
      await db.query(
        "UPDATE candidaturas SET status = 'rejeitado' WHERE projeto_id = ? AND usuario_id = ?",
        [projetoId, usuarioId]
      );

      // ETAPA 15 — timeline: membro removido (best-effort — nunca derruba a remoção)
      try {
        const [usuarioRows] = await db.query(
          "SELECT nome FROM usuarios WHERE id = ? LIMIT 1",
          [usuarioId]
        );
        await registrarEvento({
          projeto_id: projetoId,
          usuario_id: usuarioId,
          tipo: "membro_saiu",
          titulo: `${usuarioRows[0]?.nome || "Membro"} foi removido do squad`,
        });
      } catch (eventoError) {
        // evento não deve derrubar a remoção do membro
      }

      return response.status(200).json({
        sucesso: true,
        message: "Membro removido da equipe com sucesso",
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao remover membro do squad", 500, error));
    }
  },

  // ETAPA 6 — saída voluntária do membro (owner não pode sair do próprio projeto)
  async sairDoProjeto(request, response, next) {
    try {
      const { projetoId } = request.params;
      const usuarioId = request.usuarioAutenticado.id;

      const [projRows] = await db.query(
        "SELECT criador_id FROM projetos WHERE id = ? LIMIT 1",
        [projetoId]
      );

      if (projRows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Projeto não encontrado",
          dados: null,
        });
      }

      if (projRows[0].criador_id == usuarioId) {
        return response.status(400).json({
          sucesso: false,
          message: "Owner não pode sair do projeto",
          dados: null,
        });
      }

      const aplicado = await aplicarSoftDelete(db, projetoId, usuarioId, "saiu");

      if (!aplicado) {
        return response.status(404).json({
          sucesso: false,
          message: "Membro não encontrado neste projeto",
          dados: null,
        });
      }

      // Libera a candidatura aceita para permitir nova candidatura futura
      await db.query(
        "UPDATE candidaturas SET status = 'rejeitado' WHERE projeto_id = ? AND usuario_id = ?",
        [projetoId, usuarioId]
      );

      // ETAPA 15 — timeline: membro saiu do squad (best-effort — nunca derruba a saída)
      await registrarEvento({
        projeto_id: projetoId,
        usuario_id: usuarioId,
        tipo: "membro_saiu",
        titulo: `${request.usuarioAutenticado.nome || "Membro"} saiu do squad`,
      });

      return response.status(200).json({
        sucesso: true,
        message: "Você saiu do projeto com sucesso",
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao sair do projeto", 500, error));
    }
  },
};
