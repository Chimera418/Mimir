const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
  {
    repository: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repository',
      required: true,
    },
    number: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Issue title is required'],
      maxlength: [256],
      trim: true,
    },
    body: {
      type: String,
      maxlength: [10000],
      default: '',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    labels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Label',
      },
    ],
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

issueSchema.index({ repository: 1, number: 1 }, { unique: true });
issueSchema.index({ repository: 1, status: 1 });
issueSchema.index({ title: 'text', body: 'text' }); // for search

module.exports = mongoose.model('Issue', issueSchema);
