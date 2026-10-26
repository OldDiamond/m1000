import fs from 'node:fs';
import path from 'node:path';
import {canonicalUrl,isIndexable,lastModified,routePath} from './site-pages.mjs';
const xml=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export function buildSitemap({outputRoot,pages,posts}){
 const entries=[];
 for(const page of pages){
  const post=page.type==='article'?posts.find(item=>routePath(item.url)===page.route):null;
  if(!isIndexable(page,post))continue;
  const file=path.join(outputRoot,page.route,'index.html');
  if(!fs.existsSync(file))throw new Error('Sitemap page was not built: '+page.route);
  const head=fs.readFileSync(file,'utf8').split('</head>')[0];
  const metas=[...head.matchAll(/<meta\b[^>]*>/gi)].map(match=>match[0]);
  if(metas.some(tag=>/name="(?:robots|googlebot)"/i.test(tag)&&/content="[^"]*\b(?:noindex|none)\b/i.test(tag)))continue;
  if(metas.some(tag=>/http-equiv="refresh"/i.test(tag)))continue;
  const location=canonicalUrl(page.route);
  const canonical=[...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)];
  if(canonical.length!==1||canonical[0][1]!==location)throw new Error('Invalid self-canonical for sitemap page '+page.route);
  const modified=lastModified(page,post);
  entries.push('  <url><loc>'+xml(location)+'</loc>'+(modified?'<lastmod>'+xml(modified)+'</lastmod>':'')+'</url>');
 }
 fs.writeFileSync(path.join(outputRoot,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+entries.join('\n')+'\n</urlset>\n');
}
