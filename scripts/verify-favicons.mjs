import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolvePages } from './site-pages.mjs';

export function verifyFavicons(root='dist') {
 const pngSize=bytes=>{
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Invalid PNG signature');
  return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
 };
 for(const [name,size]of [['favicon-32x32.png',32],['favicon-96x96.png',96],['apple-touch-icon.png',180]]){
  assert.deepEqual(pngSize(fs.readFileSync(path.join(root,name))),[size,size],name+': incorrect dimensions');
 }
 const ico=fs.readFileSync(path.join(root,'favicon.ico'));
 assert.equal(ico.readUInt16LE(0),0);assert.equal(ico.readUInt16LE(2),1);
 assert.equal(ico.readUInt16LE(4),4);
 for(const [index,size]of [16,32,48,96].entries()){
  const entry=6+index*16;
  assert.equal(ico[entry],size);assert.equal(ico[entry+1],size);
  const length=ico.readUInt32LE(entry+8),offset=ico.readUInt32LE(entry+12);
  assert(offset>=70&&offset+length<=ico.length,'Invalid ICO frame bounds');
  assert.deepEqual(pngSize(ico.subarray(offset,offset+length)),[size,size]);
 }
 const pages=resolvePages(JSON.parse(fs.readFileSync('src/pages.json')),JSON.parse(fs.readFileSync('content/posts.json')));
 for(const page of pages){
  const html=fs.readFileSync(path.join(root,page.route,'index.html'),'utf8');
  const icons=[...html.matchAll(/<link\b[^>]*>/g)].map(match=>match[0]).filter(tag=>/\brel="(?:icon|shortcut icon|apple-touch-icon)"/.test(tag));
  assert.equal(icons.length,4,page.route+': duplicate or missing favicon declarations');
  for(const [rel,type,sizes,href]of [
   ['icon','image/x-icon','16x16 32x32 48x48 96x96','/favicon.ico'],
   ['icon','image/png','32x32','/favicon-32x32.png'],
   ['icon','image/png','96x96','/favicon-96x96.png'],
   ['apple-touch-icon','image/png','180x180','/apple-touch-icon.png'],
  ])assert.equal(icons.filter(tag=>tag.includes(`rel="${rel}"`)&&tag.includes(`type="${type}"`)&&tag.includes(`sizes="${sizes}"`)&&tag.includes(`href="${href}"`)).length,1,page.route+': invalid '+href+' declaration');
 }
 const robots=fs.readFileSync(path.join(root,'robots.txt'),'utf8');
 assert.match(robots,/User-agent: \*/);assert.match(robots,/Allow: \//);
 assert(!/^\s*Disallow:\s*\S/im.test(robots),'Favicon or homepage could be blocked by robots.txt');
 assert.match(robots,/Sitemap: https:\/\/www\.m1000z\.com\/sitemap\.xml/);
 console.log('Verified favicon dimensions, all ICO frames, stable unique declarations on '+pages.length+' pages, and crawl access.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)verifyFavicons();
