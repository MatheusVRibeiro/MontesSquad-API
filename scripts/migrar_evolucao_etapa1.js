// Migração segura — Evolução de produto ETAPA 1 (cadastro_origem)
// Aditiva e idempotente: consulta INFORMATION_SCHEMA antes de adicionar.
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
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'cadastro_origem'`,
    [process.env.BD_BANCO]
  );

  if (cols.length === 0) {
    await conn.query(
      `ALTER TABLE usuarios
       ADD COLUMN cadastro_origem ENUM('local','github') DEFAULT 'local' NOT NULL`
    );
    console.log("[migrar_evolucao_etapa1] coluna cadastro_origem criada");
  } else {
    console.log("[migrar_evolucao_etapa1] cadastro_origem já existe — nada a fazer");
  }

  await conn.end();
  console.log("[migrar_evolucao_etapa1] OK");
}

main().catch((e) => {
  console.error("[migrar_evolucao_etapa1] ERRO:", e.message);
  process.exit(1);
});