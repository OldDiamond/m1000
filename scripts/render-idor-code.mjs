// Article-specific presentation; keep every byte inside <code> unchanged.
export function renderIdorCodeBlocks(body) {
 let index=0;
 return body.replace(/<pre\b([^>]*)><code\b([^>]*)>([\s\S]*?)<\/code><\/pre>/g,(_,preAttrs,codeAttrs,code)=>{
  const language=/class="[^"]*language-([\w-]+)/.exec(codeAttrs)?.[1];
  const label=language==='powershell'?'PowerShell':language==='bash'?'Terminal · bash':language==='http'?(code.trimStart().startsWith('HTTP/')?'HTTP response':'HTTP request'):language==='python'?'Python · lab/app.py':'Code';
  const id='idor-code-'+(++index);
  return '<div class="idor-code-block"><div class="idor-code-header">'
   +'<span class="idor-code-dots" aria-hidden="true"><i></i><i></i><i></i></span>'
   +'<span class="idor-code-label" id="'+id+'-label">'+label+'</span>'
   +'<button class="idor-code-copy" type="button" data-code-copy="'+id+'" aria-label="Copy '+label+' code" hidden>Copy</button>'
   +'<span class="article-sr-only" role="status" data-code-status></span></div>'
   +'<pre'+preAttrs+'><code id="'+id+'"'+codeAttrs+'>'+code+'</code></pre></div>';
 });
}
