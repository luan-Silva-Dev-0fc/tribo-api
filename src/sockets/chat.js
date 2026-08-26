const activeSpeakersByGroup = new Map();

function getGroupSpeakers(groupId) {
  const room = String(groupId);
  if (!activeSpeakersByGroup.has(room)) {
    return [];
  }
  return Array.from(activeSpeakersByGroup.get(room).values());
}

function initializeChatSocket(io) {
  io.on('connection', (socket) => {
    socket.on('join-room', (room) => {
      const roomStr = String(room);
      socket.join(roomStr);

      socket.emit('active-speakers-updated', {
        room: roomStr,
        groupId: roomStr,
        speakers: getGroupSpeakers(roomStr)
      });
    });

    socket.on('join_group', (groupId) => {
      const roomStr = String(groupId);
      socket.join(roomStr);
      socket.emit('active-speakers-updated', {
        room: roomStr,
        groupId: roomStr,
        speakers: getGroupSpeakers(roomStr)
      });
    });

    socket.on('leave_group', (groupId) => {
      socket.leave(String(groupId));
    });

    socket.on('send-message', (payload) => {
      io.to(payload.room).emit('receive-message', payload);
    });

    socket.on('edit-message', (payload) => {
      if (payload && payload.room) {
        io.to(payload.room).emit('message-edited', payload);
      }
    });

    socket.on('delete-message', (payload) => {
      if (payload && payload.room) {
        io.to(payload.room).emit('message-deleted', payload);
      }
    });

    socket.on('mark-read', (payload) => {
      if (payload && payload.room) {
        io.to(payload.room).emit('messages-read', payload);
      }
    });

    socket.on('user-typing', (payload) => {
      if (payload && payload.room) {
        socket.to(payload.room).emit('user-typing', payload);
      }
    });

    socket.on('get-active-speakers', (payload) => {
      if (payload) {
        const room = String(payload.room || payload.groupId);
        socket.emit('active-speakers-updated', {
          room,
          groupId: room,
          speakers: getGroupSpeakers(room)
        });
      }
    });

    socket.on('group-live-voice-start', (payload) => {
      if (payload) {
        const room = String(payload.room || payload.groupId);
        const user = payload.user || {};
        const userId = String(user.id || payload.userId);

        if (!activeSpeakersByGroup.has(room)) {
          activeSpeakersByGroup.set(room, new Map());
        }

        const groupSpeakers = activeSpeakersByGroup.get(room);
        const speakerData = {
          id: userId,
          userId,
          name: user.name || user.username || payload.userName || 'Membro',
          username: user.username || payload.userName || '',
          avatar_url: user.avatar_url || payload.userAvatar || '',
          badge_type: user.badge_type || '',
          socketId: socket.id,
          timestamp: Date.now()
        };

        groupSpeakers.set(userId, speakerData);
        socket.currentLiveRoom = room;
        socket.currentUserId = userId;

        const isVip = Boolean(
          user.badge_type === 'GOLD' ||
          user.badge_type === 'GOLD_VERIFIED' ||
          user.is_vip ||
          user.is_gold ||
          user.badgeType === 'GOLD'
        );

        console.log(`[VOZ AO VIVO WS] ${speakerData.name} (${isVip ? 'VIP/Dourado' : 'Membro Comum'}) começou a falar na sala ${room}. Total de falantes ativos: ${groupSpeakers.size}`);

        const currentSpeakers = Array.from(groupSpeakers.values());

        io.to(room).emit('user-started-speaking', {
          room,
          groupId: room,
          user: speakerData,
          userId
        });

        io.to(room).emit('active-speakers-updated', {
          room,
          groupId: room,
          speakers: currentSpeakers
        });

        io.to(room).emit('group-live-voice-started', {
          room,
          user: speakerData,
          speakers: currentSpeakers,
          timestamp: Date.now()
        });
      }
    });

    socket.on('join-voice-room', (payload) => {
      if (payload) {
        const room = String(payload.room || payload.groupId);
        socket.join(room);
        socket.emit('active-speakers-updated', {
          room,
          groupId: room,
          speakers: getGroupSpeakers(room)
        });
      }
    });

    socket.on('group-live-voice-chunk', (payload) => {
      if (payload && (payload.room || payload.groupId) && payload.audioBase64) {
        const room = String(payload.room || payload.groupId);

        socket.to(room).emit('group-live-voice-chunk', {
          room,
          user: payload.user,
          audioBase64: payload.audioBase64,
          mimeType: payload.mimeType || 'audio/webm',
          timestamp: Date.now()
        });
      }
    });

    socket.on('send-audio-chunk', (payload) => {
      if (payload && (payload.room || payload.groupId) && (payload.audioBase64 || payload.chunk)) {
        const room = String(payload.room || payload.groupId);
        const audio = payload.audioBase64 || payload.chunk;
        socket.to(room).emit('receive-audio-chunk', {
          room,
          user: payload.user,
          audioBase64: audio,
          mimeType: payload.mimeType || 'audio/webm',
          timestamp: Date.now()
        });
      }
    });

    socket.on('group-live-voice-stop', (payload) => {
      const room = String(payload?.room || payload?.groupId || socket.currentLiveRoom);
      const userId = String(payload?.userId || payload?.user?.id || socket.currentUserId);

      if (activeSpeakersByGroup.has(room)) {
        const groupSpeakers = activeSpeakersByGroup.get(room);
        groupSpeakers.delete(userId);

        const remainingSpeakers = Array.from(groupSpeakers.values());
        console.log(`[VOZ AO VIVO WS] Usuário ${userId} encerrou a fala na sala ${room}. Restantes: ${remainingSpeakers.length}`);

        io.to(room).emit('user-stopped-speaking', {
          room,
          groupId: room,
          userId,
          user: payload?.user
        });

        io.to(room).emit('active-speakers-updated', {
          room,
          groupId: room,
          speakers: remainingSpeakers
        });

        if (remainingSpeakers.length === 0) {
          activeSpeakersByGroup.delete(room);
          io.to(room).emit('group-live-voice-stopped', {
            room,
            groupId: room,
            user: payload?.user,
            timestamp: Date.now()
          });
        }
      }
    });

    socket.on('leave-voice-room', (payload) => {
      const room = String(payload?.room || payload?.groupId || socket.currentLiveRoom);
      const userId = String(payload?.userId || payload?.user?.id || socket.currentUserId);

      if (activeSpeakersByGroup.has(room)) {
        const groupSpeakers = activeSpeakersByGroup.get(room);
        groupSpeakers.delete(userId);
        const remainingSpeakers = Array.from(groupSpeakers.values());

        io.to(room).emit('user-stopped-speaking', { room, groupId: room, userId });
        io.to(room).emit('active-speakers-updated', { room, groupId: room, speakers: remainingSpeakers });

        if (remainingSpeakers.length === 0) {
          activeSpeakersByGroup.delete(room);
          io.to(room).emit('group-live-voice-stopped', { room, groupId: room, timestamp: Date.now() });
        }
      }
    });

    socket.on('disconnect', () => {
      activeSpeakersByGroup.forEach((groupSpeakers, room) => {
        for (const [userId, data] of groupSpeakers.entries()) {
          if (data.socketId === socket.id) {
            groupSpeakers.delete(userId);
            const remainingSpeakers = Array.from(groupSpeakers.values());
            console.log(`[VOZ AO VIVO WS] Usuário ${userId} desconectou da sala ${room}. Restantes: ${remainingSpeakers.length}`);

            io.to(room).emit('user-stopped-speaking', { room, groupId: room, userId });
            io.to(room).emit('active-speakers-updated', { room, groupId: room, speakers: remainingSpeakers });

            if (groupSpeakers.size === 0) {
              activeSpeakersByGroup.delete(room);
              io.to(room).emit('group-live-voice-stopped', { room, groupId: room, timestamp: Date.now() });
            }
          }
        }
      });
    });
  });
}

module.exports = { initializeChatSocket };