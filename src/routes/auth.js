const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/AuthController');
const authMiddleware = require('../middlewares/auth');
const { validateRequest } = require('../utils/validators');
const { uploadFile } = require('../middlewares/upload');
const { authLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(authLimiter);

router.post(
  '/register',
  uploadFile,
  [
  body('name').notEmpty().withMessage('Nome é obrigatório'),
  body('email').isEmail().withMessage('E-mail inválido'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres')],

  validateRequest,
  authController.register
);

router.post(
  '/login',
  [
  body('email').notEmpty().withMessage('E-mail ou nome de usuário é obrigatório'),
  body('password').notEmpty().withMessage('Senha é obrigatória')],

  validateRequest,
  authController.login
);

router.post(
  '/verify-email',
  [
  body('email').isEmail().withMessage('E-mail inválido'),
  body('code').notEmpty().withMessage('Código de verificação é obrigatório')],

  validateRequest,
  authController.verifyEmail
);

router.post(
  '/auth/verify-email',
  [
  body('email').isEmail().withMessage('E-mail inválido'),
  body('code').notEmpty().withMessage('Código de verificação é obrigatório')],

  validateRequest,
  authController.verifyEmail
);

router.post(
  '/resend-code',
  [body('email').isEmail().withMessage('E-mail inválido')],
  validateRequest,
  authController.resendVerificationCode
);

router.post(
  '/auth/resend-code',
  [body('email').isEmail().withMessage('E-mail inválido')],
  validateRequest,
  authController.resendVerificationCode
);

router.get('/me', authMiddleware, authController.me);

module.exports = router;