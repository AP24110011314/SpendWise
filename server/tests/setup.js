import { vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

export async function setup() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-for-testing';
  process.env.CLIENT_ORIGIN = 'http://localhost:5173';
  process.env.COOKIE_NAME = 'sw_token';
  process.env.ENABLE_CRON = 'false';
  process.env.NODE_ENV = 'test';
}

export async function teardown() {
  if (mongod) {
    await mongod.stop();
  }
}

vi.setConfig({ testTimeout: 10000 });