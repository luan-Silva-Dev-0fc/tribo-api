const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/AuthController');
const authMiddleware = require('../middlewares/auth');
const { validateRequest } = require('../utils/validators');
const { uploadFile } = require('../middlewares/upload');
const { authLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  uploadFile,
  [
    body('name').notEmpty().withMessage('Nome é obrigatório'),
    body('email').isEmail().withMessage('E-mail inválido'),
    body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres')
  ],
  validateRequest,
  authController.register
);


router.post(
  '/google',
  authLimiter,
  authController.googleAuth
);

router.post(
  '/auth/google',
  authLimiter,
  authController.googleAuth
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').notEmpty().withMessage('E-mail ou nome de usuário é obrigatório'),
    body('password').notEmpty().withMessage('Senha é obrigatória')
  ],
  validateRequest,
  authController.login
);

router.post(
  '/verify-email',
  authLimiter,
  [
    body('email').isEmail().withMessage('E-mail inválido'),
    body('code').notEmpty().withMessage('Código de verificação é obrigatório')
  ],
  validateRequest,
  authController.verifyEmail
);

router.post(
  '/auth/verify-email',
  authLimiter,
  [
    body('email').isEmail().withMessage('E-mail inválido'),
    body('code').notEmpty().withMessage('Código de verificação é obrigatório')
  ],
  validateRequest,
  authController.verifyEmail
);

router.post(
  '/resend-code',
  authLimiter,
  [body('email').isEmail().withMessage('E-mail inválido')],
  validateRequest,
  authController.resendVerificationCode
);

router.post(
  '/auth/resend-code',
  authLimiter,
  [body('email').isEmail().withMessage('E-mail inválido')],
  validateRequest,
  authController.resendVerificationCode
);

// GET /me NUNCA deve ser bloqueado por authLimiter (é a rota de perfil e checagem de sessão)
router.get('/me', authMiddleware, authController.me);

module.exports = router;