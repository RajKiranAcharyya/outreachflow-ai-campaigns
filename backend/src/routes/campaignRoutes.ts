import { Router, Request, Response } from 'express';
import { db } from '../db/db';
import { geminiService } from '../services/geminiService';
import { queueService } from '../services/queueService';

const router = Router();

// GET /api/campaigns - List campaigns with metrics
router.get('/', async (req: Request, res: Response) => {
  try {
    const campaigns = await db('campaigns').select('*').orderBy('id', 'desc');

    const result = await Promise.all(
      campaigns.map(async (c) => {
        const stepsCount = await db('campaign_steps').where({ campaign_id: c.id }).count('* as count').first();
        const enrollmentsCount = await db('enrollments').where({ campaign_id: c.id }).count('* as count').first();
        return {
          ...c,
          steps_count: Number(stepsCount?.count || 0),
          enrollments_count: Number(enrollmentsCount?.count || 0),
        };
      })
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/campaigns - Create campaign with steps
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, daily_limit = 50, steps = [] } = req.body;
    if (!name) {
      return res.status(400).json({ error: { message: 'Campaign name is required' } });
    }

    const [campaignId] = await db('campaigns').insert({
      name,
      daily_limit,
      status: 'active',
    });

    if (steps.length > 0) {
      const formattedSteps = steps.map((s: any, idx: number) => ({
        campaign_id: campaignId,
        step_number: s.step_number || idx + 1,
        delay_minutes: s.delay_minutes ?? 0,
        subject_template: s.subject_template || 'Quick follow up',
        body_template: s.body_template || 'Hi {{first_name}}, {{ai_opening}}',
      }));

      await db('campaign_steps').insert(formattedSteps);
    } else {
      // Create default step 1
      await db('campaign_steps').insert({
        campaign_id: campaignId,
        step_number: 1,
        delay_minutes: 0,
        subject_template: 'Quick question about {{company}}',
        body_template: 'Hi {{first_name}}, {{ai_opening}}',
      });
    }

    const campaign = await db('campaigns').where({ id: campaignId }).first();
    const createdSteps = await db('campaign_steps').where({ campaign_id: campaignId }).orderBy('step_number', 'asc');

    res.status(201).json({ ...campaign, steps: createdSteps });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/campaigns/:id - Get campaign details with steps and enrollments
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const campaign = await db('campaigns').where({ id }).first();
    if (!campaign) {
      return res.status(404).json({ error: { message: 'Campaign not found' } });
    }

    const steps = await db('campaign_steps').where({ campaign_id: id }).orderBy('step_number', 'asc');
    const enrollments = await db('enrollments')
      .join('contacts', 'enrollments.contact_id', 'contacts.id')
      .where('enrollments.campaign_id', id)
      .select('enrollments.*', 'contacts.email', 'contacts.first_name', 'contacts.last_name', 'contacts.company');

    const emailStats = await db('emails')
      .join('enrollments', 'emails.enrollment_id', 'enrollments.id')
      .where('enrollments.campaign_id', id)
      .select('emails.status', 'emails.opened_at');

    const sentCount = emailStats.filter((e) => e.status === 'sent').length;
    const failedCount = emailStats.filter((e) => e.status === 'failed').length;
    const pendingCount = emailStats.filter((e) => e.status === 'pending').length;
    const openedCount = emailStats.filter((e) => e.opened_at !== null).length;

    res.json({
      ...campaign,
      steps,
      enrollments,
      stats: {
        sent: sentCount,
        failed: failedCount,
        pending: pendingCount,
        opened: openedCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// PATCH /api/campaigns/:id - Update campaign
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, status, daily_limit } = req.body;

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    if (daily_limit !== undefined) updates.daily_limit = daily_limit;

    await db('campaigns').where({ id }).update(updates);
    const updated = await db('campaigns').where({ id }).first();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/campaigns/:id/enroll - Enroll contacts into campaign
router.post('/:id/enroll', async (req: Request, res: Response) => {
  try {
    const campaignId = Number(req.params.id);
    const campaign = await db('campaigns').where({ id: campaignId }).first();
    if (!campaign) {
      return res.status(404).json({ error: { message: 'Campaign not found' } });
    }

    const { contact_ids } = req.body;
    let contactsToEnroll;

    if (Array.isArray(contact_ids) && contact_ids.length > 0) {
      contactsToEnroll = await db('contacts')
        .whereIn('id', contact_ids)
        .where('status', 'active');
    } else {
      // Enroll all active contacts by default
      contactsToEnroll = await db('contacts').where('status', 'active');
    }

    const step1 = await db('campaign_steps')
      .where({ campaign_id: campaignId, step_number: 1 })
      .first();

    if (!step1) {
      return res.status(400).json({ error: { message: 'Campaign has no steps defined' } });
    }

    let enrolledCount = 0;
    const enrolledDetails = [];

    for (const contact of contactsToEnroll) {
      // Check if already enrolled
      const existing = await db('enrollments')
        .where({ campaign_id: campaignId, contact_id: contact.id })
        .first();

      if (existing) continue;

      // Generate AI personalized opening line
      const aiOpening = await geminiService.generatePersonalizedOpening(contact);

      const [enrollmentId] = await db('enrollments').insert({
        campaign_id: campaignId,
        contact_id: contact.id,
        status: 'active',
        current_step: 1,
        ai_opening: aiOpening,
      });

      // Enqueue Step 1 Email
      await queueService.enqueueStepEmail({
        enrollmentId,
        campaignId,
        contactId: contact.id,
        stepNumber: 1,
        delayMinutes: step1.delay_minutes || 0,
        subjectTemplate: step1.subject_template,
        bodyTemplate: step1.body_template,
        contact,
        aiOpening,
      });

      enrolledCount++;
      enrolledDetails.push({
        enrollmentId,
        contactId: contact.id,
        email: contact.email,
        aiOpening,
      });
    }

    res.json({
      success: true,
      enrolledCount,
      details: enrolledDetails,
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
