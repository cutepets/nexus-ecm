import { normalizeLoginIdentifier, normalizeVietnamesePhone } from './login-identifier';

describe('login identifier normalization', () => {
  it.each([
    ['0901234567', '+84901234567'],
    ['+84 901 234 567', '+84901234567'],
    ['84-901-234-567', '+84901234567'],
  ])('normalizes %s as %s', (value, expected) => {
    expect(normalizeVietnamesePhone(value)).toBe(expected);
  });

  it('does not guess malformed phone numbers', () => {
    expect(normalizeVietnamesePhone('090123456')).toBeNull();
    expect(normalizeVietnamesePhone('user0901234567')).toBeNull();
  });

  it('classifies email, phone, and username case-insensitively where appropriate', () => {
    expect(normalizeLoginIdentifier(' Admin@Gmail.Com ')).toEqual({
      kind: 'email',
      value: 'admin@gmail.com',
    });
    expect(normalizeLoginIdentifier('0901234567')).toEqual({
      kind: 'phone',
      value: '+84901234567',
    });
    expect(normalizeLoginIdentifier('Nguyen.Van_A')).toEqual({
      kind: 'username',
      value: 'nguyen.van_a',
    });
  });
});
