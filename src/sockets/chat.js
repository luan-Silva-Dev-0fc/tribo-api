const { randomUUID } = require('crypto');
const env = require('../config/env');
const { logger } = require('../utils/logger');

const activeSpeakersByGroup = new Map();
const liveStreamsByRoom = new Map();
const MAX_LIVE_VOICE_CHUNK_BYTES = 96 * 1024;
const DIAGNOSTIC_LOG_INTERVAL_MS = 5000;

function getGroupSpeakers(groupId) {
  const room = String(groupId);
  if (!activeSpeakersByGroup.has(room)) {
    return [];
  }
  return Array.from(activeSpeakersByGroup.get(room).values());
}

function getRoomStreams(room) {
  if (!liveStreamsByRoom.has(room)) liveStreamsByRoom.set(room, new Map());
  return liveStreamsByRoom.get(room);
}

function removeLiveStream(room, socketId) {
  const streams = liveStreamsByRoom.get(room);
  if (!streams) return;
  streams.delete(socketId);
  if (streams.size === 0) liveStreamsByRoom.delete(room);
}

function getChunkAudio(payload) {
  const audio = payload?.audio ?? payload?.chunk ?? payload?.audioBase64;
  if (typeof audio === 'string') {
    const size = Buffer.byteLength(audio, 'utf8');
    return { audio, isBase64: true, size };
  }

  if (Buffer.isBuffer(audio)) return { audio, isBase64: false, size: audio.length };
  if (audio instanceof ArrayBuffer) {
    const buffer = Buffer.from(audio);
    return { audio: buffer, isBase64: false, size: buffer.length };
  }
  if (ArrayBuffer.isView(audio)) {
    const buffer = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
    return { audio: buffer, isBase64: false, size: buffer.length };
  }
  return null;
}

function reportLiveVoiceDiagnostics(stream, room) {
  if (!env.LIVE_VOICE_DIAGNOSTICS || Date.now() - stream.lastDiagnosticAt < DIAGNOSTIC_LOG_INTERVAL_MS) return;

  stream.lastDiagnosticAt = Date.now();
  logger.info('Live Voice relay diagnostics', {
    room,
    streamId: stream.streamId,
    chunksRelayed: stream.chunksRelayed,
    duplicatesDropped: stream.duplicatesDropped,
    gapsDetected: stream.gapsDetected,
    invalidChunksDropped: stream.invalidChunksDropped,
    lastSequence: stream.lastSequence,
    captureToServerMs: stream.lastCaptureToServerMs
  });
}

