const blockModel = require("../models/blockModel");

async function listBlocks(req, res, next) {
  try {
    return res.status(200).json(await blockModel.getBlocksByUser(req.user.sub));
  } catch (error) {
    next(error);
  }
}

async function blockUser(req, res, next) {
  try {
    if (req.params.userId === req.user.sub)
    return res.
    status(400).
    json({ message: "Você não pode bloquear a si mesmo" });
    const existing = await blockModel.findBlock(
      req.user.sub,
      req.params.userId
    );
    if (existing)
    return res.status(409).json({ message: "Usuário já bloqueado" });
    return res.
    status(201).
    json(
      await blockModel.createBlock({
        blocker_id: req.user.sub,
        blocked_id: req.params.userId
      })
    );
  } catch (error) {
    next(error);
  }
}

async function unblockUser(req, res, next) {
  try {
    const block = await blockModel.findBlock(req.user.sub, req.params.userId);
    if (!block)
    return res.status(404).json({ message: "Bloqueio não encontrado" });
    await blockModel.deleteBlock(block.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = { listBlocks, blockUser, unblockUser };