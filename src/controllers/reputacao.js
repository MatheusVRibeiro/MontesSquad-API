const db = require("../database/connection");
const AppError = require("../utils/errors");

module.exports = {
  async obterReputacao(request, response, next) {
    try {
      let usuarioId = request.params.id;

      // Alias 'me' → usuário autenticado
      if (usuarioId === "me") {
        usuarioId = request.usuarioAutenticado
          ? request.usuarioAutenticado.id
          : null;
      } else {
        usuarioId = Number(usuarioId);
      }

      if (!usuarioId || Number.isNaN(usuarioId)) {
        return next(new AppError("Usuário não encontrado", 404));
      }

      // 1. Verifica se o usuário existe
      const [usuarios] = await db.query(
        "SELECT id, nome FROM usuarios WHERE id = ? LIMIT 1",
        [usuarioId]
      );

      if (usuarios.length === 0) {
        return next(new AppError("Usuário não encontrado", 404));
      }

      // 2. Estatísticas (nível/xp) — defaults caso não exista linha
      const [stats] = await db.query(
        `SELECT nivel, xp, xp_para_proximo, projetos_concluidos
         FROM estatisticas_usuario
         WHERE usuario_id = ?
         LIMIT 1`,
        [usuarioId]
      );

      const s = stats[0] || {};
      const level = s.nivel ?? 1;
      const xp = s.xp ?? 0;
      const xpToNext = s.xp_para_proximo ?? 100;
      const projectsCompleted = s.projetos_concluidos ?? 0;

      // 3. Avaliações (rating) — média e total recebidos
      const [avaliacoes] = await db.query(
        `SELECT AVG(nota) AS media, COUNT(*) AS total
         FROM avaliacoes
         WHERE avaliado_id = ?`,
        [usuarioId]
      );

      const rating = Number(avaliacoes[0].media) || 0;
      const reviewsCount = avaliacoes[0].total || 0;

      // 4. Conquistas
      const [achievements] = await db.query(
        `SELECT c.id, c.titulo, c.icone, c.descricao
         FROM conquistas_usuario cu
         JOIN conquistas c ON c.id = cu.conquista_id
         WHERE cu.usuario_id = ?
         ORDER BY cu.conquistado_em DESC`,
        [usuarioId]
      );

      const achievementsMapped = achievements.map((a) => ({
        id: String(a.id),
        label: a.titulo,
        description: a.descricao,
        icon: a.icone,
      }));

      // 5. Reviews recebidas (autor = avaliador) + nome do projeto
      const [reviews] = await db.query(
        `SELECT a.id, u.nome AS author, p.titulo AS projectName, a.nota, a.comentario, a.criado_em
         FROM avaliacoes a
         JOIN usuarios u ON u.id = a.avaliador_id
         LEFT JOIN projetos p ON p.id = a.projeto_id
         WHERE a.avaliado_id = ?
         ORDER BY a.criado_em DESC`,
        [usuarioId]
      );

      const reviewsMapped = reviews.map((r) => ({
        id: String(r.id),
        author: r.author,
        projectName: r.projectName || null,
        rating: Number(r.nota),
        comment: r.comentario,
        createdAt: r.criado_em,
      }));

      // 6. Histórico de projetos (equipes que participou) — formato do frontend
      const [history] = await db.query(
        `SELECT p.id AS projeto_id, p.titulo, p.status, p.criador_id, me.funcao, me.entrou_em
         FROM membros_equipe me
         JOIN projetos p ON p.id = me.projeto_id
         WHERE me.usuario_id = ?
         ORDER BY me.entrou_em DESC`,
        [usuarioId]
      );

      const statusMap = {
        aberto: "Em andamento",
        em_andamento: "Em andamento",
        finalizado: "Concluído",
      };

      const historyMapped = history.map((h) => ({
        id: String(h.projeto_id),
        projectName: h.titulo,
        role: h.criador_id === usuarioId ? "Owner" : "Membro",
        status: statusMap[h.status] || h.status,
        period: h.entrou_em,
        technologies: [],
      }));

      return response.status(200).json({
        sucesso: true,
        message: "Reputação obtida",
        dados: {
          level,
          xp,
          xpToNext,
          rating,
          reviewsCount,
          projectsCompleted,
          achievements: achievementsMapped,
          reviews: reviewsMapped,
          history: historyMapped,
        },
      });
    } catch (error) {
      return next(new AppError("Erro ao obter reputação", 500, error));
    }
  },
};
