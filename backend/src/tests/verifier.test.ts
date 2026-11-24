import { verifyEmail } from '../utils/verifier';

describe('Email Verifier Utility', () => {
  it('should validate standard email addresses', () => {
    const result = verifyEmail('alice@example.com');
    expect(result.valid).toBe(true);
    expect(result.roleBased).toBe(false);
  });

  it('should reject malformed email addresses', () => {
    const result = verifyEmail('invalid-email-format');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('syntax');
  });

  it('should reject disposable/temporary email domains', () => {
    const result = verifyEmail('user@mailinator.com');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('disposable');
  });

  it('should flag role-based addresses (support, admin, info)', () => {
    const result = verifyEmail('support@company.com');
    expect(result.valid).toBe(true);
    expect(result.roleBased).toBe(true);
  });
});
