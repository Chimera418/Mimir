const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');

/**
 * logActivity — Records a system event in the ActivityLog collection.
 * Call this inside transactions using the session option.
 */
const logActivity = async (
  { userId, repositoryId = null, action, metadata = {}, entityId = null, entityModel = null },
  session = null
) => {
  const doc = {
    user: userId,
    repository: repositoryId,
    action,
    metadata,
    entityId,
    entityModel,
  };
  if (session) {
    await ActivityLog.create([doc], { session });
  } else {
    await ActivityLog.create(doc);
  }
};

/**
 * createNotification — Sends a persistent notification to a user.
 */
const createNotification = async (
  { recipientId, actorId, type, message, relatedEntity = null, entityModel = null, entityUrl = '' },
  session = null
) => {
  if (recipientId.toString() === actorId.toString()) return; // don't notify yourself
  const doc = {
    recipient: recipientId,
    actor: actorId,
    type,
    message,
    relatedEntity,
    entityModel,
    entityUrl,
  };
  if (session) {
    await Notification.create([doc], { session });
  } else {
    await Notification.create(doc);
  }
};

module.exports = { logActivity, createNotification };
