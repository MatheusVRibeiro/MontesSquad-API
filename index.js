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
const db = require('./src/database/connection');

const app = express(); 

// M2 (auditoria): confia no proxy reverso (nginx/Heroku/Render etc.) SOMENTE
// quando explicitamente habilitado via TRUST_PROXY=1. Sem trust proxy, atrás
// de um proxy TODOS os IPs viram o IP do proxy e o rate limit vira global
// (DoS). Em execução local/direta NÃO deve ser habilitado — req.ip fica correto.
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// 2. Configuração dinâmica de CORS para as origens reais do frontend
// FRONTEND_URL aceita múltiplas origens separadas por vírgula (ex.:
// "http://localhost:5173,http://localhost:5174"). As URLs são normalizadas
// (trim + lower-case + sem barra final) para tolerar variações de digitação.
const allowedOrigins = (process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:8080']
).map(url => url.trim().toLowerCase().replace(/\/+$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (como mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes('*') || allowedOrigins.indexOf(origin.toLowerCase().replace(/\/+$/, '')) !== -1) {
      callback(null, true);
    } else {
      // Marca status 403 no erro: o middleware global lê err.status || 500,
      // então sem isso a rejeição de origem viraria 500 em vez de 403.
      const err = new Error('Acesso não permitido pelas regras de CORS');
      err.status = 403;
      callback(err, false);
    }
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  maxAge: 86400 // cache do preflight por 24h (evita OPTIONS a cada requisição do Axios)
}));

// Preserva o raw body APENAS para /github/webhook (ETAPA 4 — verificação de assinatura).
// DEVE vir ANTES do express.json() global, senão o JSON consome o body primeiro.
app.use(
  "/github/webhook",
  express.raw({ type: () => true, limit: "5mb" }),
  (req, _res, next) => {
    // express.raw() entrega Buffer; normaliza para string para o verifier.
    if (req.body && Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString("utf8");
    } else if (typeof req.body === "string") {
      req.rawBody = req.body;
    }
    next();
  }
);

app.use(express.json());

app.use(router);

// 3.5 Healthcheck público: verifica a conectividade com o banco (SELECT 1).
//     Nunca derruba o boot — em falha responde { sucesso: true, banco: 'erro' }.
app.get('/health', async (request, response) => {
  try {
    await db.query('SELECT 1');
    return response.status(200).json({ sucesso: true, banco: 'ok' });
  } catch (error) {
    console.error('[health] Banco de dados indisponível:', error.message);
    return response.status(200).json({ sucesso: true, banco: 'erro' });
  }
});

// 3. Middleware global de tratamento de erros
// M3/M5 (auditoria): em NODE_ENV=production NUNCA ecoa err.message cru nem
// detalhes internos (MySQL, stack, paths) — responde mensagem genérica e
// dados:null; o detalhe vai apenas para o log do servidor (console.error).
// Em dev/teste os detalhes são mantidos para facilitar o debug.
app.use((err, req, res, next) => {
    const status = err.status || 500;

    const originalErr = err.originalError || err;
    console.error('Erro capturado pelo Middleware Global:', originalErr);

    const isProduction = process.env.NODE_ENV === 'production';

    // Mensagem segura: genérica em produção; err.message apenas fora dela.
    const message = isProduction ? 'Erro interno do servidor' : (err.message || 'Erro interno no servidor');

    // Evitar retornar detalhes internos do MySQL e error.message original em produção
    const dados = isProduction ? null : (originalErr.message || String(originalErr));

    res.status(status).json({
        sucesso: false,
        message,
        dados
    });
});

// Só inicia o servidor quando executado diretamente (node index.js).
// Quando importado (ex.: testes com supertest), o app é exportado sem escutar porta.
if (require.main === module) {
    const porta = process.env.PORT || 3333;

    app.listen(porta, () => {
        console.log(`Servidor iniciado em http://localhost:${porta}`);
    });
}

app.get('/', (request, response) => {
    response.send('Hello World');
});

module.exports = app;


