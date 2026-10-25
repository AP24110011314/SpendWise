import mongoose from 'mongoose';

const recurringRuleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: 1 },
    note: { type: String, default: '', trim: true, maxlength: 200 },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    anchorDay: { type: Number, required: true, min: 1, max: 31 },
    nextRunAt: { type: Date, required: true },
    lastRunAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

recurringRuleSchema.index({ active: 1, nextRunAt: 1 });
recurringRuleSchema.index({ userId: 1 });

export const RecurringRule = mongoose.model('RecurringRule', recurringRuleSchema);