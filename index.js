require('dotenv').config();
const express = require('express'); 
const cors = require('cors');

// 1. Validação de variáveis obrigatórias de ambiente
const requiredEnvs = ['BD_SERVIDOR', 'BD_USUARIO', 'BD_SENHA', 'BD_BANCO', 'JWT_SECRET'];
const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

if (missingEnvs.length > 0) {
    console.error(`ERRO CRÍTICO: As seguintes variáveis de ambiente são obrigatórias, mas estão ausentes: ${missingEnvs.join(', ')}`);
    process.exit(1);
}

if (process.env.JWT_SECRET === 'coloque-um-segredo-forte-aqui' && process.env.NODE_ENV === 'production') {
    console.error('ERRO CRÍTICO: JWT_SECRET não pode ser o valor padrão ("coloque-um-segredo-forte-aqui") em produção!');
    process.exit(1);
}

const router = require('./src/routes/routes');

const app = express(); 

// 2. Configuração dinâmica de CORS para as origens reais do frontend
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim()) 
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (como mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Acesso não permitido pelas regras de CORS'), false);
    }
  },
  credentials: true
}));

app.use(express.json()); 

app.use(router);

// 3. Middleware global de tratamento de erros
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Erro interno no servidor';
    
    const originalErr = err.originalError || err;
    console.error('Erro capturado pelo Middleware Global:', originalErr);
    
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Evitar retornar detalhes internos do MySQL e error.message original em produção
    const dados = isProduction ? null : (originalErr.message || String(originalErr));
    
    res.status(status).json({
        sucesso: false,
        message,
        dados
    });
});

const porta = process.env.PORT || 3333;

app.listen(porta, () => {
    console.log(`Servidor iniciado em http://localhost:${porta}`);
});

app.get('/', (request, response) => {
    response.send('Hello World');
});


