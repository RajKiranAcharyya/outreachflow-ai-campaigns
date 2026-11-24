import { queueService } from '../services/queueService';
import { SendWorker } from '../workers/sendWorker';
import { emailSender } from '../services/emailSender';
import { db } from '../db/db';

describe('Send Queue & Background Worker', () => {
  let worker: SendWorker;

  beforeAll(async () => {
    await db.migrate.latest();
  });

  beforeEach(async () => {
    worker = new SendWorker({
      maxAttempts: 3,
      baseBackoffSeconds: 10,
      stuckTimeoutMs: 1000,
      batchSize: 10,
    });
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('Idempotency & Enqueueing', () => {
    it('should generate deterministic idempotency keys', () => {
      const key1 = queueService.generateIdempotencyKey(5, 1, 100);
      const key2 = queueService.generateIdempotencyKey(5, 1, 100);
      expect(key1).toBe('campaign_5_step_1_contact_100');
      expect(key1).toBe(key2);
    });

    it('should prevent duplicate emails with the same idempotency key', async () => {
      const [contactId] = await db('contacts').insert({
        email: `idem_${Date.now()}@test.com`,
        first_name: 'Test',
        status: 'active',
      });
      const [campaignId] = await db('campaigns').insert({
        name: 'Idempotency Campaign',
        status: 'active',
      });
      const [enrollmentId] = await db('enrollments').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        status: 'active',
      });

      const firstEnqueue = await queueService.enqueueStepEmail({
        enrollmentId,
        campaignId,
        contactId,
        stepNumber: 1,
        delayMinutes: 0,
        subjectTemplate: 'Hello {{first_name}}',
        bodyTemplate: 'Hi {{first_name}}, {{ai_opening}}',
        contact: { email: `idem_${Date.now()}@test.com`, first_name: 'Test' },
        aiOpening: 'Loved your product!',
      });

      expect(firstEnqueue.duplicate).toBe(false);

      // Attempting to enqueue the exact same step again
      const secondEnqueue = await queueService.enqueueStepEmail({
        enrollmentId,
        campaignId,
        contactId,
        stepNumber: 1,
        delayMinutes: 0,
        subjectTemplate: 'Hello {{first_name}}',
        bodyTemplate: 'Hi {{first_name}}, {{ai_opening}}',
        contact: { email: `idem_${Date.now()}@test.com`, first_name: 'Test' },
      });

      expect(secondEnqueue.duplicate).toBe(true);
      expect(secondEnqueue.id).toBe(firstEnqueue.id);
    });
  });

  describe('Worker Processing & Multi-Step Sequence', () => {
    it('should process a pending email and advance to the next step', async () => {
      const [contactId] = await db('contacts').insert({
        email: `worker_step_${Date.now()}@test.com`,
        first_name: 'StepUser',
        company: 'CloudCorp',
        status: 'active',
      });
      const [campaignId] = await db('campaigns').insert({
        name: 'Two Step Campaign',
        status: 'active',
      });

      // Two steps in campaign
      await db('campaign_steps').insert([
        {
          campaign_id: campaignId,
          step_number: 1,
          delay_minutes: 0,
          subject_template: 'Step 1 for {{company}}',
          body_template: 'Body 1',
        },
        {
          campaign_id: campaignId,
          step_number: 2,
          delay_minutes: 0,
          subject_template: 'Step 2 follow up',
          body_template: 'Body 2',
        },
      ]);

      const [enrollmentId] = await db('enrollments').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        status: 'active',
        current_step: 1,
      });

      const { id: emailId } = await queueService.enqueueStepEmail({
        enrollmentId,
        campaignId,
        contactId,
        stepNumber: 1,
        delayMinutes: 0,
        subjectTemplate: 'Step 1 for {{company}}',
        bodyTemplate: 'Body 1',
        contact: { email: `worker_step_${Date.now()}@test.com`, company: 'CloudCorp' },
      });

      // Mock email sending
      jest.spyOn(emailSender, 'sendSandboxEmail').mockResolvedValueOnce({
        messageId: 'mock-msg-123',
        previewUrl: 'https://ethereal.email/message/mock',
        sandbox: true,
      });

      const result = await worker.processEmailJob(emailId);
      expect(result).toBe('sent');

      const sentEmail = await db('emails').where({ id: emailId }).first();
      expect(sentEmail.status).toBe('sent');
      expect(sentEmail.sent_at).not.toBeNull();

      // Check that step 2 was automatically enqueued
      const step2Email = await db('emails')
        .where({ enrollment_id: enrollmentId, step_number: 2 })
        .first();
      expect(step2Email).toBeDefined();
      expect(step2Email.status).toBe('pending');

      const updatedEnrollment = await db('enrollments').where({ id: enrollmentId }).first();
      expect(updatedEnrollment.current_step).toBe(2);
    });
  });

  describe('Exponential Backoff & Retries', () => {
    it('should retry with exponential backoff on send failure', async () => {
      const [contactId] = await db('contacts').insert({
        email: `retry_${Date.now()}@test.com`,
        status: 'active',
      });
      const [campaignId] = await db('campaigns').insert({
        name: 'Retry Campaign',
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
        status: 'pending',
        attempts: 0,
        idempotency_key: `retry_key_${Date.now()}`,
        subject: 'Test Subject',
        body: 'Test Body',
      });

      // Force emailSender failure
      jest.spyOn(emailSender, 'sendSandboxEmail').mockRejectedValueOnce(new Error('SMTP Connection timeout'));

      const result = await worker.processEmailJob(emailId);
      expect(result).toBe('retrying');

      const retryingEmail = await db('emails').where({ id: emailId }).first();
      expect(retryingEmail.status).toBe('pending');
      expect(retryingEmail.attempts).toBe(1);
      expect(retryingEmail.last_error).toContain('SMTP Connection timeout');
      expect(new Date(retryingEmail.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('should mark email as failed after maximum retry attempts', async () => {
      const [contactId] = await db('contacts').insert({
        email: `fail_${Date.now()}@test.com`,
        status: 'active',
      });
      const [campaignId] = await db('campaigns').insert({
        name: 'Max Fail Campaign',
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
        status: 'pending',
        attempts: 2, // already attempted 2 times
        idempotency_key: `max_fail_key_${Date.now()}`,
        subject: 'Test Subject',
        body: 'Test Body',
      });

      jest.spyOn(emailSender, 'sendSandboxEmail').mockRejectedValueOnce(new Error('Persistent SMTP 550'));

      const result = await worker.processEmailJob(emailId);
      expect(result).toBe('failed');

      const failedEmail = await db('emails').where({ id: emailId }).first();
      expect(failedEmail.status).toBe('failed');
      expect(failedEmail.attempts).toBe(3);
      expect(failedEmail.last_error).toContain('Persistent SMTP 550');
    });
  });

  describe('Crash Recovery for Stuck Jobs', () => {
    it('should recover jobs stuck in "sending" status due to server crashes', async () => {
      const [contactId] = await db('contacts').insert({
        email: `crash_${Date.now()}@test.com`,
        status: 'active',
      });
      const [campaignId] = await db('campaigns').insert({
        name: 'Crash Campaign',
        status: 'active',
      });
      const [enrollmentId] = await db('enrollments').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        status: 'active',
      });

      // Insert job locked 10 minutes ago
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const [stuckEmailId] = await db('emails').insert({
        enrollment_id: enrollmentId,
        step_number: 1,
        status: 'sending',
        locked_at: tenMinutesAgo,
        idempotency_key: `crash_key_${Date.now()}`,
        subject: 'Stuck Subject',
        body: 'Stuck Body',
      });

      const recoveredCount = await worker.recoverStuckJobs();
      expect(recoveredCount).toBeGreaterThanOrEqual(1);

      const recoveredEmail = await db('emails').where({ id: stuckEmailId }).first();
      expect(recoveredEmail.status).toBe('pending');
      expect(recoveredEmail.locked_at).toBeNull();
      expect(recoveredEmail.last_error).toContain('Recovered from crashed/stuck worker execution');
    });
  });

  describe('Daily Send Limits', () => {
    it('should defer jobs when campaign daily send limit is reached', async () => {
      const [contactId] = await db('contacts').insert({
        email: `limit_${Date.now()}@test.com`,
        status: 'active',
      });
      // Campaign with daily limit of 1
      const [campaignId] = await db('campaigns').insert({
        name: 'Daily Limit Campaign',
        daily_limit: 1,
        status: 'active',
      });
      const [enrollmentId] = await db('enrollments').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        status: 'active',
      });

      // Record 1 email already sent today
      await db('emails').insert({
        enrollment_id: enrollmentId,
        step_number: 1,
        status: 'sent',
        sent_at: new Date().toISOString(),
        idempotency_key: `limit_sent_${Date.now()}`,
      });

      // Try sending a second email
      const [secondEmailId] = await db('emails').insert({
        enrollment_id: enrollmentId,
        step_number: 2,
        status: 'pending',
        idempotency_key: `limit_pending_${Date.now()}`,
      });

      const result = await worker.processEmailJob(secondEmailId);
      expect(result).toBe('limit_deferred');

      const deferredEmail = await db('emails').where({ id: secondEmailId }).first();
      expect(deferredEmail.status).toBe('pending');
      expect(deferredEmail.last_error).toContain('daily send limit');
    });
  });
});
