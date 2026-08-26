const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let firebaseApp = null;
let messaging = null;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    if (getApps().length === 0) {
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      console.log('🔥 Firebase Admin SDK inicializado com sucesso.');
    } else {
      firebaseApp = getApp();
    }
    messaging = getMessaging(firebaseApp);
  } else {
    console.warn('⚠️ Credenciais do Firebase incompletas no arquivo .env.');
  }
} catch (error) {
  console.error('❌ Erro ao inicializar o Firebase Admin SDK:', error.message);
}

module.exports = {
  app: firebaseApp,
  messaging
};