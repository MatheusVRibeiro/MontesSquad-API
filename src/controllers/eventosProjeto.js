// Controller da timeline de atividade do projeto — Evolução de produto ETAPA 15.
// GET /projetos/:projetoId/eventos — membro/dono do squad (somenteMembroOuDonoDoProjeto).
const { listarEventos } = require("../services/eventosProjeto");
const AppError = require("../utils/errors");

module.exports = {
  async listarEventos(request, response, next) {
    try {
      const { projetoId } = request.params;

      const projetoIdNum = Number(projetoId);
      if (!Number.isInteger(projetoIdNum) || projetoIdNum <= 0) {
        return response.status(400).json({
          sucesso: false,
          message: "ID do projeto inválido",
          dados: null,
        });
      }

      // limite opcional (query string), cap de 200 para não estourar a resposta
      const limiteBruto = Number(request.query.limite);
      const limite =
        Number.isInteger(limiteBruto) && limiteBruto > 0
          ? Math.min(limiteBruto, 200)
          : 50;

      const dados = await listarEventos(projetoIdNum, { limite });

      return response.status(200).json({
        sucesso: true,
        message: "Eventos do projeto",
        nItens: dados.length,
        dados,
      });
    } catch (error) {
      return next(new AppError("Erro ao listar eventos do projeto", 500, error));
    }
  },
};
