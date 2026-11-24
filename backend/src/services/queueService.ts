import { db } from '../db/db';
import { trackingService } from './trackingService';

export interface EnqueueEmailParams {
  enrollmentId: number;
  campaignId: number;
  contactId: number;
  stepNumber: number;
  delayMinutes: number;
  subjectTemplate: string;
  bodyTemplate: string;
  contact: {
    email: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    role?: string;
  };
  aiOpening?: string;
  baseUrl?: string;
}

export class QueueService {
  /**
   * Deterministic idempotency key ensuring an email for a step can never be sent twice.
   */
  public generateIdempotencyKey(campaignId: number, stepNumber: number, contactId: number): string {
    return `campaign_${campaignId}_step_${stepNumber}_contact_${contactId}`;
  }

  /**
   * Replaces template tags with contact variables and AI opening.
   */
  public renderTemplate(template: string, vars: Record<string, string | undefined>): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      result = result.replace(regex, value || '');
    }
    // Clean up empty double spaces
    return result.replace(/\s{2,}/g, ' ').trim();
  }

  /**
   * Enqueues an email step into the database-backed queue.
   */
  public async enqueueStepEmail(params: EnqueueEmailParams): Promise<{ id: number; idempotencyKey: string; duplicate: boolean }> {
    const {
      enrollmentId,
      campaignId,
      contactId,
      stepNumber,
      delayMinutes,
      subjectTemplate,
      bodyTemplate,
      contact,
      aiOpening,
      baseUrl = process.env.BASE_URL || 'http://localhost:3000',
    } = params;

    const idempotencyKey = this.generateIdempotencyKey(campaignId, stepNumber, contactId);

    // Check if email with this idempotency key already exists
    const existing = await db('emails').where({ idempotency_key: idempotencyKey }).first();
    if (existing) {
      return { id: existing.id, idempotencyKey, duplicate: true };
    }

    const templateVars = {
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      company: contact.company || '',
      role: contact.role || '',
      ai_opening: aiOpening || '',
    };

    const renderedSubject = this.renderTemplate(subjectTemplate, templateVars);
    let renderedBody = this.renderTemplate(bodyTemplate, templateVars);

    // Signed unsubscribe link
    const unsubscribeUrl = trackingService.buildUnsubscribeUrl(baseUrl, enrollmentId, contact.email);
    const unsubscribeFooter = `<br><br><hr style="border:0;border-top:1px solid #eee;margin:20px 0;"><p style="font-size:12px;color:#999;">If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color:#666;">unsubscribe here</a>.</p>`;

    renderedBody += unsubscribeFooter;

    // Delay calculation
    const delayUnit = (process.env.DELAY_UNIT || 'minutes').toLowerCase();
    let delayMs = delayMinutes * 60 * 1000;
    if (delayUnit === 'seconds') {
      delayMs = delayMinutes * 1000;
    }

    const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();

    const [insertedId] = await db('emails').insert({
      enrollment_id: enrollmentId,
      step_number: stepNumber,
      status: 'pending',
      attempts: 0,
      next_attempt_at: nextAttemptAt,
      idempotency_key: idempotencyKey,
      subject: renderedSubject,
      body: renderedBody,
    });

    // Injects 1x1 tracking pixel using insertedId
    const trackingPixelUrl = trackingService.buildOpenTrackingPixelUrl(baseUrl, insertedId);
    const trackingPixelHtml = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
    await db('emails')
      .where({ id: insertedId })
      .update({ body: `${renderedBody}${trackingPixelHtml}` });

    return { id: insertedId, idempotencyKey, duplicate: false };
  }
}

export const queueService = new QueueService();
