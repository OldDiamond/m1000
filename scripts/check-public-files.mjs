import fs from 'node:fs';
import path from 'node:path';

const privateName = /(?:^|[-_.])(?:credentials?|secrets?|private[-_]?keys?|service[-_]?account)(?:[-_.]|$)/i;
const privateExtension = /\.(?:pem|key|p12|pfx|keystore|sql|sqlite3?|db|bak|backup|map|zip|gz|7z|tar)$/i;
const documentExtension = /\.(?:pdf|docx?|xlsx?|csv)$/i;
const textExtension = /\.(?:html|css|js|json|txt|svg|xml|ya?ml|toml|ini|conf)$/i;
const secretPatterns = [
  /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,})\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
];

// Inspect deployable files only. Never print matched credential values.
export function assertPublicFiles(root, { approvedDocuments = [] } = {}) {
  const approved = new Set(approvedDocuments.map(file => file.replace(/^\//, '')));
  const failures = [];
  let count = 0;
  function walk(directory, relative = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      const name = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) { failures.push(name + ': symbolic links are not public assets'); continue; }
      if (entry.name.startsWith('.') || privateName.test(entry.name) || /^(?:private|backups?|node_modules|id_rsa|id_ed25519)$/i.test(entry.name) || privateExtension.test(entry.name)) {
        failures.push(name + ': private or unsupported public file'); continue;
      }
      if (entry.isDirectory()) { walk(file, name); continue; }
      if (!entry.isFile()) { failures.push(name + ': unsupported file type'); continue; }
      count++;
      if (documentExtension.test(name) && !approved.has(name)) failures.push(name + ': document has not been approved for public download');
      if (!textExtension.test(name)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (secretPatterns.some(pattern => pattern.test(text))) failures.push(name + ': possible credential in public content');
      const assignments = text.matchAll(/["']?\b(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|private[_-]?key)["']?\s*[:=]\s*["']([^"'\r\n]{8,})["']/gi);
      for (const [, value] of assignments) {
        if (!/example|placeholder|changeme|your[_ -]|\$\{|^<|^\*+$|^process\./i.test(value)) {
          failures.push(name + ': possible credential assignment in public content'); break;
        }
      }
    }
  }
  if (fs.lstatSync(root, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Refusing to publish sensitive files: public root must not be a symbolic link');
  if (fs.existsSync(root)) walk(root);
  if (failures.length) throw new Error('Refusing to publish sensitive files:\n' + failures.join('\n'));
  return count;
}
