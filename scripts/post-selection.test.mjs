import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectPosts,homepagePosts,relatedPosts,previewPages} from './post-selection.mjs';
import {resolvePages,isIndexable} from './site-pages.mjs';

const catalog=JSON.parse(fs.readFileSync('content/posts.json'));
const draft=catalog.find(post=>post.url==='/posts/hunting-idor-web-applications/');
test('IDOR stays unpublished and appears beside CWES only in the review homepage selection',()=>{
 assert(draft.draft);assert.equal(draft.publishedAt,undefined);assert.equal(draft.date,undefined);
 const production=selectPosts(catalog),review=selectPosts(catalog,{includeDrafts:true});
 assert(!production.some(post=>post.url===draft.url));
 assert(review.some(post=>post.url===draft.url&&post.reviewDraft&&post.noindex));
 assert(homepagePosts(review).some(post=>post.url===draft.url));
 assert(homepagePosts(review).some(post=>post.url==='/posts/passing-htb-cwes/'));
 assert(!homepagePosts(production).some(post=>post.url===draft.url));
 for(const post of production)assert.deepEqual(relatedPosts(review,post.url),relatedPosts(production,post.url));
});
test('setup guide is review-only and never changes the blog collection',()=>{
 const configured=JSON.parse(fs.readFileSync('src/pages.json'));
 const production=resolvePages(configured,selectPosts(catalog));
 const review=resolvePages(previewPages(configured,{includeDrafts:true}),selectPosts(catalog,{includeDrafts:true}));
 assert(!production.some(page=>page.route==='/labs/idor/setup'));
 const guide=review.find(page=>page.route==='/labs/idor/setup');assert(guide&&guide.type==='guide'&&guide.noindex);
 assert(!catalog.some(post=>post.url==='/labs/idor/setup/'));
});
test('draft uses the existing route template and becomes a sitemap candidate only on approval',()=>{
 const configured=JSON.parse(fs.readFileSync('src/pages.json'));
 const review=selectPosts(catalog,{includeDrafts:true});
 const page=resolvePages(configured,review).find(page=>page.route==='/posts/hunting-idor-web-applications');
 assert(page);assert.equal(page.type,'article');assert.equal(page.templateSlug,configured.find(page=>page.type==='article').slug);
 assert(!isIndexable(page,review.find(post=>post.url===draft.url)));
 // No date is manufactured: publication validation separately requires the actual approved timestamp.
 assert(isIndexable(page,{...draft,draft:false}));
});
