import { verifyEmail } from './verifier';

export interface ParsedContact {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  role?: string;
  note?: string;
  status?: string;
}

export interface CSVParseResult {
  valid: ParsedContact[];
  invalid: { row: number; data: Record<string, string>; reason: string }[];
}

/**
 * Robust CSV parser that handles quotes, commas within quotes, and CRLF/LF line endings.
 */
export function parseCSV(csvText: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n in CRLF
      }
      row.push(current.trim());
      current = '';
      if (row.length > 0 && row.some(col => col.length > 0)) {
        lines.push(row);
      }
      row = [];
    } else {
      current += char;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some(col => col.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

export function parseContactsCSV(csvText: string): CSVParseResult {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    return { valid: [], invalid: [] };
  }

  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const emailIdx = headers.findIndex(h => h === 'email' || h === 'emailaddress');
  const firstNameIdx = headers.findIndex(h => h === 'firstname' || h === 'first_name' || h === 'name');
  const lastNameIdx = headers.findIndex(h => h === 'lastname' || h === 'last_name');
  const companyIdx = headers.findIndex(h => h === 'company' || h === 'companyname' || h === 'organization');
  const roleIdx = headers.findIndex(h => h === 'role' || h === 'jobtitle' || h === 'title');
  const noteIdx = headers.findIndex(h => h === 'note' || h === 'notes');

  if (emailIdx === -1) {
    throw new Error('CSV must contain an "email" column');
  }

  const valid: ParsedContact[] = [];
  const invalid: { row: number; data: Record<string, string>; reason: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const email = row[emailIdx] ? row[emailIdx].trim().toLowerCase() : '';
    const rawData: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rawData[h] = row[idx] || '';
    });

    if (!email) {
      invalid.push({ row: i + 1, data: rawData, reason: 'Missing email' });
      continue;
    }

    const verification = verifyEmail(email);
    if (!verification.valid) {
      invalid.push({ row: i + 1, data: rawData, reason: `Invalid email (${verification.reason})` });
      continue;
    }

    valid.push({
      email,
      first_name: firstNameIdx !== -1 ? row[firstNameIdx] : undefined,
      last_name: lastNameIdx !== -1 ? row[lastNameIdx] : undefined,
      company: companyIdx !== -1 ? row[companyIdx] : undefined,
      role: roleIdx !== -1 ? row[roleIdx] : undefined,
      note: noteIdx !== -1 ? row[noteIdx] : undefined,
      status: 'active',
    });
  }

  return { valid, invalid };
}
