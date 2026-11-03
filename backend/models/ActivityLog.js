const mongoose = require('mongoose');

/**
 * ActivityLog — Immutable audit trail for all system events.
 * Powers the analytics dashboard and user activity feeds.
 */
const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      default: null,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'user_registered',
        'user_login',
        'repo_created',
        'repo_updated',
        'repo_deleted',
        'repo_archived',
        'branch_created',
        'branch_deleted',
        'branch_protected',
        'commit_created',
        'branch_merged',
        'pr_opened',
        'pr_merged',
        'pr_closed',
        'pr_commented',
        'issue_created',
        'issue_closed',
        'issue_reopened',
        'issue_commented',
        'issue_assigned',
        'tag_created',
        'tag_deleted',
        'release_created',
        'collaborator_added',
        'collaborator_removed',
        'branch_unprotected',
        'commit_reverted',
        'integrity_verified',
        'security_violation',
      ],
    },
    // Embed metadata directly — avoids joins, good for audit queries
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    entityModel: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Primary query patterns for DBMS audit trail
activityLogSchema.index({ repository: 1, createdAt: -1 });
activityLogSchema.index({ repository: 1, action: 1, createdAt: -1 });
activityLogSchema.index({ repository: 1, user: 1, createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
