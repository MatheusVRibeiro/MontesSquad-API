// Vagas do projeto — Evolução ETAPA 4 (papéis/vagas necessárias no projeto)
//
// GET    /projetos/:projetoId/vagas          (membro/dono) — lista vagas com nome da função
// POST   /projetos/:projetoId/vagas          (owner)       — cria vaga {funcao_id, quantidade, descricao, nivel_desejado}
// PATCH  /projetos/:projetoId/vagas/:vagaId  (owner)       — atualiza vaga (preenchidas <= quantidade)
// DELETE /projetos/:projetoId/vagas/:vagaId  (owner)       — bloqueia se preenchidas > 0 (409)
const db = require("../database/connection");
const AppError = require("../utils/errors");

const NIVEIS_DESEJADOS = ["iniciante", "intermediario", "avancado", "qualquer"];
const STATUS_VAGA = ["aberta", "fechada"];

// SELECT padrão com o nome da função (JOIN funcoes)
const SELECT_VAGA_COM_FUNCAO = `
  SELECT v.id, v.projeto_id, v.funcao_id, f.nome AS funcao_nome,
         v.quantidade, v.preenchidas, v.descricao,
         v.nivel_desejado, v.status, v.criado_em
  FROM vagas_projeto v
  JOIN funcoes f ON v.funcao_id = f.id
`;

