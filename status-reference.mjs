// All analysis runs locally. The uploaded pixels, not a device catalogue,
// define the bar. Font matching is only used for newly requested digits.
const FONTS = ['DeviceRoboto', 'DeviceSF', 'Arial', 'Segoe UI', 'KeepSans']
  .flatMap(family => [400, 500, 600, 700].map(weight => [family, weight]));
const templates = new Map();
const images = new Map();
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)] || 0;
function groups(values, min=1) {
  const result=[]; let start=-1;
  for(let i=0;i<=values.length;i++) {
    if(i<values.length && values[i]>=min) { if(start<0) start=i; }
    else if(start>=0) { result.push({start,end:i}); start=-1; }
  }
  return result;
}
function sample(mask,w,box) {
  const out=[];
  for(let y=0;y<36;y++) for(let x=0;x<24;x++)
    out.push(mask[Math.floor(box.y+(y+.5)*box.h/36)*w+Math.floor(box.x+(x+.5)*box.w/24)] || 0);
  return out;
}
function distance(a,b) { return a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length; }
function template(char,family,weight) {
  const key=`${char}/${family}/${weight}`;
  if(templates.has(key)) return templates.get(key);
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=120;
  const c=canvas.getContext('2d'); c.font=`${weight} 64px "${family}"`; c.fillText(char,15,90);
  const data=c.getImageData(0,0,120,120).data, mask=new Uint8Array(14400);
  let left=120,right=0,top=120,bottom=0;
  for(let y=0;y<120;y++) for(let x=0;x<120;x++) if(data[(y*120+x)*4+3]>100) {
    mask[y*120+x]=1; left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
  }
  const box={x:left,y:top,w:right-left+1,h:bottom-top+1};
  const out={sample:sample(mask,120,box),aspect:box.w/box.h,height:box.h,canvas,box};
  templates.set(key,out); return out;
}
export function readImage(src) {
  if(!images.has(src)) {
    if(images.size>=6) images.delete(images.keys().next().value);
    const promise=new Promise((resolve,reject)=>{
      const im=new Image(); if(/^https?:/i.test(src)) im.crossOrigin='anonymous';
      im.onload=()=>resolve(im); im.onerror=()=>{images.delete(src);reject(new Error('截图读取失败'));}; im.src=src;
    });
    images.set(src,promise);
  }
  return images.get(src);
}
function bounds(mask,w,h,g,top,bottom) {
  let y0=h,y1=0;
  for(let y=top;y<bottom;y++) for(let x=g.start;x<g.end;x++) if(mask[y*w+x]) { y0=Math.min(y0,y); y1=Math.max(y1,y); }
  return {x:g.start,y:y0,w:g.end-g.start,h:y1-y0+1};
}
function isColon(mask,w,b) {
  const rows=[];
  for(let y=b.y;y<b.y+b.h;y++) { let n=0; for(let x=b.x;x<b.x+b.w;x++) n+=mask[y*w+x]; rows.push(n); }
  const dots=groups(rows);
  return dots.length===2 && dots.every(g=>g.end-g.start<=b.w*1.9+1)
    && dots[1].start-dots[0].end>=Math.max(1,b.h*.15);
}
async function matchClock(mask,w,boxes) {
  const colon=boxes.length===5?2:1, digits=boxes.filter((_,i)=>i!==colon);
  let best=null;
  for(const [family,weight] of FONTS) {
    let score=0,text='';
    for(const b of digits) {
      const real=sample(mask,w,b); let match={score:Infinity};
      for(let n=0;n<10;n++) {
        const t=template(String(n),family,weight),d=distance(real,t.sample)+.25*Math.abs(b.w/b.h-t.aspect);
        if(d<match.score) match={score:d,char:String(n)};
      }
      text+=match.char; score+=match.score;
    }
    const value=text.slice(0,-2)+':'+text.slice(-2);
    if(Number(text.slice(0,-2))>23 || Number(text.slice(-2))>59) continue;
    score/=digits.length;
    if(!best || score<best.score) best={score,text:value,family,weight};
  }
  return best;
}
export async function analyzeStatusScreenshot(src) {
  const im=await readImage(src),W=im.width,H=im.height;
  if(W<80 || H<8 || W>12000 || H>40000) throw new Error('请使用宽度 80–12000 像素的手机截图');
  const w=Math.min(960,W),scale=w/W,h=Math.min(Math.ceil(H*scale),Math.ceil(w*.22));
  const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
  const c=canvas.getContext('2d',{willReadFrequently:true}); c.drawImage(im,0,0,W,h/scale,0,0,w,h);
  const data=c.getImageData(0,0,w,h).data;
  const rgbAt=(x,y)=>[0,1,2].map(k=>data[(Math.min(h-1,y)*w+Math.min(w-1,x))*4+k]);
  const edge=[];
  for(let y=0;y<Math.min(h,w*.1);y+=2) for(const x of [1,Math.floor(w*.015),Math.floor(w*.985),w-2]) edge.push(rgbAt(x,y));
  const bg=[0,1,2].map(k=>median(edge.map(p=>p[k]))),bgLum=bg.reduce((a,b)=>a+b)/3;
  const mask=new Uint8Array(w*h),rows=Array(h).fill(0),cutoutRows=Array(h).fill(0);
  for(let y=0;y<h;y++) for(let x=2;x<w-2;x++) {
    const L=(data[(y*w+x)*4]+data[(y*w+x)*4+1]+data[(y*w+x)*4+2])/3;
    if(Math.abs(L-bgLum)>60) { mask[y*w+x]=1; rows[y]++; }
    if(x>w*.3 && x<w*.7 && L<bgLum-12) cutoutRows[y]++;
  }
  const bands=groups(rows.map((n,y)=>n+(cutoutRows[y]>w*.08?cutoutRows[y]:0)),Math.max(3,w*.007));
  const first=bands.find(b=>b.end-b.start>=3 && b.start<w*.14);
  let start=first?.start ?? 0, end=first?.end ?? Math.min(h,Math.round(w*.075));
  // Merge island + text when they overlap vertically, never merge a distant toolbar.
  for(const b of bands) if(b.start>=start && b.start<=end+w*.012 && b.end<=w*.18) end=Math.max(end,b.end);
  const cropHeight=H/W<.25?H:Math.min(H,Math.max(Math.round(W*.07),Math.min(Math.round((end+w*.027)/scale),Math.round(W*.19))));
  const columns=Array(w).fill(0);
  for(let x=0;x<w;x++) for(let y=start;y<end;y++) columns[x]+=mask[y*w+x];
  const cols=groups(columns,Math.max(1,Math.round(w/600))).filter(g=>g.end-g.start>=1);
  const boxes=cols.map(g=>bounds(mask,w,h,g,start,end));
  await Promise.all(FONTS.map(([family,weight])=>document.fonts.load(`${weight} 64px "${family}"`)));
  const candidates=[];
  for(let i=0;i<boxes.length;i++) for(const count of [5,4]) {
    const chunk=boxes.slice(i,i+count),ci=count===5?2:1;
    if(chunk.length!==count || !isColon(mask,w,chunk[ci])) continue;
    const digits=chunk.filter((_,j)=>j!==ci),heights=digits.map(b=>b.h),mh=median(heights);
    if(mh<w*.014 || mh>w*.08 || Math.max(...heights)>Math.min(...heights)*1.35) continue;
    if(chunk[ci].w>mh*.35 || digits.some(b=>b.w>mh*.95)) continue;
    if(chunk.some((b,j)=>j && (b.x-chunk[j-1].x-chunk[j-1].w>mh*.7))) continue;
    if(Math.max(...digits.map(b=>b.y))-Math.min(...digits.map(b=>b.y))>mh*.2) continue;
    const match=await matchClock(mask,w,chunk);
    if(match && match.score<.29) candidates.push({...match,boxes:chunk,index:i});
  }
  // A valid HH:MM contains an H:MM suffix. Prefer the complete clock so its
  // leading zero is not left behind during editing.
  const complete=candidates.filter(a=>!candidates.some(b=>b!==a && b.index<a.index
    && b.index+b.boxes.length===a.index+a.boxes.length && b.score<a.score+.06));
  complete.sort((a,b)=>a.score-b.score);
  const best=complete[0];
  let clockBox=null,glyphs=[],font=null,originalTime=null,editBounds=null,foreground=bgLum<128?'#eee':'#444';
  if(best) {
    const bs=best.boxes;
    const left=bs[0].x,right=bs.at(-1).x+bs.at(-1).w,top=Math.min(...bs.map(b=>b.y)),bottom=Math.max(...bs.map(b=>b.y+b.h));
    clockBox={x:Math.floor(left/scale),y:Math.floor(top/scale),w:Math.ceil((right-left)/scale),h:Math.ceil((bottom-top)/scale)};
    originalTime=best.text;
    glyphs=bs.map((b,i)=>({char:originalTime[i],x:b.x/scale,y:b.y/scale,w:b.w/scale,h:b.h/scale}));
    font={family:best.family,weight:best.weight,size:clockBox.h/W*375,x:clockBox.x/W*375,y:(clockBox.y+clockBox.h)/W*375};
    const prev=boxes[best.index-1],next=boxes[best.index+bs.length];
    editBounds={left:Math.max(0,(prev?prev.x+prev.w+2:left-2)/scale),right:Math.min(W,(next?next.x-2:right+Math.max(3,clockBox.w*.15*scale))/scale)};
    const ink=[];
    for(let y=top;y<bottom;y++) for(let x=left;x<right;x++) if(mask[y*w+x]) ink.push(rgbAt(x,y));
    foreground=`rgb(${[0,1,2].map(k=>median(ink.map(p=>p[k]))).join(',')})`;
  }
  return {src,width:W,height:H,cropHeight,clockBox,originalTime,font,glyphs,editBounds,foreground,
    background:`rgb(${bg.join(',')})`,keepOriginal:true,confidence:best?'auto':'crop-only'};
}
function cleanClock(c,box,bounds,W,H,neededRight) {
  const x=Math.max(0,Math.floor(box.x-2)),y=Math.max(0,Math.floor(box.y-2));
  const right=Math.min(W,Math.ceil(Math.max(box.x+box.w+2,Math.min(neededRight,bounds?.right||neededRight)))),bottom=Math.min(H,Math.ceil(box.y+box.h+2));
  // Interpolate the untouched pixels on both sides, retaining flat/gradient backgrounds.
  const leftPixels=c.getImageData(Math.max(0,x-1),y,1,bottom-y).data;
  const rightPixels=c.getImageData(Math.min(W-1,right),y,1,bottom-y).data;
  for(let row=0;row<bottom-y;row++) {
    const offset=row*4,gradient=c.createLinearGradient(x,0,right,0);
    gradient.addColorStop(0,`rgb(${leftPixels.slice(offset,offset+3).join(',')})`);
    gradient.addColorStop(1,`rgb(${rightPixels.slice(offset,offset+3).join(',')})`);
    c.fillStyle=gradient; c.fillRect(x,y+row,right-x,1);
  }
  return {x,y,w:right-x,h:bottom-y};
}
export async function drawRealStatus(c,s) {
  const source=s.completion.device.source;
  if(!source) return false;
  const im=await readImage(source.src),W=source.width,H=source.cropHeight;
  let value=s.completion.clock;
  if(source.originalTime?.length===4) value=value.replace(/^0/,'');
  if(source.keepOriginal || !source.clockBox || source.clockBox.y>=H || !source.font || (value===source.originalTime&&(s.completion.device.fontScale||1)===1)) {
    c.drawImage(im,0,0,W,H,0,0,375,H/W*375); return true;
  }
  const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
  const out=canvas.getContext('2d'); out.drawImage(im,0,0,W,H,0,0,W,H);
  const b=source.clockBox,f=source.font;
  await document.fonts.load(`${f.weight||400} 64px "${f.family}"`);
  const glyphs=source.glyphs||[], digitHeight=median(glyphs.filter(g=>g.char!==':').map(g=>g.h))||b.h;
  const factor=s.completion.device.fontScale||1,parts=[];
  for(const char of value) {
    const real=glyphs.find(g=>g.char===char),t=real?null:template(char,f.family,f.weight);
    const height=(real?real.h:char===':'?digitHeight*.7:digitHeight)*factor;
    parts.push({char,real,t,w:(real?real.w:t.aspect*(height/factor))*factor,h:height});
  }
  const gap=median(glyphs.slice(1).map((g,i)=>g.x-glyphs[i].x-glyphs[i].w))||b.h*.1;
  const total=parts.reduce((n,p)=>n+p.w,0)+gap*(parts.length-1);
  const editHeight=Math.max(b.h,b.h*factor),editBox={...b,y:Math.max(0,b.y-(editHeight-b.h)/2),h:Math.min(H,editHeight)};
  editBox.h=Math.min(editBox.h,H-editBox.y);
  const area=cleanClock(out,editBox,source.editBounds,W,H,b.x+b.w+2);
  out.save(); out.beginPath(); out.rect(area.x,area.y,area.w,area.h); out.clip();
  const fit=Math.min(1,b.w/total);
  let x=b.x;
  for(const p of parts) {
    const width=p.w*fit,height=p.h,y=b.y+(b.h-height)/2;
    if(p.real) {
      const g=p.real;
      out.drawImage(im,g.x-1,g.y-1,g.w+2,g.h+2,x-fit,y-fit,width+2*fit,height+2*fit);
    } else {
      const t=p.t,ink=document.createElement('canvas');ink.width=ink.height=120;
      const ic=ink.getContext('2d'); ic.drawImage(t.canvas,0,0);ic.globalCompositeOperation='source-in';
      ic.fillStyle=source.foreground||'#444';ic.fillRect(0,0,120,120);
      out.drawImage(ink,t.box.x-1,t.box.y-1,t.box.w+2,t.box.h+2,x-width/t.box.w,y-height/t.box.h,width*(1+2/t.box.w),height*(1+2/t.box.h));
    }
    x+=width+gap*fit;
  }
  out.restore();c.drawImage(canvas,0,0,W,H,0,0,375,H/W*375);return true;
}
