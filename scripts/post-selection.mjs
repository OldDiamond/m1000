import {isPublished} from './site-pages.mjs';

// Draft inclusion is an explicit local build option, never a deployment default.
export function selectPosts(posts, {includeDrafts = false} = {}) {
 return posts.filter(post => isPublished(post) || (includeDrafts && post.draft === true))
  .map(post => post.draft ? {...post, draft: false, reviewDraft: true, noindex: true} : post)
  .sort((a,b) => Number(Boolean(b.reviewDraft)) - Number(Boolean(a.reviewDraft))
   || new Date(b.publishedAt || b.date) - new Date(a.publishedAt || a.date));
}
export const homepagePosts = posts => posts.filter(post => post.homepage !== false).slice(0,3);
export const relatedPosts = (posts, url) => posts.filter(post => post.url !== url && post.related !== false).slice(0,3);
export function previewPages(pages, {includeDrafts = false} = {}) {
 return pages.map(page=>includeDrafts&&page.draft?{...page,draft:false,reviewDraft:true,noindex:true}:page);
}
