// Perfil técnico completo — Evolução de produto ETAPA 3.
// Endpoints:
//   GET   /funcoes               → lista funções de interesse (logado)
//   GET   /usuarios/me/perfil    → perfil técnico completo (básico + habilidades com nível + funções com nível de interesse)
//   PATCH /usuarios/me/perfil    → atualiza nome/bio/localização/disponibilidade/objetivo e recalcula perfil_completo
//   PUT   /usuarios/me/funcoes   → upsert das funções de interesse (funcoes_usuario)
//   PUT   /usuarios/me/habilidades → upsert das habilidades com nível (habilidades_usuario)
//
// Regra perfil_completo: nome preenchido E pelo menos 1 habilidade cadastrada.
const db = require("../database/connection");
const AppError = require("../utils/errors");

const NIVEIS_INTERESSE = ["baixo", "medio", "alto"];
const NIVEIS_HABILIDADE = ["iniciante", "intermediario", "avancado"];

const CAMPOS_USUARIO_PERFIL = `
  id, nome, email, bio, localizacao, avatar_url, tipo,
  disponibilidade_horas_semana, objetivo_profissional, perfil_completo
`;

function ehInteiroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0;
}

module.exports = {
  // GET /funcoes — lista as funções cadastradas (logado)
  async listarFuncoes(request, response, next) {
    try {
      const [rows] = await db.query("SELECT id, nome FROM funcoes ORDER BY nome");
      return response.status(200).json({
        sucesso: true,
        message: "Lista de funções",
        nItens: rows.length,
        dados: rows,
      });
    } catch (error) {
      return next(new AppError("Erro na listagem de funções", 500, error));
    }
  },

  // GET /usuarios/me/perfil — perfil técnico completo do usuário logado
  async obterPerfilTecnico(request, response, next) {
    try {
      const usuarioId = request.usuarioAutenticado.id;

      const [userRows] = await db.query(
        `SELECT ${CAMPOS_USUARIO_PERFIL} FROM usuarios WHERE id = ? LIMIT 1`,
        [usuarioId]
      );

      if (userRows.length === 0) {
        return response.status(404).json({
          sucesso: false,
          message: "Usuário não encontrado",
          dados: null,
        });
      }

      const [habilidades] = await db.query(
        `SELECT h.id, h.nome, hu.nivel
         FROM habilidades_usuario hu
         INNER JOIN habilidades h ON h.id = hu.habilidade_id
         WHERE hu.usuario_id = ?
         ORDER BY h.nome`,
        [usuarioId]
      );

      const [funcoes] = await db.query(
        `SELECT f.id, f.nome, fu.nivel_interesse
         FROM funcoes_usuario fu
         INNER JOIN funcoes f ON f.id = fu.funcao_id
         WHERE fu.usuario_id = ?
         ORDER BY f.nome`,
        [usuarioId]
      );

      return response.status(200).json({
        sucesso: true,
        message: "Perfil técnico do usuário",
        dados: {
          ...userRows[0],
          habilidades,
          funcoes,
        },
      });
    } catch (error) {
      return next(new AppError("Erro ao obter perfil técnico", 500, error));
    }
  },

  // PATCH /usuarios/me/perfil — atualiza campos básicos e recalcula perfil_completo
  async atualizarPerfilTecnico(request, response, next) {
    try {
      const usuarioId = request.usuarioAutenticado.id;
      const { nome, bio, localizacao, disponibilidade_horas_semana, objetivo_profissional } = request.body;

      const fields = [];
      const values = [];

      if (nome !== undefined) {
        if (typeof nome !== "string" || nome.trim() === "") {
          return response.status(400).json({
            sucesso: false,
            message: "nome não pode ser vazio",
            dados: null,
          });
        }
        fields.push("nome = ?");
        values.push(nome.trim());
      }
      if (bio !== undefined) {
        fields.push("bio = ?");
        values.push(bio);
      }
      if (localizacao !== undefined) {
        fields.push("localizacao = ?");
        values.push(localizacao);
      }
      if (disponibilidade_horas_semana !== undefined) {
        if (!Number.isInteger(disponibilidade_horas_semana) || disponibilidade_horas_semana < 0 || disponibilidade_horas_semana > 168) {
          return response.status(400).json({
            sucesso: false,
            message: "disponibilidade_horas_semana deve ser um inteiro entre 0 e 168",
            dados: null,
          });
        }
        fields.push("disponibilidade_horas_semana = ?");
        values.push(disponibilidade_horas_semana);
      }
      if (objetivo_profissional !== undefined) {
        if (typeof objetivo_profissional !== "string" || objetivo_profissional.length > 255) {
          return response.status(400).json({
            sucesso: false,
            message: "objetivo_profissional deve ter no máximo 255 caracteres",
            dados: null,
          });
        }
        fields.push("objetivo_profissional = ?");
        values.push(objetivo_profissional);
      }

      if (fields.length === 0) {
        return response.status(400).json({
          sucesso: false,
          message: "Nenhum campo para atualizar",
          dados: null,
        });
      }

      // Transação: aplica os campos e recalcula perfil_completo (nome + >=1 habilidade)
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        values.push(usuarioId);
        await conn.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id = ?`, values);

        // Se nome não foi enviado, lê o atual para decidir perfil_completo
        let temNome = typeof nome === "string" && nome.trim() !== "";
        if (!temNome) {
          const [userRows] = await conn.query("SELECT nome FROM usuarios WHERE id = ? LIMIT 1", [usuarioId]);
          temNome = userRows.length > 0 && Boolean(userRows[0].nome && userRows[0].nome.trim());
        }

        const [countRows] = await conn.query(
          "SELECT COUNT(*) AS total FROM habilidades_usuario WHERE usuario_id = ?",
          [usuarioId]
        );
        const perfilCompleto = temNome && Number(countRows[0].total) >= 1 ? 1 : 0;
        await conn.query("UPDATE usuarios SET perfil_completo = ? WHERE id = ?", [perfilCompleto, usuarioId]);

        await conn.commit();

        const [userRows] = await conn.query(
          `SELECT ${CAMPOS_USUARIO_PERFIL} FROM usuarios WHERE id = ? LIMIT 1`,
          [usuarioId]
        );

        return response.status(200).json({
          sucesso: true,
          message: "Perfil atualizado com sucesso!",
          dados: userRows[0] || null,
        });
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    } catch (error) {
      return next(new AppError("Erro na atualização do perfil técnico", 500, error));
    }
  },

  // PUT /usuarios/me/funcoes — upsert das funções de interesse (funcoes_usuario)
  async atualizarFuncoesUsuario(request, response, next) {
    try {
      const usuarioId = request.usuarioAutenticado.id;
      const { funcoes } = request.body;

      if (!Array.isArray(funcoes)) {
        return response.status(400).json({
          sucesso: false,
          message: "funcoes deve ser um array de {funcao_id, nivel_interesse}",
          dados: null,
        });
      }

      const validados = [];
      for (const item of funcoes) {
        const funcaoId = item && item.funcao_id;
        const nivelInteresse = item && item.nivel_interesse;
        if (!ehInteiroPositivo(funcaoId) || !NIVEIS_INTERESSE.includes(nivelInteresse)) {
          return response.status(400).json({
            sucesso: false,
            message: "Cada item deve ter funcao_id inteiro e nivel_interesse em 'baixo'|'medio'|'alto'",
            dados: null,
          });
        }
        validados.push([usuarioId, funcaoId, nivelInteresse]);
      }

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        for (const [uid, funcaoId, nivelInteresse] of validados) {
          await conn.query(
            `INSERT INTO funcoes_usuario (usuario_id, funcao_id, nivel_interesse)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE nivel_interesse = VALUES(nivel_interesse)`,
            [uid, funcaoId, nivelInteresse]
          );
        }
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }

      return response.status(200).json({
        sucesso: true,
        message: "Funções do usuário atualizadas com sucesso!",
        dados: {
          funcoes: validados.map(([, funcao_id, nivel_interesse]) => ({ funcao_id, nivel_interesse })),
        },
      });
    } catch (error) {
      return next(new AppError("Erro na atualização das funções do usuário", 500, error));
    }
  },

  // PUT /usuarios/me/habilidades — upsert das habilidades com nível (habilidades_usuario)
  async atualizarHabilidadesUsuario(request, response, next) {
    try {
      const usuarioId = request.usuarioAutenticado.id;
      const { habilidades } = request.body;

      if (!Array.isArray(habilidades)) {
        return response.status(400).json({
          sucesso: false,
          message: "habilidades deve ser um array de {habilidade_id, nivel}",
          dados: null,
        });
      }

      const validados = [];
      for (const item of habilidades) {
        const habilidadeId = item && item.habilidade_id;
        const nivel = item && item.nivel;
        if (!ehInteiroPositivo(habilidadeId) || !NIVEIS_HABILIDADE.includes(nivel)) {
          return response.status(400).json({
            sucesso: false,
            message: "Cada item deve ter habilidade_id inteiro e nivel em 'iniciante'|'intermediario'|'avancado'",
            dados: null,
          });
        }
        validados.push([usuarioId, habilidadeId, nivel]);
      }

      const conn = await db.getConnection();
      let perfilCompleto = 0;
      try {
        await conn.beginTransaction();

        for (const [uid, habilidadeId, nivel] of validados) {
          await conn.query(
            `INSERT INTO habilidades_usuario (usuario_id, habilidade_id, nivel)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE nivel = VALUES(nivel)`,
            [uid, habilidadeId, nivel]
          );
        }

        // Recalcula perfil_completo: nome preenchido + >=1 habilidade
        const [userRows] = await conn.query("SELECT nome FROM usuarios WHERE id = ? LIMIT 1", [usuarioId]);
        const temNome = userRows.length > 0 && Boolean(userRows[0].nome && userRows[0].nome.trim());
        const [countRows] = await conn.query(
          "SELECT COUNT(*) AS total FROM habilidades_usuario WHERE usuario_id = ?",
          [usuarioId]
        );
        perfilCompleto = temNome && Number(countRows[0].total) >= 1 ? 1 : 0;
        await conn.query("UPDATE usuarios SET perfil_completo = ? WHERE id = ?", [perfilCompleto, usuarioId]);

        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }

      return response.status(200).json({
        sucesso: true,
        message: "Habilidades do usuário atualizadas com sucesso!",
        dados: {
          habilidades: validados.map(([, habilidade_id, nivel]) => ({ habilidade_id, nivel })),
          perfil_completo: perfilCompleto === 1,
        },
      });
    } catch (error) {
      return next(new AppError("Erro na atualização das habilidades do usuário", 500, error));
    }
  },
};
