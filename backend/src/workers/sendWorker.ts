import { db } from '../db/db';
import { emailSender } from '../services/emailSender';
import { queueService } from '../services/queueService';

export interface WorkerOptions {
  maxAttempts?: number;
  baseBackoffSeconds?: number;
  stuckTimeoutMs?: number;
  batchSize?: number;
}

export class SendWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private maxAttempts: number;
  private baseBackoffSeconds: number;
  private stuckTimeoutMs: number;
  private batchSize: number;

  constructor(options?: WorkerOptions) {
    this.maxAttempts = options?.maxAttempts ?? 3;
    this.baseBackoffSeconds = options?.baseBackoffSeconds ?? 60; // 1m, 2m, 4m
    this.stuckTimeoutMs = options?.stuckTimeoutMs ?? 5 * 60 * 1000; // 5 minutes
    this.batchSize = options?.batchSize ?? 10;
  }

  /**
   * Crash recovery for stuck jobs:
   * Recovers jobs that were marked 'sending' but never completed due to a worker crash or restart.
   */
  public async recoverStuckJobs(): Promise<number> {
    const cutoff = new Date(Date.now() - this.stuckTimeoutMs).toISOString();

    const stuckJobs = await db('emails')
      .where('status', 'sending')
      .andWhere((builder) => {
        builder.where('locked_at', '<', cutoff).orWhereNull('locked_at');
      });

    if (stuckJobs.length > 0) {
      const ids = stuckJobs.map((j) => j.id);
      await db('emails')
        .whereIn('id', ids)
        .update({
          status: 'pending',
          locked_at: null,
          last_error: 'Recovered from crashed/stuck worker execution',
        });
    }

    return stuckJobs.length;
  }

  /**
   * Counts how many emails have been sent today for a given campaign to enforce daily limits.
   */
  public async getSentTodayCount(campaignId: number): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await db('emails')
      .join('enrollments', 'emails.enrollment_id', 'enrollments.id')
      .where('enrollments.campaign_id', campaignId)
      .where('emails.status', 'sent')
      .where('emails.sent_at', '>=', startOfDay.toISOString())
      .count('* as count')
      .first();

    return result ? Number(result.count) : 0;
  }

  /**
   * Processes a single email job.
   */
  public async processEmailJob(emailId: number): Promise<'sent' | 'retrying' | 'failed' | 'cancelled' | 'limit_deferred'> {
    // Lock the email record
    const email = await db('emails')
      .join('enrollments', 'emails.enrollment_id', 'enrollments.id')
      .join('contacts', 'enrollments.contact_id', 'contacts.id')
      .join('campaigns', 'enrollments.campaign_id', 'campaigns.id')
      .where('emails.id', emailId)
      .select(
        'emails.*',
        'enrollments.campaign_id',
        'enrollments.contact_id',
        'enrollments.status as enrollment_status',
        'enrollments.ai_opening',
        'contacts.email as recipient_email',
        'contacts.first_name',
        'contacts.last_name',
        'contacts.company',
        'contacts.role',
        'contacts.status as contact_status',
        'campaigns.daily_limit',
        'campaigns.status as campaign_status'
      )
      .first();

    if (!email) return 'failed';

    // Check if recipient has unsubscribed or campaign is paused
    if (email.enrollment_status === 'unsubscribed' || email.contact_status === 'unsubscribed') {
      await db('emails').where({ id: emailId }).update({
        status: 'cancelled',
        last_error: 'Recipient is unsubscribed',
        locked_at: null,
      });
      return 'cancelled';
    }

    // Check campaign daily limit
    if (email.daily_limit && email.daily_limit > 0) {
      const sentToday = await this.getSentTodayCount(email.campaign_id);
      if (sentToday >= email.daily_limit) {
        // Postpone next attempt to start of next day (or +1 hour)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 5, 0, 0);

        await db('emails').where({ id: emailId }).update({
          status: 'pending',
          locked_at: null,
          next_attempt_at: tomorrow.toISOString(),
          last_error: `Campaign daily send limit (${email.daily_limit}) reached for today`,
        });
        return 'limit_deferred';
      }
    }

    // Mark as sending with lock timestamp
    await db('emails').where({ id: emailId }).update({
      status: 'sending',
      locked_at: db.fn.now(),
    });

    try {
      // Dispatch via sandbox nodemailer SMTP
      await emailSender.sendSandboxEmail({
        to: email.recipient_email,
        subject: email.subject,
        html: email.body,
      });

      // Mark as sent
      await db('emails').where({ id: emailId }).update({
        status: 'sent',
        sent_at: db.fn.now(),
        locked_at: null,
        last_error: null,
      });

      // Progress sequence to next step if exists
      const nextStepNumber = email.step_number + 1;
      const nextStep = await db('campaign_steps')
        .where({ campaign_id: email.campaign_id, step_number: nextStepNumber })
        .first();

      if (nextStep) {
        await queueService.enqueueStepEmail({
          enrollmentId: email.enrollment_id,
          campaignId: email.campaign_id,
          contactId: email.contact_id,
          stepNumber: nextStepNumber,
          delayMinutes: nextStep.delay_minutes || 0,
          subjectTemplate: nextStep.subject_template,
          bodyTemplate: nextStep.body_template,
          contact: {
            email: email.recipient_email,
            first_name: email.first_name,
            last_name: email.last_name,
            company: email.company,
            role: email.role,
          },
          aiOpening: email.ai_opening,
        });

        await db('enrollments')
          .where({ id: email.enrollment_id })
          .update({ current_step: nextStepNumber });
      } else {
        await db('enrollments')
          .where({ id: email.enrollment_id })
          .update({ status: 'completed' });
      }

      return 'sent';
    } catch (err: any) {
      const attempts = (email.attempts || 0) + 1;
      const errorMessage = err?.message || 'Unknown send failure';

      if (attempts < this.maxAttempts) {
        // Exponential backoff retry: baseBackoffSeconds * 2^(attempts - 1)
        const backoffSeconds = this.baseBackoffSeconds * Math.pow(2, attempts - 1);
        const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

        await db('emails').where({ id: emailId }).update({
          status: 'pending',
          attempts,
          next_attempt_at: nextAttemptAt,
          locked_at: null,
          last_error: errorMessage,
        });

        return 'retrying';
      } else {
        // Max attempts reached -> Mark as failed
        await db('emails').where({ id: emailId }).update({
          status: 'failed',
          attempts,
          locked_at: null,
          last_error: errorMessage,
        });

        return 'failed';
      }
    }
  }

  /**
   * Processes a batch of due emails.
   */
  public async processBatch(): Promise<number> {
    // 1. Recover any stuck jobs from previous crashes
    await this.recoverStuckJobs();

    // 2. Fetch pending emails that are due (next_attempt_at <= now or null)
    const now = new Date().toISOString();
    const dueEmails = await db('emails')
      .where('status', 'pending')
      .andWhere((builder) => {
        builder.where('next_attempt_at', '<=', now).orWhereNull('next_attempt_at');
      })
      .orderBy('id', 'asc')
      .limit(this.batchSize);

    let processedCount = 0;
    for (const email of dueEmails) {
      await this.processEmailJob(email.id);
      processedCount++;
    }

    return processedCount;
  }

  /**
   * Starts the worker background loop.
   */
  public start(intervalMs = 5000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const loop = async () => {
      try {
        await this.processBatch();
      } catch (err) {
        console.error('SendWorker batch error:', err);
      }

      if (this.isRunning) {
        this.timer = setTimeout(loop, intervalMs);
      }
    };

    loop();
  }

  /**
   * Stops the worker background loop.
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const sendWorker = new SendWorker();
