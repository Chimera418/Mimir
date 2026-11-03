const mongoose = require('mongoose');

const issueCommentSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
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
      maxlength: [10000],
      trim: true,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

issueCommentSchema.index({ issue: 1, createdAt: 1 });

module.exports = mongoose.model('IssueComment', issueCommentSchema);
