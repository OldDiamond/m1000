import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertPublicFiles } from './check-public-files.mjs';
const pages=JSON.parse(fs.readFileSync('src/pages.json','utf8'));
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
 ['icon','/favicon.ico','image/x-icon','16x16 32x32 48x48'],
 ['icon','/favicon-32x32.png','image/png','32x32'],
 ['apple-touch-icon','/apple-touch-icon.png','image/png','180x180'],
].map(([rel,url,type,sizes])=>{
 const version=createHash('sha256').update(fs.readFileSync(path.join('dist',url))).digest('hex').slice(0,12);
 return `<link rel="${rel}" href="${url}?v=${version}" type="${type}" sizes="${sizes}">`;
}).join('');
for(const page of pages){
 let html=fs.readFileSync('src/pages/'+page.slug+'.html','utf8');
 html=html.replaceAll('<!--HEADER-->',fs.readFileSync('src/components/Header.html','utf8').replaceAll('{{displayName}}',escape(settings.displayName)));
 page.components.forEach((name,i)=>{html=html.replace('<!--COMPONENT:'+i+'-->',fs.readFileSync('src/components/'+name+'.html','utf8'))});
 for(const [key,field]of Object.entries(content[page.slug])){
  if(field.type==='html'||field.type==='text'){const re=new RegExp('(<(h[1-6]|p)\\b[^>]*data-edit="'+key+'"[^>]*>)[\\s\\S]*?<\\/\\2>','g');html=html.replace(re,(_,open,tag)=>open+(field.type==='text'?escape(field.value):field.value)+'</'+tag+'>')}
  else {const marker=field.type==='image'?'data-edit-image':'data-edit-link';const re=new RegExp('<(?:img|a)\\b[^>]*'+marker+'="'+key+'"[^>]*>','g');html=html.replace(re,tag=>{const attr=field.type==='image'?'src':'href';tag=tag.replace(new RegExp(attr+'="[^"]*"'),attr+'="'+escape(field.value)+'"');if(field.type==='image')tag=tag.replace(/alt="[^"]*"/,'alt="'+escape(field.alt||'')+'"');return tag})}
 }
 const dir=path.join('dist',page.route);fs.mkdirSync(dir,{recursive:true});
 html=html.replaceAll('{{cvAttributes}}',settings.cvUrl?'href="'+escape(settings.cvUrl)+'" download':'role="link" aria-disabled="true" tabindex="0" title="CV will be available soon"');
 html=html.replaceAll('{{contactFormAction}}',escape((settings.contactEndpoint||'').replace('https://formsubmit.co/ajax/','https://formsubmit.co/')));
 fs.writeFileSync('dist/assets/'+page.slug+'.css',localize(fs.readFileSync('src/styles/'+page.slug+'.css','utf8')));
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
 if(settings.footerMark?.enabled!==false)html=html.replace(/(<div\b[^>]*data-framer-name="Quick Links"[^>]*>)/g,(_,open)=>open+fs.readFileSync('src/components/FooterMark.html','utf8').replaceAll('{{footerMarkColor}}',escape(settings.footerMark?.color||'#c74747')));
 if(page.slug==='about')html=html.replace(/(<div\b[^>]*class="[^"]*\bframer-zpn31\b[^"]*"[^>]*>)/, '$1'+fs.readFileSync('src/components/AboutBackground.html','utf8'));
 html=html.replaceAll('href="./','href="/');
 html=html.replace(/href="(\/[^"#]+)(#[^"]*)?"/g,(match,target,hash='')=>{if(pages.some(p=>p.route===target))return match;const found=pages.find(p=>p.route.split('/').at(-1)===target.slice(1));return found?'href="'+found.route+hash+'"':match});
 html=html.replace(/href="(\/[^"\s]*)"/g,(_,href)=>'href="'+siteHref(href)+'"');
 if(page.slug==='home'){
  html=html.replace('data-framer-name="Hero &amp; Bio Sections">','data-framer-name="Hero &amp; Bio Sections">'+fs.readFileSync('src/components/HeroBackground.html','utf8'));
  html=html.replace('data-framer-name="Hero Section" id="hero-section">','data-framer-name="Hero Section" id="hero-section"><span class="hero-copyright">©'+settings.copyrightYear+'</span>');
 }
 const icons=fs.readFileSync('src/components/Icons.html','utf8');
 const opening=page.slug==='home'&&settings.openingDots?.enabled!==false?fs.readFileSync('src/components/OpeningDots.html','utf8').replaceAll('{{openingText}}',escape(String(settings.openingDots?.text||'['+settings.displayName+']').slice(0,32))).replaceAll('{{openingDuration}}',String(Math.max(2500,Math.min(10000,Number(settings.openingDots?.duration)||5600)))).replaceAll('{{openingOnce}}',String(settings.openingDots?.oncePerSession!==false)):'';
 // Keep the original heading markup and line breaks; only words receive motion.
 let introPending=false;
 html=html.replace(/<(h[12]|p)\b([^>]*)>([\s\S]*?)<\/\1>/g,(match,tag,attrs,body,offset)=>{
  if(html.lastIndexOf('<footer',offset)>html.lastIndexOf('</footer',offset)||body.includes('data-brand-wordmark')||/^\s*(?:©|&copy;)/.test(body))return match;
  if(tag==='p'&&!introPending)return match;
  const intro=tag==='p';
  if(intro)introPending=false;
  if(tag==='h1'&&page.slug!=='home')introPending=true;
  const hero=page.slug==='home'&&tag==='h1';
  const words=body.split(/(<[^>]+>)/g).map(part=>part.startsWith('<')?part:part.replace(/\S+/g,word=>'<span data-reveal-word>'+word+'</span>')).join('');
  return '<'+tag+attrs+' data-page-reveal="'+(hero?'hero':intro?'intro':'heading')+'">'+words+'</'+tag+'>';
 });
 const motionBoot='<script>'+fs.readFileSync('src/navigation-boot.js','utf8')+'</script>';
 const fontPreloads=[500,600,page.slug==='home'?800:700].map(weight=>'<link rel="preload" href="/assets/fonts/archivo-normal-'+weight+'.woff2" as="font" type="font/woff2" crossorigin>').join('');
 const embeddedSettings='<script type="application/json" id="portfolio-settings">'+JSON.stringify(publicSettings).replaceAll('<','\\u003c')+'</script>';
 const doc=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101315"><style>html,body{background:#101315;color:#edf0ed}</style><title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}">${fontPreloads}<link rel="stylesheet" href="/assets/${page.slug}.css"><link rel="stylesheet" href="/assets/custom.css"><link rel="stylesheet" href="/assets/theme.css"><link rel="stylesheet" href="/assets/responsive.css">${motionBoot}${embeddedSettings}<script type="module" src="/assets/interactions.js" blocking="render"></script></head><body>${opening}${icons}${html}</body></html>`;
 // Updated styles and entry scripts get fresh URLs on browsers that cached an earlier layout.
 const versionedDoc=doc.replace('</head>',faviconLinks+'</head>').replace(/((?:href|src)=")((?:\/assets\/)[^"?#]+\.(?:css|js))"/g,(_,attribute,url)=>{
  const version=createHash('sha256').update(fs.readFileSync(path.join('dist',url))).digest('hex').slice(0,12);
  return attribute+url+'?v='+version+'"';
 });
 fs.writeFileSync(path.join(dir,'index.html'),versionedDoc);
}
try { assertPublicFiles('dist',publicFileOptions); }
catch(error) { fs.rmSync(outputRoot,{recursive:true,force:true}); throw error; }
console.log('Built '+pages.length+' pages into dist/; public-file safety checks passed.');
