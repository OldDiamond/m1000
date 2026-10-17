import fs from 'node:fs';
import path from 'node:path';
import { assertPublicFiles } from './check-public-files.mjs';
const settings=JSON.parse(fs.readFileSync('content/settings.json'));
assertPublicFiles('dist',{approvedDocuments:[settings.cvUrl || '']});
const pages=JSON.parse(fs.readFileSync('src/pages.json'));
const origin='https://www.m1000z.com';
const routePath=route=>route==='/'?'/':route+'/';
const documents=new Map(pages.map(page=>[routePath(page.route),fs.readFileSync(path.join('dist',page.route,'index.html'),'utf8')]));
let checks=0;
const failures=[];
function check(condition,message){checks++;if(!condition)failures.push(message);}
function reference(value,source,{anchor=false}={}){
 let url;
 try{url=new URL(value.replaceAll('&amp;','&'),origin+routePath(source));}
 catch{check(false,source+': invalid URL '+value);return;}
 if(url.origin!==origin)return;
 let pathname;
 try{pathname=decodeURIComponent(url.pathname);}catch{check(false,source+': invalid path '+value);return;}
 const file=path.join('dist',pathname);
 const stat=fs.statSync(file,{throwIfNoEntry:false});
 const exists=stat?.isFile() || (stat?.isDirectory()&&fs.existsSync(path.join(file,'index.html')));
 check(exists,source+': missing '+value);
 if(!anchor||!exists||!url.hash)return;
 const html=documents.get(pathname.endsWith('/')?pathname:pathname+'/');
 if(!html)return;
 let id;
 try{id=decodeURIComponent(url.hash.slice(1));}catch{check(false,source+': invalid fragment '+value);return;}
 check(html.includes('id="'+id+'"'),source+': missing anchor '+value);
 check(id!=='hero-section',source+': unnecessary hero fragment '+value);
}
const titles=new Set(),descriptions=new Set();
for(const page of pages){
 const html=documents.get(routePath(page.route));
 check(!/<!--(?:COMPONENT|HEADER)|{{\w+}}/.test(html),page.route+': unresolved component');
 for(const [,value]of html.matchAll(/(?:href|src)="(\/[^"\s]*)"/g))reference(value,page.route);
 for(const [,value]of html.matchAll(/<a\b[^>]*href="([^"]*)"/g))reference(value,page.route,{anchor:true});
 for(const [,id]of html.matchAll(/<use[^>]+href="#([^" ]+)"/g))check(html.includes('id="'+id+'"'),page.route+': missing SVG definition '+id);
 check(!/<script[^>]+src="https?:/.test(html),page.route+': third party runtime script');
 const title=html.match(/<title>([^<]+)<\/title>/)?.[1];
 const description=html.match(/<meta name="description" content="([^"]+)"/)?.[1];
 check(title&&title.length>=15&&!titles.has(title),page.route+': missing or duplicate title');titles.add(title);
 check(description&&description.length>=60&&!descriptions.has(description),page.route+': missing or duplicate description');descriptions.add(description);
 const canonicals=[...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
 check(canonicals.length===1&&canonicals[0][1]===origin+routePath(page.route),page.route+': incorrect canonical URL');
 check(!/<meta\b[^>]*(?:name|http-equiv)="(?:robots|googlebot|bingbot|x-robots-tag)"[^>]*content="[^"]*(?:noindex|none)/i.test(html),page.route+': crawl-blocking metadata');
 check(!(title+' '+description).includes(settings.contactEmail),page.route+': contact detail in metadata');
 check(html.includes('class="portfolio-logo" href="/"'),page.route+': incorrect logo URL');
 check(html.includes('class="skip-link"')&&(/<main\b[^>]*id="main-content"/.test(html)||/id="article-section"[^>]*role="main"/.test(html)),page.route+': missing keyboard content target');
 for(const [image]of html.matchAll(/<img\b[^>]*>/g))check(/\balt="[^"]*"/.test(image),page.route+': image without alt attribute');
 check(!/templyo\.io|framer\.link|vintage car|fashion website|Software engineer and Framer creator/i.test(html),page.route+': stale template content');
}
const publicSettings=JSON.parse(fs.readFileSync('dist/assets/settings.json'));
for(const link of publicSettings.navigation)reference(link.href,'/',{anchor:true});
check(documents.get('/').includes('id="hero-section"'),'Homepage hero ID removed');
const sitemap=fs.readFileSync('dist/sitemap.xml','utf8');
check(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')&&sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')&&sitemap.trimEnd().endsWith('</urlset>'),'Invalid sitemap document');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
check(urls.length===pages.length&&new Set(urls).size===pages.length,'Missing or duplicate sitemap entries');
for(const page of pages)check(urls.includes(origin+routePath(page.route)),page.route+': missing canonical sitemap entry');
const robots=fs.readFileSync('dist/robots.txt','utf8');
check(/^User-agent: \*\nAllow: \/\n/m.test(robots)&&!/^Disallow:\s*\//m.test(robots)&&robots.includes('Sitemap: '+origin+'/sitemap.xml'),'Invalid crawl policy');
for(const name of ['interactions','curtain','footer-hands','footer-mark','page-motion','opening-dots']){
 const source=fs.readFileSync('dist/assets/'+name+'.js','utf8');
 for(const [,dependency]of source.matchAll(/from ['"]\.\/([^'"]+)['"]/g))reference('/assets/'+dependency,'/');
}
if(failures.length){console.error([...new Set(failures)].join('\n'));process.exitCode=1;}
else console.log('Verified '+pages.length+' pages and '+checks+' checks: links, anchors, SEO, accessibility, assets, and public-file safety.');
