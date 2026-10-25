import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    type: { type: String, enum: ['income', 'expense'], required: true },
    color: { type: String, default: '#6366f1' },
    icon: { type: String, default: 'tag' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index(
  { userId: 1, type: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

export const Category = mongoose.model('Category', categorySchema);