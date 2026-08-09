// Migração segura — Evolução de produto ETAPA 14 (privacidade e repositórios privados)
// Aditiva e idempotente: consulta SHOW COLUMNS antes de cada ALTER TABLE.
//
// Alterações:
//   1. projetos.visibilidade ENUM('publico','privado') DEFAULT 'publico' —
//      controle de visibilidade do projeto/repositório (regra 4 do plano:
//      URL privada não deve ser exposta indevidamente).
//   2. projetos.permitir_portfolio_publico BOOLEAN DEFAULT TRUE — controle de
//      exposição do portfólio público (regra 3: portfólio público não mostra
//      mensagem de commit privada sem autorização).
//
// Contrato no código:
//   - src/services/githubPrivacy.js — canViewRepositoryActivity / canExposeContributionPublicly
//   - src/services/portfolio.js — projetos do portfólio marcados com privado:true
//     (sem contribuições detalhadas) quando visibilidade='privado' OU
//     permitir_portfolio_publico=false.
//   - src/controllers/projetos.js — obterProjeto oculta URLs de repositório/
//     ferramentas para não-membros de projeto privado; editarProjeto aceita
//     visibilidade e permitir_portfolio_publico.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

// Verifica se a coluna já existe (idempotência) — SHOW COLUMNS LIKE ?.
async function colunaExiste(conn, tabela, coluna) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${tabela}\` LIKE ?`, [coluna]);
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.BD_SERVIDOR,
    port: Number(process.env.BD_PORTA || 3306),
    user: process.env.BD_USUARIO,
    password: process.env.BD_SENHA,
    database: process.env.BD_BANCO,
  });

  // 1. projetos.visibilidade ENUM('publico','privado') DEFAULT 'publico'
  if (await colunaExiste(conn, "projetos", "visibilidade")) {
    console.log("[migrar_evolucao_etapa14] coluna projetos.visibilidade já existe — nada a fazer");
  } else {
    await conn.query(
      "ALTER TABLE projetos ADD COLUMN visibilidade ENUM('publico','privado') DEFAULT 'publico'"
    );
    console.log("[migrar_evolucao_etapa14] coluna projetos.visibilidade criada (DEFAULT 'publico')");
  }

  // 2. projetos.permitir_portfolio_publico BOOLEAN DEFAULT TRUE
  if (await colunaExiste(conn, "projetos", "permitir_portfolio_publico")) {
    console.log("[migrar_evolucao_etapa14] coluna projetos.permitir_portfolio_publico já existe — nada a fazer");
  } else {
    await conn.query(
      "ALTER TABLE projetos ADD COLUMN permitir_portfolio_publico BOOLEAN DEFAULT TRUE"
    );
    console.log("[migrar_evolucao_etapa14] coluna projetos.permitir_portfolio_publico criada (DEFAULT TRUE)");
  }

  // 3. Relatório — distribuição de visibilidade (regra 6: sem secrets em logs)
  const [rows] = await conn.query(
    `SELECT visibilidade, COUNT(*) AS total,
            SUM(CASE WHEN permitir_portfolio_publico = 1 THEN 1 ELSE 0 END) AS com_portfolio
     FROM projetos GROUP BY visibilidade`
  );
  for (const r of rows) {
    console.log(
      `[migrar_evolucao_etapa14] projetos visibilidade=${r.visibilidade} total=${r.total} permitir_portfolio_publico=${r.com_portfolio || 0}`
    );
  }

  await conn.end();
  console.log("[migrar_evolucao_etapa14] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa14] ERRO:", e.message);
  process.exit(1);
});