module.exports = {
  // Lista vagas do projeto (membro ou dono) com o nome da função
  async listarVagas(request, response, next) {
    try {
      const { projetoId } = request.params;

      const sql = `
        ${SELECT_VAGA_COM_FUNCAO}
        WHERE v.projeto_id = ?
        ORDER BY v.id
      `;
      const [rows] = await db.query(sql, [projetoId]);

      return response.status(200).json({
        sucesso: true,
        message: "Lista de vagas do projeto",
        nItens: rows.length,
        dados: rows,
      });
    } catch (error) {
      return next(new AppError("Erro na listagem de vagas do projeto", 500, error));
    }
  },

  // Cria uma vaga no projeto (somente owner)
  async criarVaga(request, response, next) {
    try {
      const { projetoId } = request.params;
      const { funcao_id, quantidade, descricao, nivel_desejado } = request.body;

      if (funcao_id === undefined || funcao_id === null || funcao_id === "") {
        return response.status(400).json({
          sucesso: false,
          message: "funcao_id é obrigatório",
          dados: null,
        });
      }
      const funcaoIdNum = Number(funcao_id);
      if (!Number.isInteger(funcaoIdNum) || funcaoIdNum <= 0) {
        return response.status(400).json({
          sucesso: false,
          message: "funcao_id deve ser um número inteiro positivo",
          dados: null,
        });
      }

      const qtd = quantidade !== undefined && quantidade !== null && quantidade !== ""
        ? Number(quantidade)
        : 1;
      if (!Number.isInteger(qtd) || qtd <= 0) {
        return response.status(400).json({
          sucesso: false,
          message: "quantidade deve ser um número inteiro positivo",
          dados: null,
        });
      }

      const nivel = nivel_desejado || "qualquer";
      if (!NIVEIS_DESEJADOS.includes(nivel)) {
        return response.status(400).json({
          sucesso: false,
          message: "nivel_desejado inválido",
          dados: null,
        });
      }

      // Valida que a função existe (FK RESTRICT — evita erro 500 de constraint)
      const [funcaoRows] = await db.query(
        "SELECT id FROM funcoes WHERE id = ? LIMIT 1",
        [funcaoIdNum]
      );
      if (funcaoRows.length === 0) {
        return response.status(400).json({
          sucesso: false,
          message: "Função não encontrada",
          dados: null,
        });
      }

      const sql = `
        INSERT INTO vagas_projeto (projeto_id, funcao_id, quantidade, descricao, nivel_desejado)
        VALUES (?, ?, ?, ?, ?)
      `;
      const [result] = await db.query(sql, [
        projetoId,
        funcaoIdNum,
        qtd,
        descricao || null,
        nivel,
      ]);

      const [vagaRows] = await db.query(
        `${SELECT_VAGA_COM_FUNCAO} WHERE v.id = ? LIMIT 1`,
        [result.insertId]
      );

      return response.status(200).json({
        sucesso: true,
        message: "Vaga criada com sucesso",
        dados: vagaRows[0] || null,
      });
    } catch (error) {
      return next(new AppError("Erro na criação de vaga do projeto", 500, error));
    }
  },

  // Atualiza uma vaga do projeto (somente owner)
  async atualizarVaga(request, response, next) {
    try {
      const { projetoId, vagaId } = request.params;
      const { funcao_id, quantidade, preenchidas, descricao, nivel_desejado, status } = request.body;

      // Valida existência e vínculo da vaga com o projeto
      const [vagaRows] = await db.query(
        "SELECT * FROM vagas_projeto WHERE id = ? AND projeto_id = ? LIMIT 1",
        [vagaId, projetoId]
      );
      if (vagaRows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Vaga não encontrada",
          dados: null,
        });
      }
      const vagaAtual = vagaRows[0];

      const fields = [];
      const values = [];

      if (funcao_id !== undefined && funcao_id !== null && funcao_id !== "") {
        const funcaoIdNum = Number(funcao_id);
        if (!Number.isInteger(funcaoIdNum) || funcaoIdNum <= 0) {
          return response.status(400).json({
            sucesso: false,
            message: "funcao_id deve ser um número inteiro positivo",
            dados: null,
          });
        }
        const [funcaoRows] = await db.query(
          "SELECT id FROM funcoes WHERE id = ? LIMIT 1",
          [funcaoIdNum]
        );
        if (funcaoRows.length === 0) {
          return response.status(400).json({
            sucesso: false,
            message: "Função não encontrada",
            dados: null,
          });
        }
        fields.push("funcao_id = ?");
        values.push(funcaoIdNum);
      }

      if (quantidade !== undefined && quantidade !== null && quantidade !== "") {
        const qtd = Number(quantidade);
        if (!Number.isInteger(qtd) || qtd <= 0) {
          return response.status(400).json({
            sucesso: false,
            message: "quantidade deve ser um número inteiro positivo",
            dados: null,
          });
        }
        fields.push("quantidade = ?");
        values.push(qtd);
      }

      if (preenchidas !== undefined && preenchidas !== null && preenchidas !== "") {
        const preenchidasNum = Number(preenchidas);
        if (!Number.isInteger(preenchidasNum) || preenchidasNum < 0) {
          return response.status(400).json({
            sucesso: false,
            message: "preenchidas deve ser um número inteiro maior ou igual a zero",
            dados: null,
          });
        }
        fields.push("preenchidas = ?");
        values.push(preenchidasNum);
      }

      if (descricao !== undefined) {
        fields.push("descricao = ?");
        values.push(descricao || null);
      }

      if (nivel_desejado !== undefined && nivel_desejado !== null && nivel_desejado !== "") {
        if (!NIVEIS_DESEJADOS.includes(nivel_desejado)) {
          return response.status(400).json({
            sucesso: false,
            message: "nivel_desejado inválido",
            dados: null,
          });
        }
        fields.push("nivel_desejado = ?");
        values.push(nivel_desejado);
      }

      if (status !== undefined && status !== null && status !== "") {
        if (!STATUS_VAGA.includes(status)) {
          return response.status(400).json({
            sucesso: false,
            message: "status inválido",
            dados: null,
          });
        }
        fields.push("status = ?");
        values.push(status);
      }

      if (fields.length === 0) {
        return response.status(400).json({
          sucesso: false,
          message: "Nenhum campo para atualizar",
          dados: null,
        });
      }

      // Regra de negócio: preenchidas <= quantidade (considerando valores novos ou atuais)
      const novaQuantidade = quantidade !== undefined && quantidade !== null && quantidade !== ""
        ? Number(quantidade)
        : vagaAtual.quantidade;
      const novaPreenchidas = preenchidas !== undefined && preenchidas !== null && preenchidas !== ""
        ? Number(preenchidas)
        : vagaAtual.preenchidas;
      if (novaPreenchidas > novaQuantidade) {
        return response.status(400).json({
          sucesso: false,
          message: "preenchidas não pode ser maior que quantidade",
          dados: null,
        });
      }

      values.push(vagaId, projetoId);
      const sql = `UPDATE vagas_projeto SET ${fields.join(", ")} WHERE id = ? AND projeto_id = ?`;
      await db.query(sql, values);

      const [vagaAtualizada] = await db.query(
        `${SELECT_VAGA_COM_FUNCAO} WHERE v.id = ? LIMIT 1`,
        [vagaId]
      );

      return response.status(200).json({
        sucesso: true,
        message: "Vaga atualizada com sucesso",
        dados: vagaAtualizada[0] || null,
      });
    } catch (error) {
      return next(new AppError("Erro na atualização de vaga do projeto", 500, error));
    }
  },

  // Apaga uma vaga do projeto (somente owner) — bloqueia se já preenchida
  async apagarVaga(request, response, next) {
    try {
      const { projetoId, vagaId } = request.params;

      const [vagaRows] = await db.query(
        "SELECT id, preenchidas FROM vagas_projeto WHERE id = ? AND projeto_id = ? LIMIT 1",
        [vagaId, projetoId]
      );
      if (vagaRows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Vaga não encontrada",
          dados: null,
        });
      }

      if (Number(vagaRows[0].preenchidas) > 0) {
        return response.status(409).json({
          sucesso: false,
          message: "Vaga possui membros vinculados",
          dados: null,
        });
      }

      await db.query("DELETE FROM vagas_projeto WHERE id = ? AND projeto_id = ?", [
        vagaId,
        projetoId,
      ]);

      return response.status(200).json({
        sucesso: true,
        message: "Vaga deletada com sucesso",
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao deletar vaga do projeto", 500, error));
    }
  },
};
