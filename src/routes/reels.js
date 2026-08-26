const express = require('express');
const router = express.Router();
const ReelsController = require('../controllers/ReelsController');
const { auth, optionalAuth } = require('../middlewares/auth');

router.get('/categories', optionalAuth, ReelsController.getCategories);

router.get('/preferences', auth, ReelsController.getPreferences);
router.post('/preferences', auth, ReelsController.savePreferences);

router.get('/feed', optionalAuth, ReelsController.getFeed);
router.get('/', optionalAuth, ReelsController.getFeed);

router.post('/:videoId/like', auth, ReelsController.toggleLike);
router.post('/:videoId/more-like-this', auth, ReelsController.moreLikeThis);
router.post('/:videoId/not-interested', auth, ReelsController.notInterested);

module.exports = router;