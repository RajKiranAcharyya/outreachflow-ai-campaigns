import { Router, Request, Response } from 'express';
import { db } from '../db/db';

const router = Router();

// GET /api/dashboard/stats - Dashboard summary metrics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const totalContactsResult = await db('contacts').count('* as count').first();
    const activeCampaignsResult = await db('campaigns').where({ status: 'active' }).count('* as count').first();

    const emails = await db('emails').select('status', 'opened_at');

    const sent = emails.filter((e) => e.status === 'sent').length;
    const failed = emails.filter((e) => e.status === 'failed').length;
    const pending = emails.filter((e) => e.status === 'pending').length;
    const opened = emails.filter((e) => e.opened_at !== null).length;

    const openRate = sent > 0 ? `${Math.round((opened / sent) * 100)}%` : '0%';

    res.json({
      totalContacts: Number(totalContactsResult?.count || 0),
      activeCampaigns: Number(activeCampaignsResult?.count || 0),
      sent,
      failed,
      pending,
      opened,
      openRate,
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
