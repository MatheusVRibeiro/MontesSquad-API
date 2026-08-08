// Migração segura — coluna avatar_url em usuarios (B12 + import GitHub)
// Aditiva: adiciona a coluna SE não existir (idempotente).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");

(async () => {
  const config = {
    host: process.env.BD_SERVIDOR,
    port: Number(process.env.BD_PORTA || 3306),
    user: process.env.BD_USUARIO,
    password: process.env.BD_SENHA,
    database: process.env.BD_BANCO,
  };

  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log("Conectado ao banco remoto.");

    // Verifica se a coluna avatar_url já existe (idempotente)
    const [rows] = await conn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'avatar_url'"
    );

    if (rows.length === 0) {
      await conn.query(
        "ALTER TABLE usuarios ADD COLUMN avatar_url VARCHAR(500) NULL AFTER localizacao"
      );
      console.log("+ coluna avatar_url adicionada em usuarios");
    } else {
      console.log("= coluna avatar_url já existe");
    }

    console.log("Migração avatar_url concluída com sucesso.");
  } catch (e) {
    console.error("ERRO na migração:", e.message);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();