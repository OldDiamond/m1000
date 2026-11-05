// Native modal stays in the top layer, outside the sticky card and page transforms.
const credentialsDialog=document.querySelector('#idor-credentials-dialog');
const credentialsTrigger=document.querySelector('.idor-credentials-trigger');
if(credentialsDialog&&credentialsTrigger){
 document.body.append(credentialsDialog);
 const closeButton=credentialsDialog.querySelector('.idor-credentials-close');
 const status=credentialsDialog.querySelector('.idor-credentials-status');
 const copyButtons=[...credentialsDialog.querySelectorAll('[data-credential-copy]')];
 const labels=new Map(copyButtons.map(button=>[button,button.textContent]));
 const timers=new Map();let statusTimer,backdropPressed=false;
 credentialsTrigger.addEventListener('click',()=>{
  if(credentialsDialog.open)return;
  credentialsDialog.showModal();credentialsTrigger.setAttribute('aria-expanded','true');
  closeButton.focus({preventScroll:true});
 });
 closeButton.addEventListener('click',()=>credentialsDialog.close());
 credentialsDialog.addEventListener('close',()=>{
  clearTimeout(statusTimer);status.textContent='';
  for(const button of copyButtons){clearTimeout(timers.get(button));button.textContent=labels.get(button);}
  credentialsTrigger.setAttribute('aria-expanded','false');credentialsTrigger.focus({preventScroll:true});
 });
 const outside=event=>{const r=credentialsDialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
 credentialsDialog.addEventListener('pointerdown',event=>{backdropPressed=event.target===credentialsDialog&&outside(event);});
 credentialsDialog.addEventListener('click',event=>{if(backdropPressed&&event.target===credentialsDialog&&outside(event))credentialsDialog.close();backdropPressed=false;});
 credentialsDialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const first=closeButton,last=copyButtons.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 for(const button of copyButtons)button.addEventListener('click',async()=>{
  const code=document.getElementById(button.dataset.credentialCopy);if(!code)return;
  let copied=false;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(code.textContent);copied=true;}}catch(_){/* Try the selection-based fallback inside the modal. */}
  if(!copied){
   const field=document.createElement('textarea');field.value=code.textContent;field.tabIndex=-1;field.setAttribute('aria-hidden','true');
   field.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';credentialsDialog.append(field);field.select();
   try{copied=document.execCommand('copy');}catch(_){/* Leave the public value selectable if clipboard access is unavailable. */}
   field.remove();button.focus({preventScroll:true});
  }
  if(!credentialsDialog.open)return;
  clearTimeout(timers.get(button));clearTimeout(statusTimer);
  if(copied){
   button.textContent='Copied!';status.textContent=button.getAttribute('aria-label').replace(/^Copy /,'')+' copied.';
   timers.set(button,setTimeout(()=>{button.textContent=labels.get(button);},2000));
   statusTimer=setTimeout(()=>{status.textContent='';},2200);
  }else{
   const range=document.createRange();range.selectNodeContents(code);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
   status.textContent='Copy unavailable. The value is selected; use your device’s Copy command.';
  }
 });
}

// Header labels never enter copied article code.
for (const button of document.querySelectorAll('.idor-article-content [data-code-copy]')) {
 const code = document.getElementById(button.dataset.codeCopy);
 if (!code) continue;
 const status = button.parentElement.querySelector('[data-code-status]');
 let reset;
 button.hidden = false;
 button.addEventListener('click', async () => {
  clearTimeout(reset);
  const text = code.textContent;
  let copied = false;
  try {
   if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true; }
  } catch (_) { /* Continue with the local, selection-based fallback. */ }
  if (!copied) {
   const field = document.createElement('textarea');
   field.value = text; field.setAttribute('aria-hidden', 'true'); field.tabIndex = -1;
   Object.assign(field.style, {position:'fixed',left:'-10000px',top:'0'});
   document.body.append(field); field.select();
   try { copied = document.execCommand('copy'); } catch (_) { /* Offer code selection below. */ }
   field.remove(); button.focus({preventScroll:true});
  }
  if (copied) {
   button.textContent = 'Copied!'; status.textContent = 'Code copied to clipboard.';
   reset = setTimeout(() => { button.textContent = 'Copy'; status.textContent = ''; }, 2200);
  } else {
   const range = document.createRange(); range.selectNodeContents(code);
   const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
   button.textContent = 'Select & copy'; status.textContent = 'Copy unavailable. Code selected; use your keyboard copy command.';
  }
 });
}

// Give wide tables and code an explicit, keyboard-accessible scroll affordance.
for(const region of document.querySelectorAll('.idor-article-content .idor-table-scroll,.idor-article-content .idor-code-block pre')){
 const hint=document.createElement('p');hint.className='idor-scroll-hint';hint.textContent='Scroll horizontally to see more ↔';
 hint.id='idor-scroll-hint-'+document.querySelectorAll('.idor-scroll-hint').length;
 region.before(hint);region.setAttribute('aria-describedby',[region.getAttribute('aria-describedby'),hint.id].filter(Boolean).join(' '));
 const update=()=>{hint.hidden=region.scrollWidth<=region.clientWidth+1;};
 if('ResizeObserver' in window)new ResizeObserver(update).observe(region);else window.addEventListener('resize',update);
 document.fonts?.ready.then(update);update();
}
