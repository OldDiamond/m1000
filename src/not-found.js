// Original luminance-based square halftone renderer; all media stays on this site.
const background=document.querySelector('.rabbit-background');
const canvas=document.querySelector('.rabbit-canvas');
const toggle=document.querySelector('.motion-toggle');
const context=canvas?.getContext('2d',{alpha:false});
if(context&&background&&toggle){
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const video=document.createElement('video');
 video.muted=true;video.loop=true;video.playsInline=true;video.preload='none';
 const poster=new Image();
 const sample=document.createElement('canvas');
 const pixels=sample.getContext('2d',{willReadFrequently:true});
 let width=0,height=0,columns=0,rows=0,frame=0,lastFrame=0,paused=false,loaded=false;
 const saveData=navigator.connection?.saveData===true;
 const cover=(ctx,source,w,h)=>{
  const sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;
  if(!sw||!sh)return false;
  const scale=Math.max(w/sw,h/sh);
  ctx.drawImage(source,(w-sw*scale)/2,(h-sh*scale)/2,sw*scale,sh*scale);
  return true;
 };
 function paint(){
  const source=video.readyState>=2?video:poster;
  if(!pixels||!width||!height)return;
  if(!cover(pixels,source,columns,rows))return;
  const data=pixels.getImageData(0,0,columns,rows).data;
  context.fillStyle='#080809';context.fillRect(0,0,width,height);
  // Keep the moving tunnel visible underneath its grid of luminance-sized squares.
  context.save();context.filter='grayscale(1) brightness(.42)';
  cover(context,source,width,height);context.restore();
  const stepX=width/columns,stepY=height/rows;
  context.fillStyle='#dbe6f4';
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
   const i=(y*columns+x)*4;
   const light=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;
   const size=Math.max(.55,Math.pow(light,1.45)*stepX*.9);
   context.globalAlpha=.12+light*.68;
   context.fillRect((x+.5)*stepX-size/2,(y+.5)*stepY-size/2,size,size);
  }
  context.globalAlpha=1;background.classList.add('is-rendered');
 }
 function animate(time){
  if(time-lastFrame>=1000/24){paint();lastFrame=time;}
  frame=requestAnimationFrame(animate);
 }
 function updateMotion(){
  cancelAnimationFrame(frame);frame=0;
  const animateVideo=!reducedMotion.matches&&!saveData&&!paused&&!document.hidden;
  if(!animateVideo){video.pause();paint();return;}
  if(!loaded){video.src='/assets/404/rabbit-hole.mp4';loaded=true;}
  video.play().then(()=>{
   if(!reducedMotion.matches&&!paused&&!document.hidden&&!frame)frame=requestAnimationFrame(animate);
  }).catch(()=>{paint();toggle.hidden=true;});
 }
 function resize(){
  const rect=background.getBoundingClientRect();width=rect.width;height=rect.height;
  const ratio=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  context.setTransform(ratio,0,0,ratio,0,0);
  columns=Math.max(1,Math.ceil(width/7));rows=Math.max(1,Math.ceil(height/7));
  sample.width=columns;sample.height=rows;paint();
 }
 toggle.addEventListener('click',()=>{
  paused=!paused;toggle.setAttribute('aria-pressed',String(paused));
  toggle.textContent=paused?'Resume motion':'Pause motion';updateMotion();
 });
 const preferenceChanged=()=>{toggle.hidden=reducedMotion.matches||saveData;updateMotion();};
 reducedMotion.addEventListener('change',preferenceChanged);
 document.addEventListener('visibilitychange',updateMotion);
 new ResizeObserver(resize).observe(background);
 poster.addEventListener('load',()=>{resize();preferenceChanged();});
 poster.src='/assets/404/rabbit-hole.jpg';
 video.addEventListener('error',()=>{toggle.hidden=true;paint();});
 video.addEventListener('loadeddata',paint);
}
