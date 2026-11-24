import { Router, Request, Response } from 'express';
import { db } from '../db/db';
import { verifyEmail } from '../utils/verifier';
import { parseContactsCSV } from '../utils/csvParser';

const router = Router();

// GET /api/contacts - List all contacts
router.get('/', async (req: Request, res: Response) => {
  try {
    const contacts = await db('contacts').select('*').orderBy('id', 'desc');
    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/contacts - Create single contact
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, first_name, last_name, company, role, note } = req.body;
    if (!email) {
      return res.status(400).json({ error: { message: 'Email is required' } });
    }

    const verification = verifyEmail(email);
    if (!verification.valid) {
      return res.status(400).json({ error: { message: `Invalid email: ${verification.reason}` } });
    }

    const [id] = await db('contacts').insert({
      email: email.trim().toLowerCase(),
      first_name,
      last_name,
      company,
      role,
      note,
      status: 'active',
    });

    const contact = await db('contacts').where({ id }).first();
    res.status(201).json(contact);
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: { message: 'Contact with this email already exists' } });
    }
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/contacts/import - Import contacts via CSV (text or body)
router.post('/import', async (req: Request, res: Response) => {
  try {
    const csvContent = typeof req.body === 'string' ? req.body : req.body.csv || req.body.content;
    if (!csvContent) {
      return res.status(400).json({ error: { message: 'CSV content is required in request body' } });
    }

    const { valid, invalid } = parseContactsCSV(csvContent);
    if (valid.length === 0 && invalid.length === 0) {
      return res.status(400).json({ error: { message: 'No contact rows found in CSV' } });
    }

    let importedCount = 0;
    const skippedEmails: string[] = [];

    for (const contact of valid) {
      try {
        await db('contacts').insert(contact);
        importedCount++;
      } catch (err: any) {
        if (err.message && err.message.includes('UNIQUE')) {
          skippedEmails.push(contact.email);
        }
      }
    }

    res.status(200).json({
      success: true,
      imported: importedCount,
      skippedDuplicates: skippedEmails.length,
      invalidRows: invalid.length,
      details: {
        skippedEmails,
        invalid,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: { message: err.message } });
  }
});

// DELETE /api/contacts/:id - Delete single contact
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const deleted = await db('contacts').where({ id }).del();
    if (!deleted) {
      return res.status(404).json({ error: { message: 'Contact not found' } });
    }
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
