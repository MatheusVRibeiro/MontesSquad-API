const db = require("../database/connection");
const AppError = require("../utils/errors");

// A3 (IDOR): valida se o usuário é dono (ou adm) do projeto cujo vínculo de
// habilidade está sendo alterado. Usa o projeto_id REAL do vínculo (body/query),
// NUNCA o params.id da rota (habilidades_projeto não tem coluna id; params.id
// não é um projeto). Retorna null se OK, ou { status, message } para a resposta.
async function validarDonoDoProjeto(projetoId, usuarioAutenticado) {
  const [projRows] = await db.query(
    "SELECT criador_id FROM projetos WHERE id = ? LIMIT 1",
    [projetoId]
  );

  if (projRows.length === 0) {
    return { status: 404, message: "Projeto não encontrado" };
  }

  const ehAdm = usuarioAutenticado && usuarioAutenticado.tipo === "adm";
  if (!ehAdm && Number(projRows[0].criador_id) !== Number(usuarioAutenticado.id)) {
    return {
      status: 403,
      message: "Acesso negado: Apenas o proprietário do projeto pode alterar as habilidades do projeto",
    };
  }

  return null;
}

module.exports = {
  async listarHabilidadesProjeto(request, response, next) {
    try {
      const { projeto_id } = request.query;

      let sql = `
          SELECT 
            projeto_id, habilidade_id
            FROM habilidades_projeto 
      `;
      const values = [];

      if (projeto_id) {
        sql += ` WHERE projeto_id = ?`;
        values.push(projeto_id);
      }

      const [row] = await db.query(sql, values);
      const nItens = row.length;

      return response.status(200).json({
        sucesso: true,
        message: "Lista de habilidades do projeto",
        nItens,
        dados: row,
      });
    } catch (error) {
      return next(new AppError("Erro na listagem de habilidades do projeto", 500, error));
    }
  },
  async cadastrarHabilidadesProjeto(request, response, next) {
    try {
      const { projeto_id, habilidade_id } = request.body;
      
      // A3 (IDOR): checagem de dono pelo projeto REAL do vínculo (defesa em
      // profundidade — o middleware somenteDonoDoProjeto também valida body.projeto_id)
      const erroDono = await validarDonoDoProjeto(projeto_id, request.usuarioAutenticado);
      if (erroDono) {
        return response.status(erroDono.status).json({
          sucesso: false,
          message: erroDono.message,
          dados: null,
        });
      }

      const sql = `
        INSERT INTO habilidades_projeto (projeto_id, habilidade_id)
        VALUES (?, ?);

      `;

      const values = [projeto_id, habilidade_id];

      const [result] = await db.query(sql, values);

      const dados = {
        projeto_id,
        habilidade_id,
      };
      return response.status(200).json({
        sucesso: true,
        message: "Cadastro de habilidades do projeto",
        dados
      });
    } catch (error) {
      return next(new AppError("Erro no cadastro de habilidades do projeto", 500, error));
    }
  },
  async editarHabilidadesProjeto(request, response, next) {
    try {
      const projeto_id = request.body.projeto_id || request.query.projeto_id;
      const habilidade_id = request.body.habilidade_id || request.query.habilidade_id;

      if (!projeto_id || !habilidade_id) {
        return response.status(400).json({
          sucesso: false,
          message: "projeto_id e habilidade_id são obrigatórios",
          dados: null,
        });
      }

      // A3 (IDOR): valida o dono pelo projeto_id REAL do vínculo (body/query),
      // nunca pelo params.id da rota (que não é um projeto).
      const erroDono = await validarDonoDoProjeto(projeto_id, request.usuarioAutenticado);
      if (erroDono) {
        return response.status(erroDono.status).json({
          sucesso: false,
          message: erroDono.message,
          dados: null,
        });
      }

      const sql = `
        UPDATE habilidades_projeto
        SET projeto_id = ?, habilidade_id = ?
        WHERE projeto_id = ? AND habilidade_id = ?
      `;
      const values = [projeto_id, habilidade_id, projeto_id, habilidade_id];
      const [result] = await db.query(sql, values);

      const dados = {
        projeto_id,
        habilidade_id,
      };
  
      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: `Habilidades do projeto não encontrada!`,
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: `Habilidades do projeto atualizada com sucesso!`,
        dados
      });
    } catch (error) {
      return next(new AppError("Erro na edição de habilidades do projeto", 500, error));
    }
  },
  async apagarHabilidadesProjeto(request, response, next) {
    try {
      const projeto_id = request.body.projeto_id || request.query.projeto_id;
      const habilidade_id = request.body.habilidade_id || request.query.habilidade_id;

      if (!projeto_id || !habilidade_id) {
        return response.status(400).json({
          sucesso: false,
          message: "projeto_id e habilidade_id são obrigatórios",
          dados: null,
        });
      }

      // A3 (IDOR): valida o dono pelo projeto_id REAL do vínculo (body/query),
      // nunca pelo params.id da rota (que não é um projeto).
      const erroDono = await validarDonoDoProjeto(projeto_id, request.usuarioAutenticado);
      if (erroDono) {
        return response.status(erroDono.status).json({
          sucesso: false,
          message: erroDono.message,
          dados: null,
        });
      }

      const sql = `DELETE FROM habilidades_projeto WHERE projeto_id = ? AND habilidade_id = ?`;

      const [result] = await db.query(sql, [projeto_id, habilidade_id]);

      if (result.affectedRows === 0) {
        return response.status(404).json({
          sucesso: false,
          message: `Habilidades do projeto não encontradas!`,
          dados: null,
        });
      }

      return response.status(200).json({
        sucesso: true,
        message: `Habilidades do projeto deletada com sucesso!`,
        dados: null,
      });
    } catch (error) {
      return next(new AppError("Erro ao deletar habilidades do projeto", 500, error));
    }
  },
};