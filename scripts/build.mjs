import fs from 'node:fs';
import path from 'node:path';
const pages=JSON.parse(fs.readFileSync('src/pages.json','utf8'));
const content=JSON.parse(fs.readFileSync('content/portfolio.json','utf8'));
const settings=JSON.parse(fs.readFileSync('content/settings.json','utf8'));
const assets=fs.existsSync('content/assets.json')?JSON.parse(fs.readFileSync('content/assets.json','utf8')):{};
const localize=value=>{for(const [url,local]of Object.entries(assets)){value=value.replaceAll(url,local).replaceAll(url.replaceAll('&','&amp;'),local)}return value};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
fs.mkdirSync('dist/assets',{recursive:true});
if(fs.existsSync('public'))fs.cpSync('public','dist',{recursive:true});
fs.copyFileSync('src/styles/custom.css','dist/assets/custom.css');
fs.copyFileSync('src/interactions.js','dist/assets/interactions.js');
fs.copyFileSync('src/curtain.js','dist/assets/curtain.js');
fs.copyFileSync('src/footer-hands.js','dist/assets/footer-hands.js');
fs.copyFileSync('src/footer-mark.js','dist/assets/footer-mark.js');
fs.copyFileSync('src/page-motion.js','dist/assets/page-motion.js');
fs.copyFileSync('src/opening-dots.js','dist/assets/opening-dots.js');
fs.writeFileSync('dist/assets/settings.json',JSON.stringify(settings));
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
 html=html.replace(/(<div\b[^>]*class="[^"]*\bframer-zpn31\b[^"]*"[^>]*>)/, '$1'+fs.readFileSync('src/components/CurtainBackground.html','utf8'));
 html=html.replaceAll('href="./','href="/');
 html=html.replace(/href="(\/[^"#]+)(#[^"]*)?"/g,(match,target,hash='')=>{if(pages.some(p=>p.route===target))return match;const found=pages.find(p=>p.route.split('/').at(-1)===target.slice(1));return found?'href="'+found.route+hash+'"':match});
 if(page.slug==='home')html=html.replace('data-framer-name="Hero Section" id="hero-section">','data-framer-name="Hero Section" id="hero-section"><span class="hero-copyright">©'+settings.copyrightYear+'</span>');
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
 const motionBoot=`<script>if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('page-motion-enabled');setTimeout(()=>{if(!window.__pageMotionReady)document.documentElement.classList.remove('page-motion-enabled')},4000)}</script>`;
 const doc=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}"><link rel="stylesheet" href="/assets/${page.slug}.css"><link rel="stylesheet" href="/assets/custom.css">${motionBoot}</head><body>${opening}${icons}${html}<script type="module" src="/assets/interactions.js"></script></body></html>`;
 fs.writeFileSync(path.join(dir,'index.html'),doc);
}
console.log('Built '+pages.length+' pages into dist/.');
