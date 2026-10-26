import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {canonicalUrl,isPublished,isIndexable,lastModified,resolvePages} from './site-pages.mjs';
import {buildSitemap} from './build-sitemap.mjs';

const now=new Date('2026-10-26T12:00:00Z');
const template={route:'/posts/existing',slug:'article-template',type:'article',contentKey:'blog',components:['PostArticle']};
test('published routes are normalized and new articles inherit the article template',()=>{
 const pages=resolvePages([{route:'/',slug:'home'},template,{route:'/about',slug:'about'},{route:'/about/',slug:'duplicate'},{route:'/draft',published:false},{route:'/old',redirect:'/about'}],
  [{url:'/posts/existing/'},{url:'/posts/new/',title:'New post',excerpt:'Description'},{url:'/posts/draft/',draft:true},{url:'/posts/future/',publishedAt:'2099-01-01T00:00:00Z'}],now);
 assert.deepEqual(pages.map(page=>page.route),['/','/posts/existing','/about','/posts/new']);
 const article=pages.at(-1);
 assert.equal(article.templateSlug,'article-template');assert.equal(article.contentKey,'blog');
 assert.equal(canonicalUrl('/about'),'https://www.m1000z.com/about/');
 assert.throws(()=>canonicalUrl('https://example.com/about/'));
 assert.throws(()=>canonicalUrl('/about?duplicate=1'));
});
test('unpublished articles are not re-created from their template',()=>{
 assert.deepEqual(resolvePages([{...template,published:false}],[{url:template.route}],now),[]);
 assert.deepEqual(resolvePages([template],[{url:template.route,status:'draft'}],now),[]);
 assert.equal(isPublished({publishedAt:'2099-01-01T00:00:00Z'},now),false);
 assert.throws(()=>isPublished({publishedAt:'not a date'},now));
});
test('errors, noindex pages, redirects and canonical aliases are not sitemap candidates',()=>{
 for(const item of [{type:'error'},{noindex:true},{redirect:'/'},{canonical:'/about'}])assert.equal(isIndexable({route:'/other',...item}),false);
 assert.equal(isIndexable({route:'/about'},{noindex:true}),false);
 assert.equal(isIndexable({route:'/about',canonical:'/about/'}),true);
});
test('lastmod uses only recorded significant-update dates, never publication/build times',()=>{
 assert.equal(lastModified({route:'/'},{publishedAt:'2026-10-19T19:57:14Z'}),null);
 assert.equal(lastModified({route:'/',lastModified:'2026-10-19'}), '2026-10-19');
 assert.equal(lastModified({route:'/'},{lastModified:'2026-10-19T19:57:14Z'}),'2026-10-19T19:57:14Z');
 for(const date of ['today','2026-02-30','2099-01-01'])assert.throws(()=>lastModified({route:'/',lastModified:date}));
});
test('sitemap only contains built, canonical, indexable HTML documents',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'m1000-seo-test-'));
 assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
 assert(path.basename(root).startsWith('m1000-seo-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const pages=[{route:'/',lastModified:'2026-10-19'},{route:'/about'},{route:'/404',type:'error'},{route:'/hidden'},{route:'/refresh'}];
 for(const page of pages){
  const dir=path.join(root,page.route);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),'<head><link rel="canonical" href="'+canonicalUrl(page.route)+'">'+(page.route==='/hidden'?'<meta name="robots" content="noindex,follow">':page.route==='/refresh'?'<meta http-equiv="refresh" content="0;url=/">':'')+'</head>');
 }
 buildSitemap({outputRoot:root,pages,posts:[]});
 const xml=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
 assert.equal([...xml.matchAll(/<loc>/g)].length,2);
 assert(xml.includes('<loc>https://www.m1000z.com/about/</loc>'));
 assert(xml.includes('<lastmod>2026-10-19</lastmod>'));
 for(const excluded of ['/404/','/hidden/','/refresh/'])assert(!xml.includes(excluded));
 assert.throws(()=>buildSitemap({outputRoot:root,pages:[{route:'/nonexistent'}],posts:[]}),/not built/);
 fs.writeFileSync(path.join(root,'about/index.html'),'<head><link rel="canonical" href="https://www.m1000z.com/"></head>');
 assert.throws(()=>buildSitemap({outputRoot:root,pages:[{route:'/about'}],posts:[]}),/self-canonical/);
});
