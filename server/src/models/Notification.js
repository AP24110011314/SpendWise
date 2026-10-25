import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['budget_warning', 'budget_exceeded'], required: true },
    budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget', required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    message: { type: String, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index(
  { userId: 1, budgetId: 1, type: 1, month: 1 },
  { unique: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);