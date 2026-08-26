const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const StickerController = require('../controllers/StickerController');

router.use(auth);

router.post('/video', StickerController.createVideoSticker);
router.get('/my-inventory', StickerController.listMyInventory);
router.post('/:id/favorite', StickerController.favoriteSticker);
router.delete('/:id/favorite', StickerController.unfavoriteSticker);
router.get('/:id', StickerController.getSticker);

module.exports = router;