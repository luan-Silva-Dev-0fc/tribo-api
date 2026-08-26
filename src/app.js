const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('../src/config/env');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error');
const { platformStatusMiddleware } = require('./middlewares/platformStatusMiddleware');

const app = express();

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'tribo-api' });
});

app.use('/api', platformStatusMiddleware, routes);
app.use(errorMiddleware);

module.exports = app;