const express = require('express');
const uploadController = require('../controllers/UploadController');
const authMiddleware = require('../middlewares/auth');
const { uploadFile } = require('../middlewares/upload');
const { uploadLimiter } = require('../middlewares/rateLimiter');

const router = express.Router();

router.use(uploadLimiter);

router.post('/photos', authMiddleware, uploadFile, uploadController.uploadPhoto);
router.post('/photo', authMiddleware, uploadFile, uploadController.uploadPhoto);

router.post('/videos', authMiddleware, uploadFile, uploadController.uploadVideo);
router.post('/video', authMiddleware, uploadFile, uploadController.uploadVideo);

router.post('/audios', authMiddleware, uploadFile, uploadController.uploadAudio);
router.post('/audio', authMiddleware, uploadFile, uploadController.uploadAudio);

router.post('/file', authMiddleware, uploadFile, uploadController.uploadFile);
router.post('/', authMiddleware, uploadFile, uploadController.uploadFile);

module.exports = router;