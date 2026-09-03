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

  console.log("[migracao] Conectado ao MySQL");

  await conn.query(`
    CREATE TABLE IF NOT EXISTS codigos_recuperacao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        codigo VARCHAR(6) NOT NULL,
        token_reset TEXT NULL,
        expira_em DATETIME NOT NULL,
        utilizado TINYINT(1) DEFAULT 0,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_codigo (email, codigo),
        CONSTRAINT fk_codigos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  console.log("[migracao] Tabela codigos_recuperacao criada/verificada com sucesso!");
  await conn.end();
}

main().catch((err) => {
  console.error("[migracao] Erro:", err.message);
  process.exit(1);
});
