import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifySeo} from './verify-seo.mjs';
import {verifyFavicons} from './verify-favicons.mjs';
import {assertPublicFiles} from './check-public-files.mjs';
import {canonicalUrl,routePath} from './site-pages.mjs';

const catalog=JSON.parse(fs.readFileSync('content/posts.json'));
const draft=catalog.find(post=>post.url==='/posts/hunting-idor-web-applications/');
assert(draft,'Missing IDOR article');
const reviewing=draft.draft===true;
const html=fs.readFileSync(path.join('dist',routePath(draft.url),'index.html'),'utf8');
const listing=fs.readFileSync('dist/blog/index.html','utf8');
const home=fs.readFileSync('dist/index.html','utf8');
const thoughts=home.match(/<section class="blog-preview"[\s\S]*?<\/section>/)?.[0];
assert(thoughts&&thoughts.includes(draft.url)&&thoughts.includes('/posts/passing-htb-cwes/'),'Thoughts must contain both IDOR and CWES');
assert.equal(thoughts.includes('Unpublished draft'),reviewing,'Homepage must reflect publication metadata');
assert(html.includes('content="'+(reviewing?'noindex':'index')+',follow"'));
assert.equal(html.replace(/<[^>]*>/g,'').includes('Unpublished draft'),reviewing);
assert(!html.includes('undefined'));
assert.equal(html.includes('article:published_time'),!reviewing);
assert(!html.includes('{{'));
assert.equal([...html.matchAll(/<h1\b/g)].length,1);
const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
assert.equal(schema.headline,draft.title);assert.equal(schema.url,canonicalUrl(draft.url));
assert.equal(schema.datePublished,reviewing?undefined:draft.publishedAt);assert.equal(schema.dateModified,undefined);
if(!reviewing){assert.equal(draft.date,draft.publishedAt.slice(0,10));assert(new Date(draft.publishedAt)<=new Date());}
assert.equal(schema.image,new URL(draft.image,'https://www.m1000z.com').href);
assert.equal(schema.author.name,'Yasin');
assert.equal(draft.difficulty,'Easy lab');
assert.equal(draft.labDownloadUrl,'/assets/documents/hunting-idor-lab.zip');
assert.equal(draft.labSetupUrl,'/labs/idor/setup/');
assert.equal(draft.labLiveUrl,'https://labs.m1000z.com/');
const articleHeader=html.match(/<article aria-labelledby="article-heading">\s*<header>([\s\S]*?)<\/header>/)?.[1];
assert(articleHeader?.includes('class="article-difficulty"')&&articleHeader.includes('Learning difficulty: '));
assert(articleHeader.indexOf('class="article-difficulty"')<articleHeader.indexOf('<h1'),'Difficulty must precede the title');
assert(articleHeader.includes('href="'+draft.labDownloadUrl+'" download>Download lab (.zip)</a>'));
assert(articleHeader.includes('href="'+draft.labSetupUrl+'">Setup guide</a>'));
assert(articleHeader.includes('href="'+draft.labLiveUrl+'" target="_blank" rel="noopener noreferrer"'));
assert(articleHeader.includes('Launch live lab')&&articleHeader.includes('(opens in a new tab)'));
assert(!html.includes('Hosted demo · corrected mode')&&!html.includes('article-live-lab-note'));
assert(articleHeader.indexOf('class="article-header-actions"')>articleHeader.indexOf('class="article-meta"'));
assert(articleHeader.indexOf('class="article-header-actions"')<articleHeader.indexOf('class="article-share"'),'Lab actions must precede the unchanged share control');
assert(html.includes('/assets/article-header.css'));
const body=fs.readFileSync(draft.bodyFile,'utf8');
const resourceCard=html.match(/<aside class="idor-lab-resources"[\s\S]*?<\/aside>/)?.[0];
assert(resourceCard&&resourceCard.includes('Northline Billing')&&resourceCard.replace(/<[^>]*>/g,'').includes('Lab resources'));
assert.equal([...html.matchAll(/class="idor-lab-resources"/g)].length,1,'Use one responsive resources card');
assert(resourceCard.includes('>'+draft.difficulty+'</p>'),'Resources difficulty must come from article metadata');
assert(resourceCard.includes('href="'+draft.labLiveUrl+'" target="_blank" rel="noopener noreferrer"'));
assert(resourceCard.includes('href="'+draft.labDownloadUrl+'" download'));
assert(resourceCard.includes('href="'+draft.labSetupUrl+'"'));
assert(resourceCard.includes('<button class="idor-credentials-trigger" type="button" aria-haspopup="dialog" aria-controls="idor-credentials-dialog"'));
assert(!resourceCard.includes('#demo-credentials'),'Credentials control must stay on the article');
assert.equal([...html.matchAll(/<dialog class="idor-credentials-dialog"/g)].length,1);
for(const value of ['alice@northline.test','AliceDemo!2026','bob@northline.test','BobDemo!2026'])assert(html.includes('>'+value+'</code>'));
for(const page of [home,listing,fs.readFileSync('dist/labs/idor/setup/index.html','utf8'),fs.readFileSync('dist/posts/passing-htb-cwes/index.html','utf8')])assert(!page.includes('class="idor-lab-resources"'),'Resources card is IDOR article only');
const words=body.replace(/<[^>]*>/g,' ').trim().split(/\s+/).length;
assert.equal(schema.wordCount,words);assert(html.replace(/<[^>]*>/g,'').includes(Math.ceil(words/200)+' min read'));
assert(body.includes('deliberately vulnerable local teaching application'));
assert(body.includes('it was not used to produce these captures'));
assert.equal([...body.matchAll(/<table>/g)].length,2);
assert.equal([...body.matchAll(/<pre tabindex="0"/g)].length,12);
assert.equal([...html.matchAll(/class="idor-code-block"/g)].length,12);
assert.equal([...html.matchAll(/data-code-copy=/g)].length,12);
assert(html.includes('Terminal · bash')&&html.includes('HTTP request')&&html.includes('HTTP response')&&html.includes('Python · lab/app.py'));
assert.equal([...body.matchAll(/class="idor-lab-figure"/g)].length,3);
assert(body.indexOf('idor-lab-alice-101-sharp-v3.png')<body.indexOf('Does it ask whether'),'Opening screenshot misplaced');
assert(body.indexOf('idor-lab-alice-102-sharp-v3.png')<body.indexOf('The important evidence is the body'),'Cross-account screenshot misplaced');
assert(body.indexOf('idor-lab-alice-102-denied-sharp-v3.png')<body.indexOf('The same public status and body'),'Denied screenshot misplaced');
assert(body.includes('REVIEW: Supply a genuine Burp Repeater'),'Missing Burp handoff marker');
const labRoot='content/labs/hunting-idor/';
const httpEvidence=JSON.parse(fs.readFileSync(labRoot+'evidence/http-evidence.json'));
const browserEvidence=JSON.parse(fs.readFileSync(labRoot+'evidence/browser-evidence.json'));
const appHash=createHash('sha256').update(fs.readFileSync(labRoot+'lab/app.py')).digest('hex');
assert.equal(httpEvidence.app_sha256,appHash);assert.equal(browserEvidence.app_sha256,appHash);
assert.equal(httpEvidence.checks.length,16);assert(httpEvidence.checks.every(check=>check.passed));
for(const [key,count]of Object.entries({page_checks:16,auth_checks:26,scope_checks:16,asset_checks:6,empty_checks:4})){
 assert.equal(httpEvidence[key].length,count);assert(httpEvidence[key].every(check=>check.passed));
}
for(const [file,hash]of Object.entries(httpEvidence.source_hashes)){
 assert.equal(createHash('sha256').update(fs.readFileSync(labRoot+file)).digest('hex'),hash);
 assert.equal(browserEvidence.source_hashes[file],hash);
}
assert.equal(browserEvidence.burp_used,false);assert.equal(browserEvidence.screenshots.length,4);
assert.equal(browserEvidence.screenshots.filter(shot=>shot.article).length,3);
assert.equal(browserEvidence.responsive_checks.length,20);
assert(browserEvidence.responsive_checks.every(check=>check.scrollWidth<=check.width&&check.identityOutsideInvoice&&check.invoiceWhite),'Invoice responsive layout failed');
for(const exchange of httpEvidence.exchanges.filter(exchange=>exchange.status===200)){
 const invoice=JSON.parse(exchange.body);
 assert.equal(invoice.invoice_number,'INV-'+invoice.id);
 assert.equal(invoice.line_items.reduce((sum,item)=>sum+item.quantity*item.unit_price_cents,0),invoice.total_cents);
 assert.equal(invoice.subtotal_cents,invoice.total_cents);
 assert.equal(invoice.total_cents,invoice.id===101?12500:48000);
 assert(invoice.from.name&&invoice.bill_to.email&&invoice.issue_date&&invoice.due_date&&invoice.payment_status);
}
for(const screenshot of browserEvidence.screenshots.flatMap(capture=>[capture,capture.mobile])){
 const asset=screenshot.file.replace(/^public\//,'');
 const bytes=fs.readFileSync(path.join('dist',asset));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),screenshot.sha256);
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Invoice screenshots must be lossless PNG');
 assert.equal(bytes.readUInt32BE(16),screenshot.width);assert.equal(bytes.readUInt32BE(20),screenshot.height);
 assert.equal(screenshot.device_scale_factor,2);assert.equal(bytes.readUInt32BE(16),screenshot.css_width*2);assert.equal(bytes.readUInt32BE(20),screenshot.css_height*2);
 assert(screenshot.source_url.startsWith('http://127.0.0.1:'));
}
const decode=value=>value.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
for(const [,encoded]of body.matchAll(/<code class="language-http">([\s\S]*?)<\/code>/g)){
 const example=decode(encoded).replaceAll('\r\n','\n');
 if(!example.startsWith('HTTP/'))continue;
 const status=Number(example.split(' ')[1]),payload=example.split('\n\n')[1];
 assert(httpEvidence.exchanges.some(exchange=>exchange.status===status&&exchange.body===payload),'HTTP example no longer matches verified API');
 assert(example.includes('Content-Length: '+Buffer.byteLength(payload)),'HTTP content length differs from actual body');
}
assert(listing.includes('idor-card-shell')&&listing.includes('prefers-reduced-motion: reduce'));
for(const asset of [draft.thumbnail.src,draft.thumbnail.animatedWebp,draft.thumbnail.poster])assert(listing.includes(asset));
assert.equal(fs.readFileSync('dist/sitemap.xml','utf8').includes(draft.url),!reviewing,'Sitemap must reflect publication status');
const mediaHashes={
 'hunting-idor-075x.gif':'5f7799dd68d8d03f7534ace43f1d5b75dfce226d2acb9366a49c9ae840e594bd',
 'hunting-idor-075x.webp':'06c0d68fcee1809081a9eb081ae790e33e933e361ad60a91221b79627008e0ca',
 'hunting-idor-poster.png':'cd9f6d18fa98be0dce19053e2767ac1aa3d221420f73f32e1e2f5d0bfa9e3676',
};
for(const [file,hash]of Object.entries(mediaHashes))assert.equal(createHash('sha256').update(fs.readFileSync('dist/assets/blog/'+file)).digest('hex'),hash);
assert(!listing.includes('idor-motion-toggle')&&!listing.includes('blog-media.js'),'Removed pause control must not remain');
const labArchive=path.join('dist','assets/documents/hunting-idor-lab.zip');
assert(fs.existsSync(labArchive),'Missing static lab archive');
assert(body.includes('<a href="/assets/documents/hunting-idor-lab.zip" download><strong>Download the IDOR lab (.zip)</strong></a>'));
assert(body.indexOf('Download the IDOR lab (.zip)')<body.indexOf('python3 lab/app.py --port 8000'),'Download must precede the first setup command');
assert(body.indexOf('/labs/idor/setup/')<body.indexOf('python3 lab/app.py --port 8000'));
assert(!body.includes('passwordless')&&!body.includes('account buttons'));
const guide=fs.readFileSync('dist/labs/idor/setup/index.html','utf8');
for(const other of [guide,fs.readFileSync('dist/posts/passing-htb-cwes/index.html','utf8')]){
 assert(!other.includes('class="article-difficulty"')&&!other.includes('class="article-header-actions"')&&!other.includes('/assets/article-header.css'),'Optional header UI must not appear without metadata');
}
const guideMetadata=JSON.parse(fs.readFileSync('src/pages.json')).find(page=>page.route==='/labs/idor/setup');
const guideReviewing=guideMetadata.draft===true;
assert(guide.includes('content="'+(guideReviewing?'noindex':'index')+',follow"')&&guide.includes('IDOR Lab Setup: Windows and Linux'));
assert(guide.includes('PowerShell')&&guide.includes('Terminal · bash'));
for(const [id,title] of [['demo-credentials','Demo credentials'],['demo-records','Demo records'],['learning-guide','Learning guide']]){
 const heading=guide.match(new RegExp('<h2\\b[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)<\\/h2>'));
 assert(heading&&heading[1].replace(/<[^>]+>/g,'').trim()===title,'Missing setup section: '+title);
}
assert(!guide.includes('Demo accounts, records and learning guide'));
const guideCommands=[...guide.matchAll(/<code\b[^>]*class="language-powershell"[^>]*>([\s\S]*?)<\/code>/g)].map(match=>decode(match[1])).join('\n');
assert(guideCommands.includes('& $LabPython .\\lab\\app.py --port 8000'));
assert(guideCommands.includes('& $LabPython .\\lab\\app.py --secure --port 8000'));
assert(guideCommands.includes('& $LabPython .\\lab\\verify.py'));
assert(guideCommands.includes('Get-Command python, py -All -ErrorAction SilentlyContinue'));
assert(!guide.includes('python -3')&&guide.includes('python3 lab/app.py --port 8000'));
assert(guide.includes('/assets/documents/hunting-idor-lab.zip')&&guide.includes('/posts/hunting-idor-web-applications/'));
const guideSchema=JSON.parse(guide.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
assert.equal(guideSchema['@type'],'TechArticle');assert.equal(guideSchema.datePublished,guideReviewing?undefined:guideMetadata.publishedAt);
assert.equal(guideSchema.url,'https://www.m1000z.com/labs/idor/setup/');
assert.equal(fs.readFileSync('dist/sitemap.xml','utf8').includes('/labs/idor/setup/'),!guideReviewing);
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(file!==labArchive)assert(!/\.(py|md|zip)$|http-evidence\.json|media-audit\.json/i.test(file),'Unapproved lab or package source leaked into public output: '+file);}}
walk('dist');
for(const [,url]of html.matchAll(/(?:href|src)="(\/[^"\s]*)"/g)){
 const file=path.join('dist',url.split(/[?#]/)[0]);assert(fs.existsSync(file),'Missing article asset or link: '+url);
}
verifySeo();verifyFavicons();
const settings=JSON.parse(fs.readFileSync('content/settings.json'));assertPublicFiles('dist',{approvedDocuments:[settings.cvUrl]});
console.log('IDOR '+(reviewing?'draft preview':'publication')+' verified: publication status, approved 0.75x animation assets, no pause button, recorded dates, metadata, content disclosure, code/tables, links, sitemap and the approved static lab ZIP only. '+words+' words / '+Math.ceil(words/200)+' min.');
