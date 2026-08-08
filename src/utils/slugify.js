// Utilitário de slug para branches GitHub (ETAPA 7)
// Padrão: task/{id}-{slug} — acentos/espaços/caracteres especiais tratados.

/**
 * Converte texto livre em slug seguro para branch.
 * Ex: "Criar API de Login!" -> "criar-api-de-login"
 */
function slugify(texto) {
  if (typeof texto !== "string" || !texto.trim()) return "tarefa";
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // não alfanuméricos -> hífen
    .replace(/^-+|-+$/g, "") // remove hífens nas pontas
    .slice(0, 50) || "tarefa";
}

/**
 * Gera a branch sugerida para uma task.
 * Ex: (id=38, "Criar API de Login") -> "task/38-criar-api-de-login"
 */
function gerarBranchTask(taskId, titulo) {
  return `task/${taskId}-${slugify(titulo)}`;
}

module.exports = { slugify, gerarBranchTask };