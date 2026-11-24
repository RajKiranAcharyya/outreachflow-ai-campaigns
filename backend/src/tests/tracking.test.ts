import { trackingService } from '../services/trackingService';
import { db } from '../db/db';

describe('Tracking & Unsubscribe Service', () => {
  beforeAll(async () => {
    await db.migrate.latest();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('Signed Unsubscribe Links', () => {
    it('should generate valid HMAC-SHA256 signatures', () => {
      const sig1 = trackingService.generateUnsubscribeSignature(12, 'alice@example.com');
      const sig2 = trackingService.generateUnsubscribeSignature(12, 'alice@example.com');
      expect(sig1).toBe(sig2);
      expect(sig1).toHaveLength(64); // sha256 hex
    });

    it('should verify matching signature', () => {
      const sig = trackingService.generateUnsubscribeSignature(42, 'bob@company.com');
      const isValid = trackingService.verifyUnsubscribe(42, 'bob@company.com', sig);
      expect(isValid).toBe(true);
    });

    it('should reject tampered email or enrollment ID', () => {
      const sig = trackingService.generateUnsubscribeSignature(42, 'bob@company.com');
      const isTamperedEmail = trackingService.verifyUnsubscribe(42, 'attacker@evil.com', sig);
      const isTamperedId = trackingService.verifyUnsubscribe(99, 'bob@company.com', sig);
      expect(isTamperedEmail).toBe(false);
      expect(isTamperedId).toBe(false);
    });

    it('should build proper unsubscribe URLs', () => {
      const url = trackingService.buildUnsubscribeUrl('http://localhost:3000', 10, 'test@example.com');
      expect(url).toContain('http://localhost:3000/api/track/unsubscribe?enrollment_id=10');
      expect(url).toContain('&email=test%40example.com');
      expect(url).toContain('&sig=');
    });
  });

  describe('Open Tracking Pixel', () => {
    it('should return a valid 1x1 transparent GIF buffer', () => {
      const buffer = trackingService.getTrackingPixelBuffer();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('ascii', 0, 3)).toBe('GIF');
    });

    it('should record open timestamp in emails table', async () => {
      // Setup test contact, campaign, enrollment and email
      const [contactId] = await db('contacts').insert({
        email: `track_${Date.now()}@test.com`,
        status: 'active',
      });
      const [campaignId] = await db('campaigns').insert({
        name: 'Track Test Campaign',
        status: 'active',
      });
      const [enrollmentId] = await db('enrollments').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        status: 'active',
      });
      const [emailId] = await db('emails').insert({
        enrollment_id: enrollmentId,
        step_number: 1,
        status: 'sent',
        idempotency_key: `track_key_${Date.now()}`,
      });

      const initialRecord = await db('emails').where({ id: emailId }).first();
      expect(initialRecord.opened_at).toBeNull();

      const recorded = await trackingService.recordEmailOpen(emailId);
      expect(recorded).toBe(true);

      const updatedRecord = await db('emails').where({ id: emailId }).first();
      expect(updatedRecord.opened_at).not.toBeNull();

      // Second open should not overwrite original open
      const secondRecord = await trackingService.recordEmailOpen(emailId);
      expect(secondRecord).toBe(false);
    });
  });
});
