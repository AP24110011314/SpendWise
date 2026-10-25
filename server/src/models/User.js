import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    currency: { type: String, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
    timezone: { type: String, default: 'Asia/Kolkata' },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

// Validate timezone using Intl.DateTimeFormat
userSchema.path('timezone').validate(function (value) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Invalid timezone');

export const User = mongoose.model('User', userSchema);