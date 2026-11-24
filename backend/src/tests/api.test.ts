import request from 'supertest';
import { app } from '../app';
import { db } from '../db/db';

describe('API Routes & Security', () => {
  const adminToken = process.env.ADMIN_TOKEN || 'secret_admin_token';

  beforeAll(async () => {
    await db.migrate.latest();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('Authentication & Public Routes', () => {
    it('GET /health should return 200 without token', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /api/contacts should reject unauthorized requests with 401', async () => {
      const res = await request(app).get('/api/contacts');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/contacts should accept valid x-admin-token', async () => {
      const res = await request(app)
        .get('/api/contacts')
        .set('x-admin-token', adminToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Contacts API & CSV Import', () => {
    it('POST /api/contacts should create a valid contact', async () => {
      const email = `api_contact_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/contacts')
        .set('x-admin-token', adminToken)
        .send({
          email,
          first_name: 'ApiUser',
          company: 'Acme',
        });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe(email);
    });

    it('POST /api/contacts/import should import contacts from CSV text', async () => {
      const timestamp = Date.now();
      const csv = `email,first_name,company\nimport1_${timestamp}@example.com,ImportOne,CompanyA\nimport2_${timestamp}@example.com,ImportTwo,CompanyB`;

      const res = await request(app)
        .post('/api/contacts/import')
        .set('x-admin-token', adminToken)
        .send({ csv });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.imported).toBe(2);
    });
  });

  describe('Campaigns API & Multi-step Enrollment', () => {
    it('POST /api/campaigns should create a campaign with steps', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .set('x-admin-token', adminToken)
        .send({
          name: 'API Cold Outreach',
          daily_limit: 100,
          steps: [
            {
              step_number: 1,
              delay_minutes: 0,
              subject_template: 'Intro to {{first_name}}',
              body_template: 'Hi {{first_name}}, {{ai_opening}}',
            },
            {
              step_number: 2,
              delay_minutes: 60,
              subject_template: 'Follow up',
              body_template: 'Checking in',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('API Cold Outreach');
      expect(res.body.steps.length).toBe(2);
    });

    it('POST /api/campaigns/:id/enroll should enroll contacts and generate AI opening', async () => {
      // 1. Create a contact
      const email = `enroll_${Date.now()}@test.com`;
      const contactRes = await request(app)
        .post('/api/contacts')
        .set('x-admin-token', adminToken)
        .send({ email, first_name: 'TargetUser', company: 'TargetCorp' });

      // 2. Create campaign
      const campRes = await request(app)
        .post('/api/campaigns')
        .set('x-admin-token', adminToken)
        .send({
          name: 'Enrollment Campaign',
          daily_limit: 50,
          steps: [
            {
              step_number: 1,
              delay_minutes: 0,
              subject_template: 'Hi {{first_name}}',
              body_template: '{{ai_opening}} We should talk.',
            },
          ],
        });

      // 3. Enroll contact
      const enrollRes = await request(app)
        .post(`/api/campaigns/${campRes.body.id}/enroll`)
        .set('x-admin-token', adminToken)
        .send({ contact_ids: [contactRes.body.id] });

      expect(enrollRes.status).toBe(200);
      expect(enrollRes.body.success).toBe(true);
      expect(enrollRes.body.enrolledCount).toBe(1);
      expect(enrollRes.body.details[0].aiOpening).toBeDefined();

      // Verify email was enqueued in DB
      const queuedEmail = await db('emails')
        .where({ enrollment_id: enrollRes.body.details[0].enrollmentId, step_number: 1 })
        .first();

      expect(queuedEmail).toBeDefined();
      expect(queuedEmail.status).toBe('pending');
      expect(queuedEmail.body).toContain(enrollRes.body.details[0].aiOpening);
    });
  });

  describe('Dashboard Statistics', () => {
    it('GET /api/dashboard/stats should return dashboard key metrics', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('x-admin-token', adminToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalContacts');
      expect(res.body).toHaveProperty('activeCampaigns');
      expect(res.body).toHaveProperty('sent');
      expect(res.body).toHaveProperty('failed');
      expect(res.body).toHaveProperty('pending');
      expect(res.body).toHaveProperty('opened');
      expect(res.body).toHaveProperty('openRate');
    });
  });

  describe('Tracking Endpoints', () => {
    it('GET /api/track/open/:emailId should return 1x1 GIF image', async () => {
      const res = await request(app).get('/api/track/open/1');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/gif');
    });
  });
});
