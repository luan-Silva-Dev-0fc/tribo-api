const { messaging } = require('../config/firebase');
const pushTokenModel = require('../models/pushTokenModel');

async function sendPushNotification({
  userId,
  userIds,
  tokens: directTokens,
  title,
  body,
  data = {},
  imageUrl
}) {
  try {
    if (!messaging) {
      console.warn('⚠️ Push Notification ignorada: Firebase Messaging não inicializado.');
      return { success: false, reason: 'firebase_not_initialized' };
    }

    let targetTokens = [];

    if (Array.isArray(directTokens) && directTokens.length > 0) {
      targetTokens = directTokens;
    } else if (userId) {
      targetTokens = await pushTokenModel.getUserTokens(userId);
    } else if (Array.isArray(userIds) && userIds.length > 0) {
      const userTokenRows = await pushTokenModel.getUsersTokens(userIds);
      targetTokens = userTokenRows.map((r) => r.token);
    }

    targetTokens = Array.from(new Set(targetTokens.filter(Boolean)));

    if (targetTokens.length === 0) {
      return { success: false, reason: 'no_tokens_found', count: 0 };
    }

    const formattedData = {};
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) {
          formattedData[key] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      }
    }

    const messagePayload = {
      tokens: targetTokens,
      notification: {
        title: title || 'Tribo',
        body: body || '',
        ...(imageUrl ? { imageUrl } : {})
      },
      data: formattedData,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'max',
          channelId: 'tribo_notifications',
          ...(imageUrl ? { imageUrl } : {})
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        },
        ...(imageUrl ?
        {
          fcmOptions: {
            imageUrl
          }
        } :
        {})
      }
    };

    const response = await messaging.sendEachForMulticast(messagePayload);

    const invalidTokens = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const errCode = res.error?.code || '';
        if (
        errCode === 'messaging/invalid-registration-token' ||
        errCode === 'messaging/registration-token-not-registered' ||
        errCode === 'messaging/mismatched-credential')
        {
          invalidTokens.push(targetTokens[idx]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await pushTokenModel.deleteInvalidTokens(invalidTokens);
      console.log(`🧹 ${invalidTokens.length} token(s) inválido(s) removido(s) do banco de dados.`);
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: targetTokens.length
    };
  } catch (error) {
    console.error('❌ Erro ao enviar notificação push:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification
};