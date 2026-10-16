import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertPublicFiles } from './check-public-files.mjs';

const temporaryRoot = fs.realpathSync(os.tmpdir());
const fixtureRoot = fs.mkdtempSync(path.join(temporaryRoot, 'portfolio-public-check-'));
const options = { approvedDocuments: ['/assets/documents/resume.pdf'] };
const fixtures = [
  ['.env', 'EXAMPLE=value'],
  ['.env.production', 'EXAMPLE=value'],
  ['.git/config', 'example'],
  ['.npmrc', 'example'],
  ['private/notes.txt', 'example'],
  ['assets/service-account.json', '{}'],
  ['assets/key.pem', 'example'],
  ['assets/source.js.map', '{}'],
  ['assets/backup.zip', 'example'],
  ['assets/personal.pdf', 'example'],
  ['assets/settings.json', JSON.stringify({ password: 'fixture-value-only' })],
  ['assets/app.js', 'const token="' + 'ghp_' + 'x'.repeat(36) + '";'],
];
try {
  for (const [index, [name, text]] of fixtures.entries()) {
    const root = path.join(fixtureRoot, String(index));
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    assert.throws(() => assertPublicFiles(root, options), /Refusing to publish sensitive files/);
  }
  const valid = path.join(fixtureRoot, 'valid');
  fs.mkdirSync(path.join(valid, 'assets/documents'), { recursive: true });
  fs.writeFileSync(path.join(valid, 'assets/documents/resume.pdf'), 'approved public document');
  fs.writeFileSync(path.join(valid, 'assets/settings.json'), JSON.stringify({ contactEmail: 'owner@example.com' }));
  assert.equal(assertPublicFiles(valid, options), 2);
  console.log('Public-file guard passed 12 rejection cases and the approved-assets case.');
} finally {
  if (path.dirname(fixtureRoot) !== temporaryRoot || !path.basename(fixtureRoot).startsWith('portfolio-public-check-')) throw new Error('Unsafe fixture cleanup path');
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
