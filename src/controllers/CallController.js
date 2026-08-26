const callModel = require("../models/callModel");

function notFound(res) {
  return res.status(404).json({ message: "Chamada não encontrada" });
}
function forbidden(res) {
  return res.status(403).json({ message: "Sem permissão para esta operação" });
}
async function listCalls(req, res, next) {
  try {
    return res.status(200).json(await callModel.getAllCalls(req.user.sub));
  } catch (error) {
    next(error);
  }
}
async function getCallById(req, res, next) {
  try {
    const item = await callModel.getCallById(req.params.id);
    if (!item) return notFound(res);
    if (item.started_by !== req.user.sub) return forbidden(res);
    return res.status(200).json(item);
  } catch (error) {
    next(error);
  }
}

async function startCall(req, res, next) {
  try {
    const call = await callModel.startCall({
      room_id: req.body.roomId,
      started_by: req.user.sub
    });
    return res.status(201).json(call);
  } catch (error) {
    next(error);
  }
}

async function endCall(req, res, next) {
  try {
    const existing = await callModel.getCallById(req.params.id);
    if (!existing) return notFound(res);
    if (existing.started_by !== req.user.sub) return forbidden(res);
    const call = await callModel.endCall(req.params.id);
    return res.status(200).json(call);
  } catch (error) {
    next(error);
  }
}

async function updateCall(req, res, next) {
  try {
    const item = await callModel.getCallById(req.params.id);
    if (!item) return notFound(res);
    if (item.started_by !== req.user.sub) return forbidden(res);
    const updated = await callModel.updateCall(req.params.id, {
      room_id: req.body.roomId
    });
    return res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}
async function deleteCall(req, res, next) {
  try {
    const item = await callModel.getCallById(req.params.id);
    if (!item) return notFound(res);
    if (item.started_by !== req.user.sub) return forbidden(res);
    await callModel.deleteCall(req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCalls,
  getCallById,
  startCall,
  endCall,
  updateCall,
  deleteCall
};