import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {SITE_ORIGIN,canonicalUrl,isIndexable,resolvePages,routePath,lastModified} from './site-pages.mjs';

export function verifySeo(root='dist'){
 const posts=JSON.parse(fs.readFileSync('content/posts.json'));
 const pages=resolvePages(JSON.parse(fs.readFileSync('src/pages.json')),posts);
 const indexable=pages.filter(page=>isIndexable(page,posts.find(post=>routePath(post.url)===page.route)));
 const expected=indexable.map(page=>canonicalUrl(page.route));
 const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
 assert(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
 assert(sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
 const locations=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
 assert.deepEqual(locations,expected,'Sitemap must contain exactly the published canonical indexable pages');
 assert.equal(new Set(locations).size,locations.length,'Duplicate sitemap URLs');
 const dateValues=indexable.map(page=>lastModified(page,posts.find(post=>routePath(post.url)===page.route))).filter(Boolean);
 assert.deepEqual([...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(match=>match[1]),dateValues,'Sitemap must only use recorded lastModified dates');
 const links=new Map();
 for(const page of indexable){
  const html=fs.readFileSync(path.join(root,page.route,'index.html'),'utf8');
  const head=html.split('</head>')[0];
  const canonicals=[...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)];
  assert.equal(canonicals.length,1,page.route+': missing or duplicate canonical');
  assert.equal(canonicals[0][1],canonicalUrl(page.route),page.route+': incorrect canonical');
  assert(!/<meta\b[^>]*name="(?:robots|googlebot)"[^>]*content="[^"]*\b(?:noindex|nofollow|none)\b/i.test(head),page.route+': indexing blocked');
  assert(!/<meta\b[^>]*http-equiv="refresh"/i.test(head),page.route+': redirect in sitemap');
  const anchors=[...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].filter(match=>!match[0].includes('rel="nofollow"')).map(match=>new URL(match[1].replaceAll('&amp;','&'),canonicalUrl(page.route))).filter(url=>url.origin===SITE_ORIGIN).map(url=>canonicalUrl(url.pathname));
  links.set(canonicalUrl(page.route),anchors);
  const menu=html.match(/<div class="portfolio-menu-links">([\s\S]*?)<\/div>/)?.[1];
  assert(menu,page.route+': no static navigation');
  assert.equal([...menu.matchAll(/<a\b/g)].length,5,page.route+': incorrect static navigation count');
 }
 const reachable=new Set([canonicalUrl('/')]);const queue=[canonicalUrl('/')];
 while(queue.length){for(const next of links.get(queue.shift())||[]){if(!reachable.has(next)){reachable.add(next);queue.push(next);}}}
 for(const location of expected)assert(reachable.has(location),'Page is not linked from homepage HTML: '+location);
 const robots=fs.readFileSync(path.join(root,'robots.txt'),'utf8');
 assert.match(robots,/User-agent: \*\s+Allow: \//);
 assert(!/^\s*Disallow:\s*\S/im.test(robots));
 assert.equal([...robots.matchAll(/^Sitemap: (.+)$/gm)].length,1);
 assert(robots.includes('Sitemap: '+SITE_ORIGIN+'/sitemap.xml'));
 assert.equal(fs.readFileSync('CNAME','utf8').trim(),new URL(SITE_ORIGIN).hostname);
 console.log('Verified '+locations.length+' sitemap URLs, self-canonicals, crawl directives, recorded dates, and HTML-only internal discovery.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)verifySeo();
