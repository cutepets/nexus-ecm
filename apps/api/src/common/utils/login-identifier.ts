export type LoginIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: string }
  | { kind: 'username'; value: string };

/**
 * Converts a Vietnamese phone number to E.164 without guessing invalid input.
 * Accepted forms include 0901234567 and +84901234567.
 */
export function normalizeVietnamesePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;

  const digits = compact.replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) return `+84${digits.slice(1)}`;
  if (/^84\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

/** Classifies the single login field used by the API and web application. */
export function normalizeLoginIdentifier(value: string): LoginIdentifier {
  const identifier = value.trim();
  if (identifier.includes('@')) {
    return { kind: 'email', value: identifier.toLowerCase() };
  }

  const phone = normalizeVietnamesePhone(identifier);
  if (phone) return { kind: 'phone', value: phone };

  return { kind: 'username', value: identifier.toLowerCase() };
}
