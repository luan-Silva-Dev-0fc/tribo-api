const express = require('express');
const trendController = require('../controllers/TrendController');

const router = express.Router();

router.get('/', trendController.getTrends);

module.exports = router;