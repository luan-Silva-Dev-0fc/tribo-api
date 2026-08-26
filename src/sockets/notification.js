function initializeNotificationSocket(io) {
  io.on('connection', (socket) => {
    socket.on('subscribe-notifications', (userId) => {
      socket.join(`notifications:${userId}`);
    });

    socket.on('send-notification', (payload) => {
      io.to(`notifications:${payload.userId}`).emit('receive-notification', payload);
    });
  });
}

module.exports = { initializeNotificationSocket };