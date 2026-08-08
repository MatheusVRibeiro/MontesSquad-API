// Migração segura FASE-02 — MontesSquad
// Aditiva: cria a tabela notificacoes SE não existir (idempotente).
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

    // Verifica se a tabela notificacoes já existe (idempotente)
    const [rows] = await conn.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
      ["notificacoes"]
    );

    if (rows.length === 0) {
      await conn.query(`
        CREATE TABLE notificacoes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          tipo ENUM('application', 'message', 'task', 'system', 'approved') DEFAULT 'system',
          titulo VARCHAR(150),
          descricao TEXT,
          link VARCHAR(255),
          lida BOOLEAN DEFAULT FALSE,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
      console.log("+ tabela notificacoes criada");
    } else {
      console.log("= tabela notificacoes já existe");
    }

    console.log("Migração FASE-02 concluída com sucesso.");
  } catch (e) {
    console.error("ERRO na migração:", e.message);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();
