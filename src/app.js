const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const env = require('./config/env');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error');
const { platformStatusMiddleware } = require('./middlewares/platformStatusMiddleware');
const { apiLimiter } = require('./middlewares/rateLimiter');

const app = express();

// Confiança no primeiro proxy reverso (Railway / Cloudflare edge)
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'Pragma',
      'Expires',
      'X-Requested-With'
    ]
  })
);

// Compactação Gzip de alta performance para todos os payloads HTTP / JSON
app.use(
  compression({
    threshold: 1024, // Compactar respostas maiores que 1KB
    level: 6
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'tribo-api' });
});

// Middleware de status da plataforma e rotas
app.use('/api', platformStatusMiddleware, routes);
app.use(errorMiddleware);

module.exports = app;