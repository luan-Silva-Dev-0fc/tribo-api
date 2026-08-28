const https = require('https');
const { messaging } = require('../config/firebase');
const pushTokenModel = require('../models/pushTokenModel');

function isExpoToken(token) {
  if (!token || typeof token !== 'string') return false;
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

async function sendExpoPushNotifications(messages) {
  if (!messages || messages.length === 0) return { success: true, count: 0 };

  return new Promise((resolve) => {
    try {
      const data = JSON.stringify(messages);
      const options = {
        hostname: 'exp.host',
        port: 443,
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate'
        }
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody);
            resolve({ success: true, data: parsed });
          } catch (_) {
            resolve({ success: true, raw: responseBody });
          }
        });
      });

      req.on('error', (err) => {
        console.warn('⚠️ [Expo Push] Falha ao enviar para Expo Push Service:', err.message);
        resolve({ success: false, error: err.message });
      });

      req.write(data);
      req.end();
    } catch (e) {
      console.warn('⚠️ [Expo Push Exception]:', e.message);
      resolve({ success: false, error: e.message });
    }
  });
}

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

    const expoTokens = [];
    const fcmTokens = [];

    for (const tok of targetTokens) {
      if (isExpoToken(tok)) {
        expoTokens.push(tok);
      } else {
        fcmTokens.push(tok);
      }
    }

    const results = {
      expo: null,
      fcm: null,
      totalTokens: targetTokens.length
    };

    if (expoTokens.length > 0) {
      const expoMessages = expoTokens.map((to) => ({
        to,
        sound: 'default',
        title: title || 'Tribo',
        body: body || '',
        data: formattedData,
        channelId: 'tribo_notifications',
        priority: 'high',
        badge: 1
      }));

      results.expo = await sendExpoPushNotifications(expoMessages);
    }

    if (fcmTokens.length > 0 && messaging) {
      try {
        const messagePayload = {
          tokens: fcmTokens,
          notification: {
            title: title || 'Tribo',
            body: body || '',
            ...(imageUrl ? { imageUrl } : {})
          },
          data: formattedData,
          android: {
            priority: 'high',
            notification: {
              icon: 'ic_notification',
              color: '#F59E0B',
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
            ...(imageUrl ? { fcmOptions: { imageUrl } } : {})
          }
        };

        const response = await messaging.sendEachForMulticast(messagePayload);
        results.fcm = {
          successCount: response.successCount,
          failureCount: response.failureCount
        };

        const invalidTokens = [];
        response.responses.forEach((res, idx) => {
          if (!res.success) {
            const errCode = res.error?.code || '';
            if (
              errCode === 'messaging/invalid-registration-token' ||
              errCode === 'messaging/registration-token-not-registered' ||
              errCode === 'messaging/mismatched-credential'
            ) {
              invalidTokens.push(fcmTokens[idx]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          await pushTokenModel.deleteInvalidTokens(invalidTokens);
          console.log(`🧹 ${invalidTokens.length} token(s) FCM inválido(s) removido(s).`);
        }
      } catch (fcmErr) {
        console.warn('⚠️ [FCM Push Error]:', fcmErr.message);
        results.fcm = { error: fcmErr.message };
      }
    }

    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('❌ Erro ao enviar notificação push:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification,
  sendExpoPushNotifications
};