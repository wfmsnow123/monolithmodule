/**
 * Monolith fork: the Fantasy-Calendar hash accepts the bare hash or the full calendar link.
 */

import { describe, expect, it } from 'vitest';
import { looksLikeToken, normalizeHash } from '../../scripts/integrations/fantasy-calendar-sync.mjs';

const HASH = 'eebf9d7a7158b0bc734c8d5420e8e66d';

describe('Monolith Fantasy-Calendar sync: hash', () => {
  it('keeps a bare hash', () => expect(normalizeHash(HASH)).toBe(HASH));
  it('extracts the hash from the calendar link', () => expect(normalizeHash(`https://app.fantasy-calendar.com/calendars/${HASH}`)).toBe(HASH));
  it('extracts the hash from a link with spaces and uppercase', () => expect(normalizeHash(`  app.fantasy-calendar.com/calendars/${HASH.toUpperCase()}/edit `)).toBe(HASH));
  it('empty stays empty (sync off)', () => expect(normalizeHash('   ')).toBe(''));
});

describe('Monolith Fantasy-Calendar sync: token in the calendar field', () => {
  it('recognizes a personal access token', () => expect(looksLikeToken('115|aB3dEf9GhIjKlMnOpQrStUvWxYz0123456789abc')).toBe(true));
  it('a calendar hash is not a token', () => expect(looksLikeToken(HASH)).toBe(false));
  it('a calendar link is not a token', () => expect(looksLikeToken(`https://app.fantasy-calendar.com/calendars/${HASH}`)).toBe(false));
});
