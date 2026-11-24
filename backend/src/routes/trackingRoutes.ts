import { Router, Request, Response } from 'express';
import { trackingService } from '../services/trackingService';

const router = Router();

// GET /api/track/open/:emailId - 1x1 transparent tracking GIF
router.get('/open/:emailId', async (req: Request, res: Response) => {
  try {
    const emailId = Number(req.params.emailId);
    if (!isNaN(emailId)) {
      await trackingService.recordEmailOpen(emailId);
    }
  } catch {
    // Non-blocking for tracking pixel
  }

  const pixel = trackingService.getTrackingPixelBuffer();
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(pixel);
});

// GET /api/track/unsubscribe - Signed unsubscribe endpoint
router.get('/unsubscribe', async (req: Request, res: Response) => {
  const enrollmentId = Number(req.query.enrollment_id);
  const email = String(req.query.email || '');
  const signature = String(req.query.sig || '');

  const result = await trackingService.handleUnsubscribe(enrollmentId, email, signature);

  if (req.headers.accept?.includes('application/json')) {
    return res.status(result.success ? 200 : 400).json(result);
  }

  if (result.success) {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Unsubscribed - OutreachFlow</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f9fafb; color: #111827; }
            .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 480px; text-align: center; }
            h1 { font-size: 22px; color: #111827; margin-bottom: 8px; }
            p { color: #6b7280; font-size: 15px; line-height: 1.5; }
            .badge { display: inline-block; background-color: #ecfdf5; color: #059669; font-weight: 600; padding: 6px 14px; border-radius: 20px; font-size: 13px; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">Unsubscribed</div>
            <h1>You have been unsubscribed</h1>
            <p>You will no longer receive emails from this campaign sequence for <strong>${email}</strong>.</p>
          </div>
        </body>
      </html>
    `);
  } else {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Error - OutreachFlow</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f9fafb; color: #111827; }
            .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 480px; text-align: center; }
            h1 { font-size: 22px; color: #dc2626; margin-bottom: 8px; }
            p { color: #6b7280; font-size: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Invalid Unsubscribe Link</h1>
            <p>${result.message}</p>
          </div>
        </body>
      </html>
    `);
  }
});

export default router;
