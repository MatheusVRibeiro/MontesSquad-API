// Utilitários de validação compartilhados
function ehInteiroPositivo(valor) {
  const num = Number(valor);
  return Number.isInteger(num) && num > 0;
}

function validarEmail(email) {
  if (typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validarEnum(valor, valoresValidos) {
  return valoresValidos.includes(valor);
}

module.exports = {
  ehInteiroPositivo,
  validarEmail,
  validarEnum,
};
