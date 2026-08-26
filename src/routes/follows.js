const express = require('express');
const followController = require('../controllers/followController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.get('/requests', authMiddleware, followController.listFollowRequests);
router.post('/requests/:id/accept', authMiddleware, followController.acceptFollowRequest);
router.post('/requests/:id/reject', authMiddleware, followController.rejectFollowRequest);

router.get('/', authMiddleware, followController.listFollows);
router.get('/:id', authMiddleware, followController.getFollowById);
router.post('/', authMiddleware, followController.createFollow);
router.post('/:id', authMiddleware, followController.createFollow);
router.put('/:id', authMiddleware, followController.updateFollow);
router.delete('/:id', authMiddleware, followController.unfollowUser);

module.exports = router;