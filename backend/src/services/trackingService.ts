import crypto from 'crypto';
import { db } from '../db/db';

export class TrackingService {
  private secret: string;

  constructor() {
    this.secret = process.env.APP_SECRET || 'super_secret_app_key';
  }

  /**
   * Generates HMAC-SHA256 signature for signed unsubscribe link.
   */
  public generateUnsubscribeSignature(enrollmentId: number, email: string): string {
    const payload = `${enrollmentId}:${email.trim().toLowerCase()}`;
    return crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  /**
   * Verifies the unsubscribe signature.
   */
  public verifyUnsubscribe(enrollmentId: number, email: string, signature: string): boolean {
    if (!enrollmentId || !email || !signature) return false;
    const expected = this.generateUnsubscribeSignature(enrollmentId, email);
    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Builds the full signed unsubscribe URL.
   */
  public buildUnsubscribeUrl(baseUrl: string, enrollmentId: number, email: string): string {
    const sig = this.generateUnsubscribeSignature(enrollmentId, email);
    const cleanBase = baseUrl.replace(/\/+$/, '');
    return `${cleanBase}/api/track/unsubscribe?enrollment_id=${enrollmentId}&email=${encodeURIComponent(email)}&sig=${sig}`;
  }

  /**
   * Builds the 1x1 tracking pixel URL.
   */
  public buildOpenTrackingPixelUrl(baseUrl: string, emailId: number): string {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    return `${cleanBase}/api/track/open/${emailId}`;
  }

  /**
   * Records email open if not previously opened.
   */
  public async recordEmailOpen(emailId: number): Promise<boolean> {
    const email = await db('emails').where({ id: emailId }).first();
    if (!email) return false;

    if (!email.opened_at) {
      await db('emails')
        .where({ id: emailId })
        .update({ opened_at: db.fn.now() });
      return true;
    }
    return false;
  }

  /**
   * Processes signed unsubscribe: marks enrollment and contact as unsubscribed,
   * and cancels pending queued emails for this enrollment.
   */
  public async handleUnsubscribe(
    enrollmentId: number,
    email: string,
    signature: string
  ): Promise<{ success: boolean; message: string }> {
    const isValid = this.verifyUnsubscribe(enrollmentId, email, signature);
    if (!isValid) {
      return { success: false, message: 'Invalid or forged unsubscribe signature' };
    }

    const enrollment = await db('enrollments').where({ id: enrollmentId }).first();
    if (!enrollment) {
      return { success: false, message: 'Enrollment record not found' };
    }

    // Mark enrollment as unsubscribed
    await db('enrollments').where({ id: enrollmentId }).update({ status: 'unsubscribed' });

    // Mark contact as unsubscribed
    await db('contacts').where({ id: enrollment.contact_id }).update({ status: 'unsubscribed' });

    // Cancel any pending emails in the queue for this enrollment
    await db('emails')
      .where({ enrollment_id: enrollmentId, status: 'pending' })
      .update({ status: 'cancelled', last_error: 'Unsubscribed by recipient' });

    return { success: true, message: 'You have been successfully unsubscribed.' };
  }

  /**
   * 1x1 transparent GIF buffer for open tracking.
   */
  public getTrackingPixelBuffer(): Buffer {
    // 1x1 transparent GIF (43 bytes)
    return Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  }
}

export const trackingService = new TrackingService();
