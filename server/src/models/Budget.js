import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    limit: { type: Number, required: true, min: 1 },
    alertThreshold: { type: Number, default: 80, min: 1, max: 100 },
  },
  { timestamps: true }
);

budgetSchema.index({ userId: 1, month: 1, categoryId: 1 }, { unique: true });

export const Budget = mongoose.model('Budget', budgetSchema);