// Helpers padronizados para respostas da API MontesSquad
function respostaSucesso(res, dados = null, message = "Operação realizada com sucesso", status = 200, extras = {}) {
  return res.status(status).json({
    sucesso: true,
    message,
    ...(dados !== undefined ? { dados } : {}),
    ...extras,
  });
}

function respostaFalha(res, message = "Erro na requisição", status = 400, dados = null) {
  return res.status(status).json({
    sucesso: false,
    message,
    dados,
  });
}

module.exports = {
  respostaSucesso,
  respostaFalha,
};
