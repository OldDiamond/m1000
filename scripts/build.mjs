import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertPublicFiles } from './check-public-files.mjs';
import { buildNotFoundPage } from './build-not-found.mjs';
import { canonicalUrl, resolvePages, routePath } from './site-pages.mjs';
import { buildSitemap } from './build-sitemap.mjs';
import {selectPosts,homepagePosts,relatedPosts,previewPages} from './post-selection.mjs';
import {renderAnimatedCard} from './render-animated-card.mjs';
import {renderIdorCodeBlocks} from './render-idor-code.mjs';
const publishedPosts=selectPosts(JSON.parse(fs.readFileSync('content/posts.json','utf8')),{includeDrafts:process.argv.includes('--include-drafts')});
for(const post of publishedPosts){
 if(!post.reviewDraft&&(!post.publishedAt||!post.date||post.date!==post.publishedAt.slice(0,10)))throw new Error('An approved publication timestamp and matching date are required: '+post.url);
}
const pages=resolvePages(previewPages(JSON.parse(fs.readFileSync('src/pages.json','utf8')),{includeDrafts:process.argv.includes('--include-drafts')}),publishedPosts);
const posts=publishedPosts.filter(post=>pages.some(page=>page.type==='article'&&page.route===routePath(post.url)))
 .sort((a,b)=>new Date(b.publishedAt||b.date)-new Date(a.publishedAt||a.date));
