const mongoose = require('mongoose');

const prCommentSchema = new mongoose.Schema(
  {
    pullRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PullRequest',
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    body: {
      type: String,
      required: [true, 'Comment body is required'],
      maxlength: [10000, 'Comment cannot exceed 10000 characters'],
      trim: true,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

prCommentSchema.index({ pullRequest: 1, createdAt: 1 });

module.exports = mongoose.model('PRComment', prCommentSchema);
