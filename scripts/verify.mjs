import fs from 'node:fs';
import path from 'node:path';
const pages=JSON.parse(fs.readFileSync('src/pages.json'));let checks=0;const failures=[];
for(const page of pages){
 const file=path.join('dist',page.route,'index.html');const html=fs.readFileSync(file,'utf8');checks++;
 if(/<!--(?:COMPONENT|HEADER)|{{displayName}}/.test(html))failures.push(page.route+': unresolved component');
 for(const [,href]of html.matchAll(/(?:href|src)="(\/[^"\s]*)"/g)){
  const target=href.split(/[?#]/)[0];if(!target)continue;const loc=path.join('dist',target);const exists=fs.existsSync(loc)||fs.existsSync(path.join(loc,'index.html'));checks++;if(!exists)failures.push(page.route+': missing '+target);
 }
 if(/<script[^>]+src="https?:/.test(html))failures.push(page.route+': third party runtime script');
 for(const [,id]of html.matchAll(/<use[^>]+href="#([^" ]+)"/g)){checks++;if(!html.includes('id="'+id+'"'))failures.push(page.route+': missing SVG definition '+id)}
}
if(failures.length){console.error([...new Set(failures)].join('\n'));process.exitCode=1}else console.log('Verified '+pages.length+' pages and '+checks+' page, internal link, and asset checks.');
