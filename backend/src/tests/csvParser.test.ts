import { parseContactsCSV, parseCSV } from '../utils/csvParser';

describe('CSV Parser Utility', () => {
  it('should parse standard CSV text into rows', () => {
    const csv = `email,first_name,company\nalice@example.com,Alice,Acme Corp\nbob@example.com,Bob,Beta LLC`;
    const rows = parseCSV(csv);
    expect(rows.length).toBe(3);
    expect(rows[1][0]).toBe('alice@example.com');
  });

  it('should handle quoted strings with commas and escaped quotes', () => {
    const csv = `"email","first_name","company"\n"alice@example.com","Alice, Jr.","Acme, Inc."`;
    const rows = parseCSV(csv);
    expect(rows[1][1]).toBe('Alice, Jr.');
    expect(rows[1][2]).toBe('Acme, Inc.');
  });

  it('should validate and parse contacts from CSV', () => {
    const csv = `email,first_name,last_name,company,role\nvalid@example.com,John,Doe,Google,Tech Lead\ninvalid-email,Jane,Doe,Apple,Manager\nuser@mailinator.com,Fake,User,Temp,Tester`;
    const result = parseContactsCSV(csv);
    expect(result.valid.length).toBe(1);
    expect(result.valid[0].email).toBe('valid@example.com');
    expect(result.valid[0].first_name).toBe('John');
    expect(result.invalid.length).toBe(2);
    expect(result.invalid[0].reason).toContain('syntax');
    expect(result.invalid[1].reason).toContain('disposable');
  });

  it('should throw an error if email header is missing', () => {
    const csv = `name,company,role\nJohn,Google,SWE`;
    expect(() => parseContactsCSV(csv)).toThrow('CSV must contain an "email" column');
  });
});
