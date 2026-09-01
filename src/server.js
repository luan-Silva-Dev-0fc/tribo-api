const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { logger } = require('./utils/logger');
const { initializeChatSocket } = require('./sockets/chat');
const { initializeNotificationSocket } = require('./sockets/notification');
const { initializeGroupAudioSocket } = require('./sockets/groupAudio');
const { setupSuperAdmin } = require('./utils/setupAdmin');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  // Live Voice is a real-time media relay. Do not fall back to HTTP polling.
  transports: ['websocket'],
  allowUpgrades: false,
  // Audio chunks should not wait for per-message compression.
  perMessageDeflate: false,
  httpCompression: false,
  maxHttpBufferSize: 128 * 1024
});

app.set('io', io);
global.io = io;

initializeChatSocket(io);
initializeNotificationSocket(io);
initializeGroupAudioSocket(io);

setupSuperAdmin().then(() => {
  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Servidor rodando na porta ${env.PORT}`);
    logger.info(`Sistema de Moderação de conteúdo +18 (Sightengine) está ATIVO e rodando.`);
  });
});

module.exports = { app, server, io };
