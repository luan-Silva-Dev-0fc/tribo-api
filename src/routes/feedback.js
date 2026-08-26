const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.post('/', authMiddleware, feedbackController.sendFeedback);

module.exports = router;