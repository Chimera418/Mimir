const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'collaborator_added',
        'pr_opened',
        'pr_merged',
        'pr_closed',
        'pr_commented',
        'issue_assigned',
        'issue_commented',
        'issue_closed',
        'mention',
        'repo_starred',
        'release_published',
        'tag_created',
      ],
    },
    // Embed the notification message directly for performance
    message: {
      type: String,
      required: true,
      maxlength: [500],
    },
    relatedEntity: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    entityModel: {
      type: String,
      enum: ['Repository', 'PullRequest', 'Issue', 'Commit', 'Release', null],
      default: null,
    },
    entityUrl: {
      type: String,
      default: '',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
