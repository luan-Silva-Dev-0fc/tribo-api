const express = require('express');
const router = express.Router();
const trackController = require('../controllers/TrackController');
const { auth } = require('../middlewares/auth');
const { uploadFile } = require('../middlewares/upload');

// Todas as rotas de gerenciamento de faixas exigem autenticação
router.use(auth);

// GET /api/tracks / GET /api/users/me/tracks
router.get('/', trackController.listUserTracks);
router.get('/me', trackController.listUserTracks);

// POST /api/tracks / POST /api/users/me/tracks
router.post('/', uploadFile, trackController.createTrack);
router.post('/me', uploadFile, trackController.createTrack);

// DELETE /api/tracks/:id
router.delete('/:id', trackController.deleteTrack);

module.exports = router;
