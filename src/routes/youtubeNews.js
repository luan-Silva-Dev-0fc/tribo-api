const trendController = require('../controllers/TrendController');

const express = require('express');
const router = express.Router();

router.get('/', trendController.getYoutubeNews);

module.exports = router;