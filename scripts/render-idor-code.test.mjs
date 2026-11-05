import test from 'node:test';
import assert from 'node:assert/strict';
import {renderIdorCodeBlocks} from './render-idor-code.mjs';
test('IDOR code presentation labels languages without changing copyable code',()=>{
 const examples=[['powershell','py -3 lab/app.py --port 8000','PowerShell'],['bash','python3 lab/app.py --port 8000','Terminal · bash'],['http','GET /api/invoices/101 HTTP/1.1\nCookie: sid=&lt;alice-session&gt;','HTTP request'],['http','HTTP/1.1 404 Not Found\n\n{&quot;error&quot;:&quot;not_found&quot;}','HTTP response'],['python','invoice = db.execute(\n    "SELECT * FROM invoices WHERE id = ?", (invoice_id,)\n)','Python · lab/app.py']];
 for(const [language,code,label]of examples){
  const input='<pre tabindex="0"><code class="language-'+language+'">'+code+'</code></pre>';
  const html=renderIdorCodeBlocks(input);
  assert(html.includes('>'+label+'</span>'));
  assert.equal(html.match(/<code[^>]*>([\s\S]*?)<\/code>/)[1],code);
  assert(html.includes('aria-hidden="true"'));
  assert(html.includes('data-code-copy="idor-code-1"'));
  assert(html.includes(' hidden>Copy</button>'));
 }
});
