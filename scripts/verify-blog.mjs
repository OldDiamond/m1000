import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {canonicalUrl,isPublished,routePath} from './site-pages.mjs';

export function verifyBlog(root='dist'){
 const posts=JSON.parse(fs.readFileSync('content/posts.json')).filter(post=>isPublished(post))
  .sort((a,b)=>new Date(b.publishedAt||b.date)-new Date(a.publishedAt||a.date));
 const listing=fs.readFileSync(path.join(root,'blog/index.html'),'utf8');
 const listingCards=[...listing.matchAll(/<a class="framer-6Ku2B blog-preview-card" href="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(listingCards,posts.map(post=>new URL(canonicalUrl(post.url)).pathname),'Listing order or article routes incorrect');
 const titles=new Set();
 for(const post of posts){
  assert(!titles.has(post.title),'Duplicate article title');titles.add(post.title);
  assert.equal(post.date,post.publishedAt.slice(0,10),'Publication date differs from timestamp');
  const body=fs.readFileSync(post.bodyFile,'utf8');
  const words=body.replace(/<[^>]*>/g,' ').trim().split(/\s+/).length;
  const html=fs.readFileSync(path.join(root,routePath(post.url),'index.html'),'utf8');
  assert.equal([...html.matchAll(/<h1\b/g)].length,1,'Article must have one H1');
  const schema=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1])).find(item=>item['@type']==='BlogPosting');
  assert(schema,'Missing BlogPosting structured data');
  assert.equal(schema.headline,post.title);assert.equal(schema.url,canonicalUrl(post.url));
  assert.equal(schema.datePublished,post.publishedAt);assert.equal(schema.author.name,post.author);
  assert.equal(schema.wordCount,words);assert.equal(schema.image,new URL(post.socialImage||post.image,'https://www.m1000z.com').href);
  assert(html.replace(/<[^>]*>/g,'').includes(Math.ceil(words/200)+' min read'),'Reading time mismatch');
  assert.equal([...html.matchAll(/<a class="framer-6Ku2B blog-preview-card"/g)].length,Math.min(3,posts.length-1),'Related articles incorrect');
  if(post.originalAnalysis){
   assert(words>=900&&words<=1400,post.url+': article outside target length');
   assert(post.subtitle&&post.category&&post.cves?.length,'Missing research metadata');
   for(const cve of post.cves){assert(/^CVE-\d{4}-\d{4,}$/.test(cve));assert(html.includes(cve));}
   assert(!html.includes('Originally published on'),'Original analysis incorrectly attributed to another platform');
   assert(body.includes('<h2>References</h2>'),'Missing reference section');
   assert(new Set([...body.matchAll(/href="(https:[^"]+)"/g)].map(match=>match[1])).size>=3,'Insufficient linked references');
   assert(!/<h1\b/.test(body),'Body must not introduce another H1');
   let level=1;for(const [,heading]of body.matchAll(/<h([2-6])\b/g)){assert(Number(heading)<=level+1,'Skipped heading level');level=Number(heading);}
   const cover=fs.readFileSync(path.join(root,post.image),'utf8');
   assert(cover.startsWith('<svg')&&cover.includes('width="1200" height="630"'),'Invalid original SVG dimensions');
   assert(!/<script\b|<image\b|<foreignObject\b/i.test(cover),'SVG must be self-contained artwork');
   const social=fs.readFileSync(path.join(root,post.socialImage));
   assert.equal(social.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
   assert.equal(social.readUInt32BE(16),1200);assert.equal(social.readUInt32BE(20),630);
  }
 }
 console.log('Verified '+posts.length+' complete posts, publication metadata, reading times, structured data, references, original covers and related links.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)verifyBlog();
