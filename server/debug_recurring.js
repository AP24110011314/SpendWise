import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { nextOccurrence } from './src/utils/dates.js';

async function test() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const rule = {
    frequency: 'monthly',
    startDate: new Date('2026-01-01'),
    anchorDay: 1,
    endDate: new Date('2026-12-31'),
  };

  const startDt = new Date('2026-01-01');
  const nextRunAt = nextOccurrence(rule, startDt);
  console.log('nextRunAt:', nextRunAt);

  await mongoose.disconnect();
  await mongod.stop();
}

test().catch(console.error);