function relayLiveVoiceChunk(socket, eventName, payload) {
  const roomValue = payload?.room || payload?.groupId;
  if (!roomValue) return;

  const room = String(roomValue);
  const stream = liveStreamsByRoom.get(room)?.get(socket.id);
  const audio = getChunkAudio(payload);
  const serverReceiveTime = Date.now();

  if (!stream || !socket.rooms.has(room) || !audio || audio.size === 0 || audio.size > MAX_LIVE_VOICE_CHUNK_BYTES) {
    if (stream) {
      stream.invalidChunksDropped += 1;
      reportLiveVoiceDiagnostics(stream, room);
    }
    return;
  }

  if (payload.streamId && payload.streamId !== stream.streamId) {
    stream.invalidChunksDropped += 1;
    reportLiveVoiceDiagnostics(stream, room);
    return;
  }

  const requestedSequence = Number(payload.sequence);
  const sequence = Number.isSafeInteger(requestedSequence) && requestedSequence >= 0
    ? requestedSequence
    : stream.lastSequence + 1;

  if (sequence <= stream.lastSequence) {
    stream.duplicatesDropped += 1;
    reportLiveVoiceDiagnostics(stream, room);
    return;
  }

  if (sequence > stream.lastSequence + 1) stream.gapsDetected += sequence - stream.lastSequence - 1;
  stream.lastSequence = sequence;
  stream.chunksRelayed += 1;

  const serverEmitTime = Date.now();
  const captureTime = Number(payload.captureTime);
  stream.lastCaptureToServerMs = Number.isFinite(captureTime) ? serverReceiveTime - captureTime : null;

  const outboundPayload = {
    room,
    groupId: room,
    streamId: stream.streamId,
    sequence,
    userId: stream.userId,
    user: stream.user,
    mimeType: payload.mimeType || 'audio/webm',
    captureTime: Number.isFinite(captureTime) ? captureTime : null,
    sendTime: Number(payload.sendTime) || null,
    serverReceiveTime,
    serverEmitTime,
    timestamp: serverEmitTime
  };

  if (audio.isBase64) outboundPayload.audioBase64 = audio.audio;
  else outboundPayload.audio = audio.audio;

  socket.to(room).emit(eventName, outboundPayload);
  reportLiveVoiceDiagnostics(stream, room);
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
      const room = String(groupId);
      socket.leave(room);

      // The mobile client leaves the group when unmounting. End any live stream
      // owned by that socket so recipients do not keep a stale active speaker.
      if (socket.currentLiveRoom === room && activeSpeakersByGroup.has(room)) {
        const groupSpeakers = activeSpeakersByGroup.get(room);
        groupSpeakers.delete(socket.currentUserId);
        removeLiveStream(room, socket.id);
        const remainingSpeakers = Array.from(groupSpeakers.values());

        io.to(room).emit('user-stopped-speaking', { room, groupId: room, userId: socket.currentUserId });
        io.to(room).emit('active-speakers-updated', { room, groupId: room, speakers: remainingSpeakers });

        if (remainingSpeakers.length === 0) {
          activeSpeakersByGroup.delete(room);
          io.to(room).emit('group-live-voice-stopped', { room, groupId: room, timestamp: Date.now() });
        }
      }

      if (socket.currentLiveRoom === room) {
        socket.currentLiveRoom = null;
        socket.currentUserId = null;
      }
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

    socket.on('group-live-voice-start', (payload, callback) => {
      if (payload) {
        const requestedRoom = payload.room || payload.groupId;
        const user = payload.user || {};
        const requestedUserId = user.id || payload.userId;

        if (!requestedRoom || !requestedUserId) {
          if (typeof callback === 'function') callback({ success: false, message: 'Sala ou usuário inválido.' });
          return;
        }

        const room = String(requestedRoom);
        const userId = String(requestedUserId);
        if (!socket.rooms.has(room)) {
          if (typeof callback === 'function') callback({ success: false, message: 'Você não está conectado à sala.' });
          return;
        }

        const roomStreams = getRoomStreams(room);
        const streamId = typeof payload.streamId === 'string' && payload.streamId.length <= 128
          ? payload.streamId
          : randomUUID();
        const stream = {
          streamId,
          room,
          socketId: socket.id,
          userId,
          user,
          lastSequence: -1,
          chunksRelayed: 0,
          duplicatesDropped: 0,
          gapsDetected: 0,
          invalidChunksDropped: 0,
          lastDiagnosticAt: 0,
          lastCaptureToServerMs: null
        };
        roomStreams.set(socket.id, stream);

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
          streamId,
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

        logger.info('Live Voice iniciado', { room, userId, streamId, isVip, activeSpeakers: groupSpeakers.size });

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
          streamId,
          timestamp: Date.now()
        });

        if (typeof callback === 'function') callback({ success: true, room, groupId: room, streamId, nextSequence: 0 });
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

    socket.on('group-live-voice-chunk', (payload) => relayLiveVoiceChunk(socket, 'group-live-voice-chunk', payload));

    socket.on('send-audio-chunk', (payload) => relayLiveVoiceChunk(socket, 'receive-audio-chunk', payload));

    socket.on('group-live-voice-stop', (payload) => {
      const room = String(payload?.room || payload?.groupId || socket.currentLiveRoom);
      const userId = String(payload?.userId || payload?.user?.id || socket.currentUserId);

      if (activeSpeakersByGroup.has(room)) {
        const groupSpeakers = activeSpeakersByGroup.get(room);
        groupSpeakers.delete(userId);

        const remainingSpeakers = Array.from(groupSpeakers.values());
        removeLiveStream(room, socket.id);
        if (socket.currentLiveRoom === room) {
          socket.currentLiveRoom = null;
          socket.currentUserId = null;
        }
        logger.info('Live Voice encerrado', { room, userId, remainingSpeakers: remainingSpeakers.length });

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
        removeLiveStream(room, socket.id);
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
            removeLiveStream(room, socket.id);
            const remainingSpeakers = Array.from(groupSpeakers.values());
            logger.info('Live Voice desconectado', { room, userId, remainingSpeakers: remainingSpeakers.length });

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
