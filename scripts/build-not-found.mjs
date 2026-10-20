import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function buildNotFoundPage({ outputRoot, page, displayName, faviconLinks }) {
 const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const asset=(source,name)=>{
  const bytes=fs.readFileSync(source);
  fs.writeFileSync(path.join(outputRoot,'assets',name),bytes);
  return '/assets/'+name+'?v='+createHash('sha256').update(bytes).digest('hex').slice(0,12);
 };
 const fields={
  pageTitle:escape(page.title),description:escape(page.description),displayName:escape(displayName),faviconLinks,
  stylesheet:asset('src/styles/not-found.css','not-found.css'),
  script:asset('src/not-found.js','not-found.js'),
 };
 let html=fs.readFileSync('src/pages/not-found.html','utf8');
 for(const [key,value]of Object.entries(fields))html=html.replaceAll('{{'+key+'}}',value);
 const directory=path.join(outputRoot,page.route);
 fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'index.html'),html);
 // GitHub Pages serves this document for any URL without a matching file.
 fs.writeFileSync(path.join(outputRoot,'404.html'),html);
}