const postBodies=new Map(posts.map(post=>[post.url,fs.readFileSync(post.bodyFile,'utf8')]));
for(const page of pages.filter(page=>page.type==='guide'))postBodies.set(canonicalUrl(page.route).replace('https://www.m1000z.com',''),fs.readFileSync(page.bodyFile,'utf8'));
const wordCount=body=>body.replace(/<[^>]*>/g,' ').trim().split(/\s+/).length;
const readingMinutes=post=>Math.max(1,Math.ceil(wordCount(postBodies.get(post.url))/200));
const siteHref=value=>{
 if(typeof value!=='string')return value;
 const match=/^(\/[^?#]*)(.*)$/.exec(value);
 if(!match)return value;
 const route=match[1].replace(/\/+$/,'') || '/';
 return pages.some(page=>page.route===route)?(route==='/'?'/':route+'/')+match[2]:value;
};
const content=JSON.parse(fs.readFileSync('content/portfolio.json','utf8'));
const settings=JSON.parse(fs.readFileSync('content/settings.json','utf8'));
const publicFileOptions={approvedDocuments:[settings.cvUrl || '']};
assertPublicFiles('public',publicFileOptions);
const assets=fs.existsSync('content/assets.json')?JSON.parse(fs.readFileSync('content/assets.json','utf8')):{};
const localize=value=>{for(const [url,local]of Object.entries(assets)){value=value.replaceAll(url,local).replaceAll(url.replaceAll('&','&amp;'),local)}return value};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const blogCard=fs.readFileSync('src/components/BlogCard.html','utf8');
const renderBlogCard=post=>{
 if(new URL(post.url,'https://www.m1000z.com').protocol!=='https:')throw new Error('Blog links must use HTTPS');
 const thumbnail=post.thumbnail;
 const difficulty=typeof post.difficulty==='string'?post.difficulty.trim():'';
 const category='<p class="blog-card-category">'+escape(post.category||'Penetration Testing')+'</p>';
 const categoryLine=difficulty?'<div class="blog-card-category-row">'+category+'<span class="blog-card-difficulty" title="Learning difficulty, not vulnerability severity">'+escape(difficulty)+'</span></div>':category;
 const fields={postUrl:siteHref(routePath(post.url)),postTitle:post.title,postImage:thumbnail?.src||post.image,imageAlt:thumbnail?.alt||post.imageAlt,
  imageWidth:thumbnail?.width||post.imageWidth,imageHeight:thumbnail?.height||post.imageHeight,
  postImageFit:thumbnail?.fit==='contain'?'contain':'cover',postDate:post.date,readingMinutes:readingMinutes(post),postCategory:post.category||'Penetration Testing',
  postDisplayDate:post.date?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(post.date)):'Unpublished draft',postExcerpt:post.excerpt};
 let card=Object.entries(fields).reduce((html,[key,value])=>html.replaceAll('{{'+key+'}}',escape(value)),blogCard)
  .replaceAll('{{postCategoryLine}}',categoryLine)
  .replaceAll('{{postCves}}',post.cves?.length?'<ul class="blog-card-cves" aria-label="CVE identifiers">'+post.cves.map(cve=>'<li>'+escape(cve)+'</li>').join('')+'</ul>':'');
 if(!post.date)card=card.replace(/<time datetime="undefined">([^<]+)<\/time>/,'<span>$1</span>');
 return thumbnail?.animatedWebp?renderAnimatedCard(card,thumbnail,escape):card;
};
const blogCards=posts.map(renderBlogCard).join('\n');
const labs=JSON.parse(fs.readFileSync('content/labs.json','utf8')).filter(lab=>lab.published===true);
const labCard=fs.readFileSync('src/components/LabCard.html','utf8');
const labCards=labs.map(lab=>{
 if(new URL(lab.liveUrl).protocol!=='https:')throw new Error('Live lab links must use HTTPS');
 const fields={...lab,thumbnailSrc:lab.thumbnail.src,thumbnailAlt:lab.thumbnail.alt,
  thumbnailWidth:lab.thumbnail.width,thumbnailHeight:lab.thumbnail.height,
  walkthroughUrl:siteHref(lab.walkthroughUrl),setupUrl:siteHref(lab.setupUrl)};
 const thumbnailSources=lab.thumbnail.animatedWebp
  ?'<source media="(prefers-reduced-motion: reduce)" srcset="'+escape(lab.thumbnail.poster||lab.thumbnail.src)+'"><source type="image/webp" srcset="'+escape(lab.thumbnail.animatedWebp)+'">':'';
 return Object.entries(fields).reduce((html,[key,value])=>html.replaceAll('{{'+key+'}}',escape(value)),labCard)
  .replaceAll('{{thumbnailSources}}',thumbnailSources);
}).join('\n');
// Recreate only the generated output so removed assets cannot survive a rebuild.
const projectRoot=fs.realpathSync('.');
const outputRoot=path.join(projectRoot,'dist');
if(path.dirname(outputRoot)!==projectRoot||fs.lstatSync(outputRoot,{throwIfNoEntry:false})?.isSymbolicLink())throw new Error('Unsafe build output path');
fs.rmSync(outputRoot,{recursive:true,force:true});
fs.mkdirSync(path.join(outputRoot,'assets'),{recursive:true});
if(fs.existsSync('public'))fs.cpSync('public','dist',{recursive:true});
fs.copyFileSync('src/styles/custom.css','dist/assets/custom.css');
fs.copyFileSync('src/styles/theme.css','dist/assets/theme.css');
fs.copyFileSync('src/styles/responsive.css','dist/assets/responsive.css');
fs.copyFileSync('src/interactions.js','dist/assets/interactions.js');
fs.copyFileSync('src/footer-hands.js','dist/assets/footer-hands.js');
fs.copyFileSync('src/footer-mark.js','dist/assets/footer-mark.js');
fs.copyFileSync('src/page-motion.js','dist/assets/page-motion.js');
fs.copyFileSync('src/opening-dots.js','dist/assets/opening-dots.js');
fs.copyFileSync('src/article.js','dist/assets/article.js');
fs.copyFileSync('src/blog-search.js','dist/assets/blog-search.js');
fs.copyFileSync('src/styles/blog-search.css','dist/assets/blog-search.css');
fs.copyFileSync('src/styles/blog-cards.css','dist/assets/blog-cards.css');
fs.copyFileSync('src/styles/labs.css','dist/assets/labs.css');
fs.copyFileSync('src/styles/article-header.css','dist/assets/article-header.css');
fs.copyFileSync('src/styles/idor-publication.css','dist/assets/idor-publication.css');
fs.copyFileSync('src/idor-article.js','dist/assets/idor-article.js');
const browserModules=new Map(['interactions','footer-hands','footer-mark','page-motion','opening-dots'].map(name=>[name+'.js',fs.readFileSync('dist/assets/'+name+'.js','utf8')]));
for(const [name,source] of browserModules){
 const versioned=source.replace(/(["'])\.\/([\w-]+\.js)\1/g,(match,quote,dependency)=>{
  if(!browserModules.has(dependency))return match;
  const version=createHash('sha256').update(browserModules.get(dependency)).digest('hex').slice(0,12);
  return quote+'./'+dependency+'?v='+version+quote;
 });
 fs.writeFileSync('dist/assets/'+name,versioned);
}
const pick=(object,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(object || {},key)).map(key=>[key,object[key]]));
const publicSettings={
 ...pick(settings,['displayName','contactEmail','copyrightYear','quote','contactEndpoint','newsletterEndpoint','cvUrl']),
 navigation:(settings.navigation || []).map(item=>({...pick(item,['label']),href:siteHref(item.href)})),
 openingDots:pick(settings.openingDots,['enabled','text','duration','oncePerSession']),
 backgroundCurtains:pick(settings.backgroundCurtains,['enabled','intensity','speed','primaryColor','secondaryColor']),
 footerHands:pick(settings.footerHands,['enabled','color','opacity','columns']),
 footerMark:pick(settings.footerMark,['enabled','color']),
};
fs.writeFileSync('dist/assets/settings.json',JSON.stringify(publicSettings));
const faviconLinks=[
 ['icon','/favicon.ico','image/x-icon','16x16 32x32 48x48 96x96'],
 ['icon','/favicon-32x32.png','image/png','32x32'],
 ['icon','/favicon-96x96.png','image/png','96x96'],
 ['apple-touch-icon','/apple-touch-icon.png','image/png','180x180'],
].map(([rel,url,type,sizes])=>{
 // Stable public URLs let crawlers keep the same favicon location across deploys.
 if(!fs.existsSync(path.join('dist',url)))throw new Error('Missing favicon asset: '+url);
 return `<link rel="${rel}" type="${type}" sizes="${sizes}" href="${url}">`;
}).join('');
const pageBackground=fs.readFileSync('src/components/PageBackground.html','utf8');
for(const page of pages){
 if(page.type==='error'){
  buildNotFoundPage({outputRoot,page,displayName:settings.displayName,faviconLinks});
  continue;
 }
 const articlePost=page.type==='article'?posts.find(post=>routePath(post.url)===page.route):page.type==='guide'?{
  title:page.headline,url:canonicalUrl(page.route).replace('https://www.m1000z.com',''),author:'Yasin',
  date:page.date,publishedAt:page.publishedAt,
  excerpt:page.description,category:'Lab Setup',tags:['Northline Billing','Windows','Linux'],publicationPackage:'idor',
  image:'/assets/blog/hunting-idor-cover.webp',imageWidth:1254,imageHeight:1254,imageAlt:'IDOR object-authorization illustration',
 }:null;
 if(page.type==='article'&&!articlePost)throw new Error('Missing article data for '+page.route);
 let html=fs.readFileSync('src/pages/'+(page.templateSlug||page.slug)+'.html','utf8');
 const navigation=publicSettings.navigation.map((item,index)=>{
  const destination=new URL(item.href,'https://www.m1000z.com');
  const current=!destination.hash&&destination.href===canonicalUrl(page.route);
  const letters=[...item.label].map((letter,i)=>'<span style="--letter-index: '+i+';">'+escape(letter)+'</span>').join('');
  return '<a href="'+escape(item.href)+'"'+(item.href.endsWith('#contact')?' class="portfolio-contact-link"':'')+(current?' aria-current="page"':'')+' aria-label="'+escape(item.label)+'" style="--menu-index: '+index+';"><span class="rolling-label" aria-hidden="true">'+letters+'</span></a>';
 }).join('');
 html=html.replaceAll('<!--HEADER-->',fs.readFileSync('src/components/Header.html','utf8').replaceAll('{{displayName}}',escape(settings.displayName)).replaceAll('<!--NAVIGATION-->','<div class="portfolio-menu-links">'+navigation+'</div>'));
 page.components.forEach((name,i)=>{html=html.replace('<!--COMPONENT:'+i+'-->',fs.readFileSync('src/components/'+name+'.html','utf8'))});
 html=html.replaceAll('<!--BLOG-CARDS-->',page.slug==='home'?homepagePosts(posts).map(renderBlogCard).join('\n'):blogCards);
 html=html.replaceAll('<!--LAB-CARDS-->',labCards);
 if(articlePost){
  const body=postBodies.get(articlePost.url);
  const fields={postTitle:articlePost.title,postAuthor:articlePost.author,postDate:articlePost.date,
   postLongDate:articlePost.date?new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(articlePost.date)):'Unpublished draft',
   readingMinutes:readingMinutes(articlePost)};
  for(const [key,value]of Object.entries(fields))html=html.replaceAll('{{'+key+'}}',escape(value));
  if(!articlePost.date)html=html.replace(/<time datetime="undefined">([^<]+)<\/time>/,'<span>$1</span>');
  html=html.replaceAll('{{postTags}}',[...new Set([articlePost.category,...articlePost.tags,...(articlePost.cves||[])].filter(Boolean))].map(tag=>'<li>'+escape(tag)+'</li>').join(''));
  html=html.replaceAll('{{postSubtitle}}',articlePost.subtitle?'<p class="article-subtitle">'+escape(articlePost.subtitle)+'</p>':'');
  const difficulty=typeof articlePost.difficulty==='string'?articlePost.difficulty.trim():'';
  html=html.replaceAll('{{postDifficulty}}',difficulty?'<p class="article-difficulty" title="Learning difficulty, not vulnerability severity"><span class="article-sr-only">Learning difficulty: </span>'+escape(difficulty)+'</p>\n      ':'');
  if(articlePost.labLiveUrl&&new URL(articlePost.labLiveUrl).protocol!=='https:')throw new Error('Live lab links must use HTTPS');
  const resourceLinks=[
   articlePost.labDownloadUrl?'<a class="article-resource-button" href="'+escape(siteHref(articlePost.labDownloadUrl))+'" download>Download lab (.zip)</a>':'',
   articlePost.labSetupUrl?'<a class="article-resource-button" href="'+escape(siteHref(articlePost.labSetupUrl))+'">Setup guide</a>':'',
   articlePost.labLiveUrl?'<a class="article-resource-button article-live-button" href="'+escape(articlePost.labLiveUrl)+'" target="_blank" rel="noopener noreferrer">Launch live lab <span aria-hidden="true">↗</span><span class="article-sr-only"> (opens in a new tab)</span></a>':'',
  ].filter(Boolean).join('');
  html=html.replaceAll('{{postHeaderActions}}',resourceLinks?'<nav class="article-header-actions" aria-label="Lab resources">'+resourceLinks+'</nav>\n        ':'');
  html=html.replaceAll('{{postCover}}',articlePost.cover?'<figure class="article-cover"><img src="'+escape(articlePost.image)+'" width="'+escape(articlePost.imageWidth)+'" height="'+escape(articlePost.imageHeight)+'" alt="'+escape(articlePost.imageAlt)+'" decoding="async" fetchpriority="high">'+(articlePost.coverCaption===''?'':'<figcaption>'+escape(articlePost.coverCaption||'Original conceptual illustration by m1000z.')+'</figcaption>')+'</figure>':'');
  html=html.replaceAll('{{postSource}}',articlePost.sourceUrl?'<p class="article-source">Originally published on <a href="'+escape(articlePost.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Medium ↗</a>.</p>':'');
  let renderedBody=body;
  if(articlePost.url==='/posts/hunting-idor-web-applications/'){
   const resources=fs.readFileSync('src/components/IdorLabResources.html','utf8');
   const setup=siteHref(articlePost.labSetupUrl);
   const resourceFields={resourceLiveUrl:articlePost.labLiveUrl,resourceDownloadUrl:siteHref(articlePost.labDownloadUrl),resourceSetupUrl:setup};
   // The setup guide is the existing public documentation source; never execute the lab.
   const guide=fs.readFileSync('content/guides/idor-setup.html','utf8');
   const credentialTable=guide.match(/<div class="idor-table-scroll idor-credentials-table"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
   const demoAccounts=[...credentialTable.matchAll(/<tr><td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td>/g)];
   if(demoAccounts.length!==2||demoAccounts.map(match=>match[1]).join(',')!=='Alice,Bob')throw new Error('Expected the two documented public training accounts');
   const accounts=demoAccounts.map(([,name,email,password],index)=>{
    const heading='idor-demo-account-'+index;
    const row=(label,value)=>{const id=heading+'-'+label;return '<div><dt>'+label[0].toUpperCase()+label.slice(1)+'</dt><dd><code id="'+id+'">'+escape(value)+'</code><button type="button" data-credential-copy="'+id+'" aria-label="Copy '+label+' for '+escape(name)+'">Copy '+label+'</button></dd></div>';};
    return '<section class="idor-credentials-account" aria-labelledby="'+heading+'"><h3 id="'+heading+'" data-toc-exclude>'+escape(name)+'</h3><dl>'+row('email',email)+row('password',password)+'</dl></section>';
   }).join('');
   const dialog=fs.readFileSync('src/components/IdorCredentialsDialog.html','utf8').replace('{{demoAccounts}}',accounts);
   const card=Object.entries(resourceFields).reduce((markup,[key,value])=>markup.replaceAll('{{'+key+'}}',escape(value)),resources)
    .replaceAll('{{resourceDifficulty}}',difficulty?'<p class="idor-resource-difficulty" title="Learning difficulty, not vulnerability severity">'+escape(difficulty)+'</p>':'')
    .replaceAll('{{resourceCredentialsDialog}}',dialog);
   renderedBody=body.replace('<!--IDOR-LAB-RESOURCES-->',card);
  }
  html=html.replaceAll('{{postBody}}',articlePost.publicationPackage==='idor'?renderIdorCodeBlocks(renderedBody):renderedBody);
  if(page.type==='guide'){
   html=html.replace('<a class="article-back" href="/blog/">← All Blogs</a>','<a class="article-back" href="/posts/hunting-idor-web-applications/">← IDOR article</a>');
   html=html.replace(/<section class="article-related"[\s\S]*?<\/section>/,'');
  }
  const related=relatedPosts(posts,articlePost.url);
  html=html.replaceAll('{{relatedPosts}}',related.length
   ?'<div class="article-related-grid">'+related.map(renderBlogCard).join('\n')+'</div>'
   :'<p class="article-related-empty">More articles will appear here as they’re published.</p>');
 }
 for(const [key,field]of Object.entries(content[page.contentKey||page.slug])){
  if(field.type==='html'||field.type==='text'){const re=new RegExp('(<(h[1-6]|p)\\b[^>]*data-edit="'+key+'"[^>]*>)[\\s\\S]*?<\\/\\2>','g');html=html.replace(re,(_,open,tag)=>open+(field.type==='text'?escape(field.value):field.value)+'</'+tag+'>')}
  else {const marker=field.type==='image'?'data-edit-image':'data-edit-link';const re=new RegExp('<(?:img|a)\\b[^>]*'+marker+'="'+key+'"[^>]*>','g');html=html.replace(re,tag=>{const attr=field.type==='image'?'src':'href';tag=tag.replace(new RegExp(attr+'="[^"]*"'),attr+'="'+escape(field.value)+'"');if(field.type==='image')tag=tag.replace(/alt="[^"]*"/,'alt="'+escape(field.alt||'')+'"');return tag})}
 }
 const dir=path.join('dist',page.route);fs.mkdirSync(dir,{recursive:true});
 html=html.replaceAll('{{cvAttributes}}',settings.cvUrl?'href="'+escape(settings.cvUrl)+'" download':'role="link" aria-disabled="true" tabindex="0" title="CV will be available soon"');
 html=html.replaceAll('{{cvViewAttributes}}',settings.cvUrl?'href="'+escape(settings.cvUrl)+'"':'role="link" aria-disabled="true" tabindex="0" title="CV will be available soon"');
 html=html.replaceAll('{{contactFormAction}}',escape((settings.contactEndpoint||'').replace('https://formsubmit.co/ajax/','https://formsubmit.co/')));
 const stylesheet=articlePost?'article':page.styleSlug||page.slug;
 fs.writeFileSync('dist/assets/'+stylesheet+'.css',localize(fs.readFileSync('src/styles/'+stylesheet+'.css','utf8')));
 html=localize(html);
 // Give long brand names a usable static fit; the browser refines it with the loaded font.
 html=html.replace(/(<svg\b[^>]*data-framer-component-type="RichTextContainer"[^>]*>)([\s\S]*?)<\/svg>/g,(match,open,body)=>{
  if(!body.includes('framer-fit-text'))return match;
  const size=Math.min(416.95,1180/(Math.max(1,settings.displayName.length)*.65));
  open=open.replace(/viewBox="[^"]*"/,'viewBox="0 0 1200 '+(size*.9)+'"').replace('<svg ','<svg data-brand-wordmark="true" ');
  body=body.replace(/--framer-font-size:[^;]+;/,'--framer-font-size:'+size+'px;');
  return open+body+'</svg>';
 });
 html=html.replace(/(<footer\b[^>]*>)/g, '$1'+fs.readFileSync('src/components/FooterHands.html','utf8'));
 html=html.replace(/(<div\b[^>]*data-framer-name="Quick Links"[^>]*>[\s\S]*?<div\b[^>]*data-framer-name="Links"[^>]*>)/g,'$1'+fs.readFileSync('src/components/FooterLabsLink.html','utf8'));
 if(settings.footerMark?.enabled!==false)html=html.replace(/(<div\b[^>]*data-framer-name="Quick Links"[^>]*>)/g,(_,open)=>open+fs.readFileSync('src/components/FooterMark.html','utf8').replaceAll('{{footerMarkColor}}',escape(settings.footerMark?.color||'var(--accent)')));
 html=html.replaceAll('href="./','href="/');
 html=html.replace(/href="(\/[^"#]+)(#[^"]*)?"/g,(match,target,hash='')=>{if(pages.some(p=>p.route===target))return match;const found=pages.find(p=>p.route.split('/').at(-1)===target.slice(1));return found?'href="'+found.route+hash+'"':match});
 html=html.replace(/href="(\/[^"\s]*)"/g,(_,href)=>'href="'+siteHref(href)+'"');
 if(page.slug==='home'){
  html=html.replace('data-framer-name="Hero Section" id="hero-section">','data-framer-name="Hero Section" id="hero-section"><span class="hero-copyright">©'+settings.copyrightYear+'</span>');
 }
 html=html.replace(/(<div\b[^>]*class="[^"]*\bframer-zpn31\b[^"]*"[^>]*>)/, '$1'+pageBackground);
 const icons=fs.readFileSync('src/components/Icons.html','utf8');
 const opening=page.slug==='home'&&settings.openingDots?.enabled!==false?fs.readFileSync('src/components/OpeningDots.html','utf8').replaceAll('{{openingText}}',escape(String(settings.openingDots?.text||'['+settings.displayName+']').slice(0,32))).replaceAll('{{openingDuration}}',String(Math.max(2500,Math.min(10000,Number(settings.openingDots?.duration)||5600)))).replaceAll('{{openingOnce}}',String(settings.openingDots?.oncePerSession!==false)):'';
 // Keep the original heading markup and line breaks; only words receive motion.
 let introPending=false;
 html=html.replace(/<(h[12]|p)\b([^>]*)>([\s\S]*?)<\/\1>/g,(match,tag,attrs,body,offset)=>{
  if(html.lastIndexOf('<footer',offset)>html.lastIndexOf('</footer',offset)||body.includes('data-brand-wordmark')||/\bdata-no-reveal\b/.test(attrs)||/^\s*(?:©|&copy;)/.test(body))return match;
  if(tag==='p'&&!introPending)return match;
  const intro=tag==='p';
  if(intro)introPending=false;
  if(tag==='h1'&&page.slug!=='home')introPending=true;
  const hero=page.slug==='home'&&tag==='h1';
  const words=body.split(/(<[^>]+>)/g).map(part=>part.startsWith('<')?part:part.replace(/\S+/g,word=>'<span data-reveal-word>'+word+'</span>')).join('');
  return '<'+tag+attrs+' data-page-reveal="'+(hero?'hero':intro?'intro':'heading')+'">'+words+'</'+tag+'>';
 });
 const motionBoot='<script>'+fs.readFileSync('src/navigation-boot.js','utf8')+'</script>';
 const fontFiles=[...new Set([...(page.slug==='about'||articlePost?['about-inter','about-inter-tight',...(page.slug==='about'?['about-jetbrains-mono']:[])]:[500,600,page.slug==='home'?800:700].map(weight=>'archivo-normal-'+weight)),'archivo-normal-500','archivo-normal-700'])];
 const fontPreloads=fontFiles.map(name=>'<link rel="preload" href="/assets/fonts/'+name+'.woff2" as="font" type="font/woff2" crossorigin>').join('');
 const embeddedSettings='<script type="application/json" id="portfolio-settings">'+JSON.stringify(publicSettings).replaceAll('<','\\u003c')+'</script>';
 const pageSeo=page.slug==='about'?[
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="'+escape(settings.displayName)+'">',
  '<meta property="og:url" content="https://www.m1000z.com/about/">',
  '<meta property="og:title" content="'+escape(page.title)+'">',
  '<meta property="og:description" content="'+escape(page.description)+'">',
  '<meta property="og:image" content="https://www.m1000z.com/assets/brand/m1000z-logo.png">',
  '<meta property="og:image:alt" content="m1000z silver emblem">',
  '<meta property="og:image:width" content="180">',
  '<meta property="og:image:height" content="180">',
  '<meta name="twitter:card" content="summary">',
  '<meta name="twitter:title" content="'+escape(page.title)+'">',
  '<meta name="twitter:description" content="'+escape(page.description)+'">',
  '<meta name="twitter:image" content="https://www.m1000z.com/assets/brand/m1000z-logo.png">',
  '<meta name="twitter:image:alt" content="m1000z silver emblem">',
 ].join(''):'';
 const articleStructuredData=articlePost?'<script type="application/ld+json">'+JSON.stringify({
  '@context':'https://schema.org','@type':page.type==='guide'?'TechArticle':'BlogPosting',headline:articlePost.title,
  description:articlePost.description||articlePost.excerpt,url:canonicalUrl(page.route),
  mainEntityOfPage:{'@type':'WebPage','@id':canonicalUrl(page.route)},
  image:new URL(articlePost.socialImage||articlePost.image,'https://www.m1000z.com').href,
  author:{'@type':'Person',name:articlePost.author,url:'https://www.m1000z.com/about/'},
  publisher:{'@type':'Person',name:settings.displayName,url:'https://www.m1000z.com/'},
  datePublished:articlePost.publishedAt,...(articlePost.lastModified?{dateModified:articlePost.lastModified}:{}),
  articleSection:articlePost.category||'Penetration Testing',keywords:[...articlePost.tags,...(articlePost.cves||[])].join(', '),
  inLanguage:'en',isAccessibleForFree:true,wordCount:wordCount(postBodies.get(articlePost.url)),
 }).replaceAll('<','\\u003c')+'</script>':'';
 const articleSeo=articlePost?[
  '<meta property="og:type" content="article">',
  '<meta property="og:title" content="'+escape(page.title)+'">',
  '<meta property="og:description" content="'+escape(page.description)+'">',
  '<meta property="og:url" content="https://www.m1000z.com'+escape(siteHref(page.route))+'">',
  '<meta property="og:image" content="https://www.m1000z.com'+escape(articlePost.socialImage||articlePost.image)+'">',
  '<meta property="og:image:alt" content="'+escape(articlePost.imageAlt)+'">',
  '<meta property="og:image:width" content="'+escape(articlePost.imageWidth)+'">',
  '<meta property="og:image:height" content="'+escape(articlePost.imageHeight)+'">',
  ...(articlePost.publishedAt?['<meta property="article:published_time" content="'+escape(articlePost.publishedAt)+'">']:[]),
  '<meta property="article:author" content="'+escape(articlePost.author)+'">',
  ...(articlePost.category?['<meta property="article:section" content="'+escape(articlePost.category)+'">']:[]),
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="'+escape(page.title)+'">',
  '<meta name="twitter:description" content="'+escape(page.description)+'">',
  '<meta name="twitter:image" content="https://www.m1000z.com'+escape(articlePost.socialImage||articlePost.image)+'">',
 ].join('')+articleStructuredData:'';
 const doc=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#080809"><style>html,body{background:#080809;color:#edf0ed}</style><title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}">${fontPreloads}<link rel="stylesheet" href="/assets/${stylesheet}.css"><link rel="stylesheet" href="/assets/custom.css"><link rel="stylesheet" href="/assets/theme.css"><link rel="stylesheet" href="/assets/responsive.css">${motionBoot}${embeddedSettings}<script type="module" src="/assets/interactions.js" blocking="render"></script></head><body>${opening}${icons}${html}</body></html>`;
 // Recolored images, styles and entry scripts bypass cached versions after deployment.
 const articleDoc=articlePost?doc.replace('</head>','<script type="module" src="/assets/article.js"></script></head>'):doc;
 const animatedCards=(page.slug==='blog'?posts:page.slug==='home'?homepagePosts(posts):[]).some(post=>post.thumbnail?.animatedWebp);
 const blogAssets=(page.slug==='labs'?'<link rel="stylesheet" href="/assets/labs.css">':'')
  +(page.slug==='blog'?'<link rel="stylesheet" href="/assets/blog-search.css"><script type="module" src="/assets/blog-search.js"></script>':'')
  +(animatedCards||articlePost?.publicationPackage==='idor'?'<link rel="stylesheet" href="/assets/idor-publication.css">':'')
  +(articlePost?.publicationPackage==='idor'?'<script type="module" src="/assets/idor-article.js"></script>':'')
  +(html.includes('blog-preview-card')?'<link rel="stylesheet" href="/assets/blog-cards.css">':'')
  +(articlePost&&(articlePost.difficulty||articlePost.labDownloadUrl||articlePost.labSetupUrl||articlePost.labLiveUrl)?'<link rel="stylesheet" href="/assets/article-header.css">':'');
 const canonical=canonicalUrl(articlePost?.canonical||page.canonical||page.route);
 const indexingSeo='<link rel="canonical" href="'+escape(canonical)+'"><meta name="robots" content="'+(page.noindex||articlePost?.noindex?'noindex':'index')+',follow">';
 const noScriptNavigation='<noscript><style>.portfolio-toggle{display:none}.portfolio-menu-reveal{grid-template-rows:1fr}.portfolio-menu{visibility:visible}.portfolio-menu a{opacity:1;transform:none}</style></noscript>';
 const versionedDoc=articleDoc.replace('</head>',indexingSeo+pageSeo+articleSeo+faviconLinks+blogAssets+noScriptNavigation+'</head>').replace(/((?:href|src)=")((?:\/assets\/[^"?#]+\.(?:css|js))|(?:\/assets\/(?:media\/portrait-red-v3\.png|footer\/looping-arch\.gif)))"/g,(_,attribute,url)=>{
  const version=createHash('sha256').update(fs.readFileSync(path.join('dist',url))).digest('hex').slice(0,12);
  return attribute+url+'?v='+version+'"';
 });
 fs.writeFileSync(path.join(dir,'index.html'),versionedDoc);
}
buildSitemap({outputRoot,pages,posts});
try { assertPublicFiles('dist',publicFileOptions); }
catch(error) { fs.rmSync(outputRoot,{recursive:true,force:true}); throw error; }
console.log('Built '+pages.length+' pages into dist/; public-file safety checks passed.');
