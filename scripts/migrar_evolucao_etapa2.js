// Migração segura — Evolução de produto ETAPA 2 (senha_definida)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de adicionar.
// Regra de negócio: contas criadas via GitHub (cadastro_origem='github')
// só podem desconectar o GitHub após definir senha local (senha_definida=1),
// evitando conta sem método de login. Contas locais (senha utilizável)
// recebem senha_definida=1 no backfill.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.BD_SERVIDOR,
    port: Number(process.env.BD_PORTA || 3306),
    user: process.env.BD_USUARIO,
    password: process.env.BD_SENHA,
    database: process.env.BD_BANCO,
  });

  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'senha_definida'`,
    [process.env.BD_BANCO]
  );

  if (cols.length === 0) {
    await conn.query(
      `ALTER TABLE usuarios
       ADD COLUMN senha_definida TINYINT(1) DEFAULT 0 NOT NULL`
    );
    console.log("[migrar_evolucao_etapa2] coluna senha_definida criada");
  } else {
    console.log("[migrar_evolucao_etapa2] senha_definida já existe — nada a fazer");
  }

  // Backfill: contas locais (cadastro_origem='local' ou NULL — pré-ETAPA 1)
  // têm senha utilizável → senha_definida = 1. Contas criadas via GitHub
  // ficam com 0 (definiram senha aleatória no cadastro, sem senha utilizável).
  const [backfill] = await conn.query(
    `UPDATE usuarios SET senha_definida = 1
     WHERE (cadastro_origem = 'local' OR cadastro_origem IS NULL) AND senha_definida = 0`
  );
  console.log(`[migrar_evolucao_etapa2] backfill local: ${backfill.affectedRows} registro(s)`);

  const [total] = await conn.query(
    `SELECT COUNT(*) AS total,
            SUM(cadastro_origem = 'github') AS github,
            SUM(senha_definida = 1) AS com_senha
     FROM usuarios`
  );
  console.log(
    `[migrar_evolucao_etapa2] total=${total[0].total} github=${total[0].github} senha_definida=1: ${total[0].com_senha}`
  );

  await conn.end();
  console.log("[migrar_evolucao_etapa2] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa2] ERRO:", e.message);
  process.exit(1);
});
