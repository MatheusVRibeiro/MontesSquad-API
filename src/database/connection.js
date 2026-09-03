require('dotenv').config();
const mysql = require('mysql2/promise');

// Obtém as configurações do banco de dados a partir do arquivo .env
const config = {
    host: process.env.BD_SERVIDOR, // endereço do servidor
    port: process.env.BD_PORTA || 3306, // Porta padrão 3306 se não definida
    user: process.env.BD_USUARIO, // usuário acesso banco de dados
    password: process.env.BD_SENHA, // senha acesso banco de dados
    database: process.env.BD_BANCO, // nome do banco de dados
    waitForConnections: true, // wait for connections
    connectionLimit: 10, // Pode ajustar conforme a necessidade
    queueLimit: 0, 
};

/* 
    -queueLimit-
    O número máximo de solicitações de conexão que o pool enfileirará 
    antes de retornar um erro do getConnection. Se definido como 0, não 
    há limite para o número de solicitações de conexão enfileiradas. (Padrão: 0)
*/

// Cria o pool de conexões sincronamente para garantir que a exportação seja sempre válida
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


