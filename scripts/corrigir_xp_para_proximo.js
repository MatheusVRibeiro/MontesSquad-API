// Script para corrigir o cálculo de xp_para_proximo na tabela usuarios
const mysql = require("mysql2/promise");
require("dotenv").config();

async function corrigirXp() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "montesquad",
    port: Number(process.env.DB_PORT) || 3306,
  });

  console.log("Conectado ao banco para normalizar xp_para_proximo...");

  try {
    const [result] = await connection.query(`
      UPDATE usuarios
      SET xp_para_proximo = GREATEST(nivel * 250, 250)
      WHERE xp_para_proximo <= xp OR xp_para_proximo < (nivel * 250)
    `);

    console.log(`Linhas corrigidas: ${result.affectedRows}`);
  } catch (error) {
    console.error("Erro ao normalizar xp_para_proximo:", error.message);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  corrigirXp();
}

module.exports = corrigirXp;

