const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { logger } = require('./utils/logger');
const { initializeChatSocket } = require('./sockets/chat');
const { initializeNotificationSocket } = require('./sockets/notification');
const { setupSuperAdmin } = require('./utils/setupAdmin');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);
global.io = io;

initializeChatSocket(io);
initializeNotificationSocket(io);

setupSuperAdmin().then(() => {
  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Servidor rodando na porta ${env.PORT}`);
    logger.info(`Sistema de Moderação de conteúdo +18 (Sightengine) está ATIVO e rodando.`);
  });
});

module.exports = { app, server, io };