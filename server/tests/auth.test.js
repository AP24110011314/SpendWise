import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, teardown } from './setup.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';

let app;

beforeAll(async () => {
  await setup();
  const { createApp } = await import('../src/app.js');
  app = createApp();
  await connectDB();
});

afterAll(async () => {
  await teardown();
});

describe('Auth Routes', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return user with token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' })
        .expect(201);

      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user).toHaveProperty('email', 'test@example.com');
      expect(res.body.data.user).toHaveProperty('name', 'Test User');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should create default categories for new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' })
        .expect(201);

      const categories = await Category.find({ userId: res.body.data.user._id });
      expect(categories.length).toBe(15);
      expect(categories.every(c => c.isDefault === true)).toBe(true);
    });

    it('should return 409 for duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' })
        .expect(201);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Another User', email: 'test@example.com', password: 'password123' })
        .expect(409);

      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should return 400 for missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'test@example.com', password: 'short' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
    });

    it('should login and return user with token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(200);

      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('should return 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    let cookie;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
      cookie = res.headers['set-cookie'];
    });

    it('should logout and clear cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.data.success).toBe(true);
      expect(res.headers['set-cookie'][0]).toContain('Max-Age=0');
    });

    it('should return 401 without auth', async () => {
      await request(app)
        .post('/api/auth/logout')
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let cookie;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
      cookie = res.headers['set-cookie'];
    });

    it('should return current user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.data.user).toHaveProperty('email', 'test@example.com');
      expect(res.body.data.user).toHaveProperty('name', 'Test User');
    });

    it('should return 401 without auth', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('PATCH /api/auth/me', () => {
    let cookie;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
      cookie = res.headers['set-cookie'];
    });

    it('should update user name', async () => {
      const res = await request(app)
        .patch('/api/auth/me')
        .set('Cookie', cookie)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.data.user.name).toBe('Updated Name');
    });

    it('should update user currency', async () => {
      const res = await request(app)
        .patch('/api/auth/me')
        .set('Cookie', cookie)
        .send({ currency: 'USD' })
        .expect(200);

      expect(res.body.data.user.currency).toBe('USD');
    });

    it('should update user timezone', async () => {
      const res = await request(app)
        .patch('/api/auth/me')
        .set('Cookie', cookie)
        .send({ timezone: 'America/New_York' })
        .expect(200);

      expect(res.body.data.user.timezone).toBe('America/New_York');
    });

    it('should return 400 for no valid fields', async () => {
      const res = await request(app)
        .patch('/api/auth/me')
        .set('Cookie', cookie)
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/change-password', () => {
    let cookie;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
      cookie = res.headers['set-cookie'];
    });

    it('should change password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'password123', newPassword: 'newpassword123' })
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });

    it('should return 401 for wrong current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword123' })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 for short new password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'password123', newPassword: 'short' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});