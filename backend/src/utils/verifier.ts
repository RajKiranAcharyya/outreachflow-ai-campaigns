import { z } from 'zod';

const disposableDomains = new Set([
  'mailinator.com', '10minutemail.com', 'tempmail.com', 'guerrillamail.com', 'sharklasers.com',
  'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'temp-mail.org'
]);

const rolePrefixes = new Set([
  'admin', 'support', 'sales', 'contact', 'info', 'hello', 'team', 'billing', 'office', 'hr'
]);

export function verifyEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'syntax' };
  }

  const [localPart, domain] = email.toLowerCase().split('@');

  if (disposableDomains.has(domain)) {
    return { valid: false, reason: 'disposable' };
  }

  if (rolePrefixes.has(localPart)) {
    return { valid: true, roleBased: true };
  }

  return { valid: true, roleBased: false };
}
