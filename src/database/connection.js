require('dotenv').config();
const mysql = require('mysql2/promise');

// Obtém as configurações do banco de dados a partir do arquivo .env
// O servidor MySQL remoto fecha conexões ociosas em apenas 20 segundos (wait_timeout=20s).
// Configuramos maxIdle, idleTimeout e keepalive agressivo para nunca reusar conexões mortas.
const config = {
    host: process.env.BD_SERVIDOR,
    port: process.env.BD_PORTA || 3306,
    user: process.env.BD_USUARIO,
    password: process.env.BD_SENHA,
    database: process.env.BD_BANCO,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 2, // Limita conexões mantidas ociosas no pool
    idleTimeout: 10000, // Fecha conexões ociosas após 10s (bem antes dos 20s do MySQL remoto)
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 5000, // Envia keep-alive TCP a cada 5s
    connectTimeout: 15000, // 15 segundos para timeout de conexão
};

// Cria o pool de conexões
const pool = mysql.createPool(config);

const testarConexao = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Conexão MySQL estabelecida com sucesso!');
        connection.release();
    } catch (error) {
        console.error('Erro ao conectar ao banco de dados: ', error.message);
        if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
        }
    }
};

// Testa a conectividade em background
testarConexao();

module.exports = pool;
