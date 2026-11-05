import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectPosts,homepagePosts,relatedPosts,previewPages} from './post-selection.mjs';
import {resolvePages,isIndexable} from './site-pages.mjs';

const catalog=JSON.parse(fs.readFileSync('content/posts.json'));
const published=catalog.find(post=>post.url==='/posts/hunting-idor-web-applications/');
// Keep testing draft isolation with a fixture after the approved article goes live.
const draft={...published,draft:true};delete draft.publishedAt;delete draft.date;
const draftCatalog=catalog.map(post=>post.url===draft.url?draft:post);
test('unpublished fixtures appear beside CWES only in the review homepage selection',()=>{
 assert(draft.draft);assert.equal(draft.publishedAt,undefined);assert.equal(draft.date,undefined);
 const production=selectPosts(draftCatalog),review=selectPosts(draftCatalog,{includeDrafts:true});
 assert(!production.some(post=>post.url===draft.url));
 assert(review.some(post=>post.url===draft.url&&post.reviewDraft&&post.noindex));
 assert(homepagePosts(review).some(post=>post.url===draft.url));
 assert(homepagePosts(review).some(post=>post.url==='/posts/passing-htb-cwes/'));
 assert(!homepagePosts(production).some(post=>post.url===draft.url));
 for(const post of production)assert.deepEqual(relatedPosts(review,post.url),relatedPosts(production,post.url));
});
test('unpublished guide fixtures are review-only and never change the blog collection',()=>{
 const configured=JSON.parse(fs.readFileSync('src/pages.json')).map(page=>page.type==='guide'?{...page,draft:true}:page);
 const production=resolvePages(configured,selectPosts(draftCatalog));
 const review=resolvePages(previewPages(configured,{includeDrafts:true}),selectPosts(draftCatalog,{includeDrafts:true}));
 assert(!production.some(page=>page.route==='/labs/idor/setup'));
 const guide=review.find(page=>page.route==='/labs/idor/setup');assert(guide&&guide.type==='guide'&&guide.noindex);
 assert(!catalog.some(post=>post.url==='/labs/idor/setup/'));
});
test('draft uses the existing route template and becomes a sitemap candidate only on approval',()=>{
 const configured=JSON.parse(fs.readFileSync('src/pages.json'));
 const review=selectPosts(draftCatalog,{includeDrafts:true});
 const page=resolvePages(configured,review).find(page=>page.route==='/posts/hunting-idor-web-applications');
 assert(page);assert.equal(page.type,'article');assert.equal(page.templateSlug,configured.find(page=>page.type==='article').slug);
 assert(!isIndexable(page,review.find(post=>post.url===draft.url)));
 // No date is manufactured: publication validation separately requires the actual approved timestamp.
 assert(isIndexable(page,{...draft,draft:false}));
});

test('approved IDOR article and setup guide are published, linked and indexable',()=>{
 assert.equal(published.draft,false);assert(published.publishedAt&&new Date(published.publishedAt)<=new Date());
 assert.equal(published.date,published.publishedAt.slice(0,10));
 const posts=selectPosts(catalog),configured=JSON.parse(fs.readFileSync('src/pages.json'));
 const pages=resolvePages(configured,posts);
 assert(homepagePosts(posts).some(post=>post.url===published.url));
 assert(homepagePosts(posts).some(post=>post.url==='/posts/passing-htb-cwes/'));
 const article=pages.find(page=>page.route==='/posts/hunting-idor-web-applications');
 const guide=pages.find(page=>page.route==='/labs/idor/setup');
 assert(article&&guide&&isIndexable(article,published)&&isIndexable(guide));
 assert.equal(guide.date,guide.publishedAt.slice(0,10));
 assert(!catalog.some(post=>post.url==='/labs/idor/setup/'));
});
