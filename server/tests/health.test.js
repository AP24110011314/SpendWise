import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { setup, teardown } from './setup.js';

describe('Health endpoint', () => {
  let app;

  beforeAll(async () => {
    await setup();
    await connectDB();
    app = createApp();
  });

  afterAll(async () => {
    await disconnectDB();
    await teardown();
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });
});