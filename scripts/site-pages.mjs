// One route catalog for the static build, canonical URLs, and generated sitemap.
export const SITE_ORIGIN='https://www.m1000z.com';
export function routePath(value){
 const url=new URL(value,SITE_ORIGIN);
 if(url.origin!==SITE_ORIGIN||url.search||url.hash)throw new Error('Invalid local page route: '+value);
 return url.pathname.replace(/\/+$/,'')||'/';
}
export const canonicalUrl=value=>SITE_ORIGIN+(routePath(value)==='/'?'/':routePath(value)+'/');
export function isPublished(item,now=new Date()){
 if(item.published===false||item.draft===true||(item.status&&item.status!=='published'))return false;
 if(item.publishedAt){
  const date=new Date(item.publishedAt);
  if(!Number.isFinite(date.getTime()))throw new Error('Invalid publication date');
  if(date>now)return false;
 }
 return true;
}
export function resolvePages(configured,posts,now=new Date()){
 const published=posts.filter(post=>isPublished(post,now));
 const template=configured.find(page=>page.type==='article');
 const result=new Map();
 for(const page of configured){
  if(!isPublished(page,now)||page.redirect)continue;
  const route=routePath(page.route);
  if(page.type==='article'&&!published.some(post=>routePath(post.url)===route))continue;
  if(!result.has(route))result.set(route,{...page,route});
 }
 for(const post of published){
  const route=routePath(post.url);
  if(result.has(route))continue;
  const configuredPage=configured.find(page=>routePath(page.route)===route);
  if(configuredPage&&(!isPublished(configuredPage,now)||configuredPage.redirect))continue;
  if(!template)throw new Error('Published article requires an article template: '+route);
  result.set(route,{
   route,slug:'post--'+route.slice(1).replaceAll('/','--'),templateSlug:template.slug,
   type:'article',contentKey:template.contentKey,components:template.components,
   title:post.title+' | m1000z',description:post.description||post.excerpt,
  });
 }
 return [...result.values()];
}
export function isIndexable(page,post){
 return page.type!=='error'&&!page.noindex&&!post?.noindex&&!page.redirect
  &&(!page.canonical||canonicalUrl(page.canonical)===canonicalUrl(page.route))
  &&(!post?.canonical||canonicalUrl(post.canonical)===canonicalUrl(page.route));
}
export function lastModified(page,post){
 // Omit unknown dates. Build time, filesystem mtime, and publication time are not lastmod.
 const value=post?.lastModified||page.lastModified;
 if(!value)return null;
 if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)
  ||!Number.isFinite(Date.parse(value))||value.slice(0,10)!==new Date(value.slice(0,10)).toISOString().slice(0,10))throw new Error('Invalid lastModified for '+page.route);
 if(Date.parse(value)>Date.now())throw new Error('Future lastModified for '+page.route);
 return value;
}
