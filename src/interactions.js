async function setup(){
 const settings=await fetch('/assets/settings.json').then(r=>r.json());
 const footers=document.querySelectorAll('footer');const layoutFooter=()=>{const variant=innerWidth>=1280?'788ly6':innerWidth>=810?'1w2xgsd':'1s9g854';footers.forEach(e=>{e.classList.remove('framer-v-788ly6','framer-v-1w2xgsd','framer-v-1s9g854');e.classList.add('framer-v-'+variant)})};layoutFooter();window.addEventListener('resize',layoutFooter,{passive:true});
 footers.forEach(e=>e.querySelectorAll('a[href^="mailto:"]').forEach(a=>{a.href='mailto:'+settings.contactEmail;a.textContent=settings.contactEmail}));
 const quoteParent=document.querySelector('[data-framer-name="Quote Section"] span')?.parentElement;if(quoteParent&&settings.quote){const style=quoteParent.firstElementChild.getAttribute('style');quoteParent.replaceChildren(...settings.quote.split(/\s+/).map(word=>{const span=document.createElement('span');span.textContent=word;span.setAttribute('style',style);return span}))}
 const quotes=document.querySelectorAll('[data-framer-name="Quote Section"] span');const paintQuote=()=>{quotes.forEach((span,index)=>{const section=span.closest('section');const r=section.getBoundingClientRect();const progress=Math.max(0,Math.min(1,(innerHeight-r.top)/(innerHeight+r.height*.45)));span.style.color=index/quotes.length<progress?'#111':'rgba(0,0,0,.14)'})};if(quotes.length){paintQuote();window.addEventListener('scroll',paintQuote,{passive:true})}
 const menu=document.createElement('nav');menu.className='portfolio-menu';menu.id='portfolio-menu';menu.hidden=true;menu.setAttribute('aria-label','Main navigation');
 settings.navigation.forEach(item=>{const a=document.createElement('a');a.textContent=item.label;a.href=item.href;a.addEventListener('click',()=>toggle(false));menu.append(a)});document.body.append(menu);
 const trigger=document.querySelector('.portfolio-toggle');
 function toggle(open){menu.hidden=!open;trigger?.setAttribute('aria-expanded',String(open))}
 if(trigger){trigger.setAttribute('role','button');trigger.tabIndex=0;trigger.setAttribute('aria-label','Toggle navigation');trigger.setAttribute('aria-controls',menu.id);trigger.setAttribute('aria-expanded','false');trigger.style.cursor='pointer';trigger.addEventListener('click',e=>{e.stopPropagation();toggle(menu.hidden)});trigger.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(menu.hidden)}})}
 document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!trigger?.contains(e.target))toggle(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'){toggle(false);trigger?.focus()}});
 document.querySelectorAll('form').forEach(form=>{
  form.querySelectorAll('input[aria-hidden="true"]').forEach(e=>e.remove());form.querySelectorAll('textarea').forEach(e=>e.name='Project');
  form.removeAttribute('action');const newsletter=form.querySelectorAll('input:not([type=hidden])').length===1;const endpoint=newsletter?settings.newsletterEndpoint:settings.contactEndpoint;
  const feedback=document.createElement('p');feedback.className='form-feedback';feedback.setAttribute('role','status');form.after(feedback);
  form.querySelectorAll('input[type=email]').forEach(e=>e.required=true);
  form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;const data=Object.fromEntries(new FormData(form));
   if(!endpoint){if(newsletter){feedback.textContent='Newsletter signup is not connected yet.';return}const body=Object.entries(data).filter(([k])=>!k.startsWith('_')).map(([k,v])=>k+': '+v).join('\n');window.location.href='mailto:'+settings.contactEmail+'?subject='+encodeURIComponent('Portfolio project enquiry')+'&body='+encodeURIComponent(body);feedback.textContent='Your email app will open with your enquiry. Send it there to complete your message.';return}
   form.classList.add('portfolio-form-busy');try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw Error();feedback.textContent=newsletter?'You are subscribed.':'Thank you. Your enquiry has been sent.';form.reset()}catch{feedback.textContent='Could not send. Please try again or email '+settings.contactEmail}finally{form.classList.remove('portfolio-form-busy')}
  });
 });
}
setup().catch(console.error);
