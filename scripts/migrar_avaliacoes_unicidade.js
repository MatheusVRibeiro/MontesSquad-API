// Migração idempotente para adicionar constraint de unicidade em avaliacoes
const mysql = require("mysql2/promise");
require("dotenv").config();

async function migrar() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "montesquad",
    port: Number(process.env.DB_PORT) || 3306,
  });

  console.log("Conectado ao banco de dados para migração de avaliações...");

  try {
    const [indices] = await connection.query(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'avaliacoes' 
        AND INDEX_NAME = 'uk_projeto_avaliador_avaliado'
    `);

    if (indices.length === 0) {
      console.log("Adicionando índice UNIQUE uk_projeto_avaliador_avaliado na tabela avaliacoes...");
      await connection.query(`
        ALTER TABLE avaliacoes 
        ADD CONSTRAINT uk_projeto_avaliador_avaliado 
        UNIQUE (projeto_id, avaliador_id, avaliado_id)
      `);
      console.log("Índice de unicidade adicionado com sucesso.");
    } else {
      console.log("Índice uk_projeto_avaliador_avaliado já existe.");
    }
  } catch (error) {
    console.error("Erro na migração:", error.message);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  migrar();
}

module.exports = migrar;

