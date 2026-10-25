import mongoose from 'mongoose';
import { getEnv } from './env.js';
import { getLogger } from './logger.js';

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;
  const { MONGODB_URI } = getEnv();
  const logger = getLogger();
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error({ err }, 'MongoDB connection error');
    throw err;
  }
}

export function getConnectionStatus() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDB() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}