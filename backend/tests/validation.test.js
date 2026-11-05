import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnquiry, formatEmailText, allowedOrigins } from '../lib.js';

const good = { name: 'Jane Visitor', email: 'jane@example.com', programme: 'Tabori', topic: 'Poletni tabor', message: 'Prosim za informacije o terminih.' };

test('accept valid enquiry and format text', () => {
  const r = validateEnquiry(good);
  assert.deepEqual(r.value, good);
  assert.match(formatEmailText(r.value), /jane@example.com/);
  assert.match(formatEmailText(r.value), /Poletni tabor/);
});
test('reject missing or fake addresses', () => {
  assert.ok(validateEnquiry({ ...good, email: 'not-an-email' }).error);
  assert.ok(validateEnquiry({ ...good, name: '' }).error);
  assert.ok(validateEnquiry({ ...good, name: 'Visitor\r\nInjected: header' }).error);
  assert.ok(validateEnquiry({ ...good, message: 'Hi' }).error);
});
test('honeypot drops spam', () => {
  assert.equal(validateEnquiry({ ...good, _gotcha: 'https://spam.test' }).spam, true);
});
test('invalid field types and length rejected', () => {
  assert.ok(validateEnquiry({ ...good, name: ['visitor'] }).error);
  assert.ok(validateEnquiry({ ...good, topic: 'a'.repeat(161) }).error);
  assert.ok(validateEnquiry({ ...good, message: 'x'.repeat(5001) }).error);
});
test('allowed CORS origins must be HTTPS exact origins', () => {
  const allowed = allowedOrigins('https://dday2301.github.io,http://insecure.test,https://blackraven.solutions/path,https://blackraven.solutions');
  assert.equal(allowed.has('https://dday2301.github.io'), true);
  assert.equal(allowed.has('https://blackraven.solutions'), true);
  assert.equal(allowed.has('http://insecure.test'), false);
  assert.equal(allowed.has('https://blackraven.solutions/path'), false);
});
