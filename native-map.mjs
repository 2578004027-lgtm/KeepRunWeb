// Native map data and Keep resource 9059. Rendering parity is still being
// calibrated: this module deliberately exposes its incomplete fidelity status.
import {nativeRoadGlyphs} from './native-label-layout.mjs';
import {normalizeMapAppearance} from './map-appearance.mjs';
const WORLD=2**28,requests=new Map();let stylePromise,fontPromise;
let arrowPromise;const arrowTints=new Map();
async function nativeArrow(){
 arrowPromise??=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('地图箭头加载失败，请刷新重试'));im.src='assets/keep-native-road-arrow.png';}).catch(error=>{arrowPromise=null;throw error;});return arrowPromise;
}
function arrowTint(image,color){
 const key=color.join(',');if(arrowTints.has(key))return arrowTints.get(key);
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d');c.drawImage(image,0,0);c.globalCompositeOperation='source-in';c.fillStyle=css(color);c.fillRect(0,0,canvas.width,canvas.height);arrowTints.set(key,canvas);return canvas;
}
async function nativeFont(){
 fontPromise??=new FontFace('RunStudioMapHan','url(assets/RunStudioMapHan-Regular.woff2)',{weight:'400'}).load().then(font=>document.fonts.add(font)).catch(error=>{fontPromise=null;throw new Error('地图字体加载失败，请刷新重试');});
 return fontPromise;
}
export let lastNativeMapDiagnostics=null;
export function quantizeNativePixels(data){for(let i=0;i<data.length;i+=4)for(let k=0;k<3;k++){const levels=k===1?63:31;data[i+k]=Math.round(Math.round(data[i+k]/255*levels)*255/levels);}return data;}
// VectorRoadArrowManager: table at native0x2844d0, linear interpolation
// between zoom levels. Evaluate against the calibrated1280px capture size so
// PNG resolution changes preserve the same composition.
export function nativeArrowScale(factor){const level=Math.log2(factor*(1280/375)/256),low=Math.floor(level),f=level-low,table=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,.3,.4,.5,.7,1,1,1,1,1];const value=i=>i<0?0:table[Math.min(i,table.length-1)];return (value(low)*(1-f)+value(low+1)*f)/(1280/375);}
const css=c=>`rgba(${c[0]},${c[1]},${c[2]},${c[3]/255})`;
const colorOverride=(hex,original)=>hex?[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),original[3]]:original;
const rule=(table,id,z)=>(table[String(id)]||[]).find(v=>v.minZoom<=z&&z<=v.maxZoom);
function pathLength(points){let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);return length;}
function atDistance(points,distance){
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance<=length||i===points.length-1){const t=Math.max(0,Math.min(1,distance/(length||1)));return {point:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],angle:Math.atan2(b[1]-a[1],b[0]-a[0])};}distance-=length;}return {point:points[0],angle:0};
}
export function visibleRoadPath(points,w,h){
 const chains=[];let chain=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1,valid=true;
  for(const [p,q] of [[-dx,a[0]],[dx,w-a[0]],[-dy,a[1]],[dy,h-a[1]]]){
   if(p===0){if(q<0){valid=false;break;}continue;}
   const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi){valid=false;break;}
  }
  if(!valid){if(chain.length>1)chains.push(chain);chain=[];continue;}
  const start=[a[0]+lo*dx,a[1]+lo*dy],end=[a[0]+hi*dx,a[1]+hi*dy];
  if(chain.length&&Math.hypot(chain.at(-1)[0]-start[0],chain.at(-1)[1]-start[1])>.1){chains.push(chain);chain=[];}
  if(!chain.length)chain.push(start);chain.push(end);
 }
 if(chain.length>1)chains.push(chain);chains.sort((a,b)=>pathLength(b)-pathLength(a));const longest=chains[0];if(!longest)return null;
 const center=atDistance(longest,pathLength(longest)/2);if(Math.abs(center.angle)>Math.PI/2)longest.reverse();return longest;
}
function zoomBit(zoom,list){return 1<<Math.max(0,list.indexOf(Math.min(zoom,18)));}
async function mapData(box,zoom){
 const key=box.map(n=>n.toFixed(9)).join(',')+'&zoom='+zoom;
 if(!requests.has(key)){
  const promise=fetch('api/native-map?bbox='+key).then(async r=>{if(!r.ok){const data=await r.json().catch(()=>({}));throw new Error(data.error||'原生地图加载失败，请重试');}return r.json();}).catch(e=>{requests.delete(key);throw e;});
  if(requests.size>=8)requests.delete(requests.keys().next().value);requests.set(key,promise);
 }return requests.get(key);
}
function path(ctx,points,close=false){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath();}
function labelPosition(row,project,w,h){
 if(row.lineGenerated){const curve=visibleRoadPath(row.path.map(project),w,h);if(!curve)return {point:[-1000,-1000],angle:0};return {...atDistance(curve,pathLength(curve)/2),curve};}
 const anchor=project(row.point);let angle=row.angleByte===undefined?0:row.angleByte*Math.PI/128;
 if(angle>Math.PI)angle-=2*Math.PI;if(angle>Math.PI/2)angle-=Math.PI;if(angle< -Math.PI/2)angle+=Math.PI;
 // Retain the native anchor when it is visible. For path-only labels whose
 // anchor lies outside the viewport, select an interior path segment.
 if(row.path&&(anchor[0]<0||anchor[0]>w||anchor[1]<0||anchor[1]>h)){
  const p=row.path.map(project),segments=[];
  for(let i=1;i<p.length;i++){const [a,b]=[p[i-1],p[i]],x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;if(x>20&&x<w-20&&y>20&&y<h-20)segments.push({point:[x,y],angle:Math.atan2(b[1]-a[1],b[0]-a[0]),length:Math.hypot(b[0]-a[0],b[1]-a[1])});}
  segments.sort((a,b)=>b.length-a.length);if(segments.length){const s=segments[0];angle=s.angle;if(angle>Math.PI/2)angle-=Math.PI;if(angle< -Math.PI/2)angle+=Math.PI;return {point:s.point,angle};}
 }return {point:anchor,angle};
}
export async function drawNativeMap(ctx,rect,geometry,{quantize=true,appearance={}}={}){
 const look=normalizeMapAppearance(appearance);
 if(!geometry.factor)throw new Error('请先选择地点或导入带经纬度的轨迹');
 const zoom=Math.max(11,Math.min(20,Math.ceil(Math.log2(geometry.factor/256))));
 const box=[geometry.centerX-rect.w/geometry.factor/2,geometry.centerY-rect.h/geometry.factor/2,geometry.centerX+rect.w/geometry.factor/2,geometry.centerY+rect.h/geometry.factor/2];
 stylePromise??=fetch('assets/keep-native-style.json').then(r=>{if(!r.ok)throw new Error('原生地图样式读取失败');return r.json();}).catch(e=>{stylePromise=null;throw e;});
 const [data,style,,arrowImage]=await Promise.all([mapData(box,zoom),stylePromise,nativeFont(),nativeArrow()]);
 const ratio=Math.max(1,Math.abs(ctx.getTransform().a)),canvas=document.createElement('canvas');canvas.width=Math.ceil(rect.w*ratio);canvas.height=Math.ceil(rect.h*ratio);
 const c=canvas.getContext('2d',{willReadFrequently:true});c.scale(ratio,ratio);c.fillStyle=css(colorOverride(look.mapGroundColor,rule(style.polygons,1,zoom)?.fill||[248,244,240,255]));c.fillRect(0,0,rect.w,rect.h);c.lineCap='round';c.lineJoin='round';
 const bit=zoomBit(zoom,data.levelZooms),project=(block,point,unit=block.unit)=>[(block.origin[0]+point[0]*unit)/WORLD-geometry.centerX,(block.origin[1]+point[1]*unit)/WORLD-geometry.centerY].map((v,i)=>v*geometry.factor+(i?rect.h:rect.w)/2);
 let shapes=0,labels=0;const labelRows=[],drawnLabels=[],drawnArrows=[];
 for(const block of data.blocks){
  for(const layer of block.geometries){
   if(!(layer.flags&bit)||![0,10,13].includes(layer.kind))continue;
   // Named areas carry a separate style for every polygon. The header style
   // is zero, so using it drops entire parks and other named land parcels.
   for(const shape of layer.shapes){const r=rule(style.polygons,shape.style,zoom);if(!r||shape.points.length<3)continue;path(c,shape.points.map(p=>project(block,p)),true);if(r.fill[3]){const green=r.fill[1]-r.fill[0]>4&&r.fill[1]-r.fill[2]>4;c.fillStyle=css(colorOverride(green?look.mapParkColor:shape.style===1?look.mapGroundColor:null,r.fill));c.fill('evenodd');}if(r.width>0&&r.stroke[3]){c.lineWidth=r.width;c.strokeStyle=css(r.stroke);c.stroke();}shapes++;}
  }
 }
 for(const block of data.blocks){
  for(const layer of block.geometries){
   if(!(layer.flags&bit)||![1,16].includes(layer.kind))continue;
   const r=rule(style.lines,layer.style,zoom);if(!r)continue;
   const raw=r.raw.match(/../g).map(v=>parseInt(v,16)),colorA=raw.slice(2,6);
   // Native parser0x163964 pairs color@raw2 with width@raw6, and
   // color@raw10 with width@raw14. Draw the outer pair before the core.
   // Reversing the widths erased style264: opaque core2, outer width0.
   c.save();c.globalAlpha=look.mapRoadOpacity;
   for(const shape of layer.shapes){if(shape.points.length<2)continue;path(c,shape.points.map(p=>project(block,p,layer.kind===16?1:block.unit)));for(const [color,width] of [[r.color,r.float14],[colorA,r.float6]])if(width>0&&color[3]){c.lineWidth=width*look.mapRoadScale;c.strokeStyle=css(colorOverride(look.mapRoadColor,color));c.stroke();}shapes++;}c.restore();
  }
  for(const row of block.labels){if(!(row.flags&bit))continue;const ref=rule(style.features,row.style,zoom),r=ref&&rule(style.texts,ref.reference,zoom);if(r&&r.fill[3])labelRows.push({row,r,block,road:false});}
  for(const original of block.lineNames||[]){if(!(original.flags&bit)||!(original.zoomMask&bit))continue;const r=rule(style.texts,original.style,zoom);if(r&&r.fill[3])labelRows.push({row:{...original,lineGenerated:true},r,block,road:true});}
  for(const row of block.roads){if(!(row.flags&bit))continue;const r=rule(style.texts,row.style,zoom);if(r&&r.fill[3])labelRows.push({row,r,block,road:true});}
 }
 // CRoadArrowLayer positions and direction bytes come from the map block.
 // Android's SDK loader selects mapcfg_* @2x assets (Tencent tx.a / er.r).
 // Screen size is calibrated to the supplied 1280px reference. Full native
 // culling/automatic placement is still under verification.
 const arrowScale=nativeArrowScale(geometry.factor)*look.mapArrowScale;
 for(const block of data.blocks)for(const arrow of look.mapArrows?(block.arrows||[]):[]){
  if(!(arrow.flags&bit))continue;
  const r=rule(style.arrows||{},arrow.style,zoom)||rule(style.arrows||{},0,zoom);if(!r||r.value!==162||!r.color[3])continue;
  const [x,y]=project(block,arrow.point),w=arrowImage.width*arrowScale,h=arrowImage.height*arrowScale;if(x< -h||y< -h||x>rect.w+h||y>rect.h+h)continue;
  const angle=Math.PI/2-arrow.angleByte*Math.PI/128;c.save();c.translate(x+.5/ratio,y+.5/ratio);c.rotate(angle);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='low';c.drawImage(arrowTint(arrowImage,r.color),-w/2,-h/2,w,h);c.restore();drawnArrows.push({style:arrow.style,point:[x,y],angleByte:arrow.angleByte});
 }
 for(const candidate of labelRows){candidate.position=labelPosition(candidate.row,p=>project(candidate.block,p),rect.w,rect.h);candidate.span=candidate.position.curve?pathLength(candidate.position.curve):0;}
 // Prefer the longest visible stretch when a road has multiple label sources
 // or parallel lanes. This avoids choosing a short driveway over the road.
 labelRows.sort((a,b)=>(a.row.priorityRaw??50000)-(b.row.priorityRaw??50000)||Number(b.road)-Number(a.road)||Number(!!b.row.lineGenerated)-Number(!!a.row.lineGenerated)||b.span-a.span);
 const occupied=[],seen=new Set(),seenRoads=new Set();
 for(const {row,r,block,road,position} of look.mapLabels?labelRows:[]){
  if(road&&seenRoads.has(row.text))continue;
  // The style's high packed field is halo width, not character spacing.
  // Native0x8553c/0x855cc routes it to colorOutline. Do not spread glyphs
  // using this value; the other packed layout fields remain uninterpreted.
  const fontSize=r.size*look.mapLabelScale,weight=look.mapLabelWeight==='auto'?(r.nativeTextFlags&2?'700':'400'):look.mapLabelWeight==='bold'?'700':'400';
  c.font=`${weight} ${fontSize}px RunStudioMapHan`;const spacing=0,chars=[...row.text],width=c.measureText(row.text).width,height=fontSize+2;
  const curve=position.curve,length=curve?pathLength(curve):0;if(curve&&length<width+8)continue;
  const nativeCjk=curve&&/^[\u3400-\u9fff\uf900-\ufaff]+$/u.test(row.text),advance=width/chars.length;
  // If a named place occupies the middle of a road, slide the road label
  // along that same road before trying a different lane or omitting it.
  const candidates=curve?[0,-width,width,-2*width,2*width].map(offset=>length/2+offset).filter(d=>d>=width/2+2&&d<=length-width/2-2).map(distance=>({...atDistance(curve,distance),distance})):[position];
  let selected;
  for(const candidate of candidates){
   const glyphs=nativeCjk?nativeRoadGlyphs(curve,candidate.distance,advance,chars.length):null;
   if(nativeCjk&&!glyphs.length)continue;
   const visualPoint=glyphs?glyphs.reduce((p,g)=>[p[0]+g.point[0]/glyphs.length,p[1]+g.point[1]/glyphs.length],[0,0]):candidate.point;
   const [x,y]=visualPoint,angle=road?candidate.angle:0;if(x<0||y<0||x>rect.w||y>rect.h)continue;
   const bw=Math.abs(width*Math.cos(angle))+Math.abs(height*Math.sin(angle)),bh=Math.abs(width*Math.sin(angle))+Math.abs(height*Math.cos(angle));
   // Retain the existing anchor envelope while covering the shifted glyphs.
   // Native collision ranking is not yet ported; a glyph-placement correction
   // must not silently open a formerly occupied candidate near another label.
   const bounds=[Math.min(x,candidate.point[0])-bw/2-3,Math.min(y,candidate.point[1])-bh/2-2,Math.max(x,candidate.point[0])+bw/2+3,Math.max(y,candidate.point[1])+bh/2+2],key=row.text+':'+Math.round(x/45)+':'+Math.round(y/45);
   if(seen.has(key)||occupied.some(b=>bounds[0]<b[2]&&bounds[2]>b[0]&&bounds[1]<b[3]&&bounds[3]>b[1]))continue;
   selected={...candidate,bounds,key,glyphs,visualPoint};break;
  }
  if(!selected)continue;
  const {point:[x,y],angle,bounds,key}=selected;
  const stroke=r.stroke[3]&&(r.haloWidth||0)>0;
  seen.add(key);if(road)seenRoads.add(row.text);occupied.push(bounds);c.save();c.globalAlpha=look.mapLabelOpacity;c.textAlign='center';c.textBaseline='middle';c.lineWidth=2*(r.haloWidth||0)*look.mapLabelScale;c.strokeStyle=css(r.stroke);c.fillStyle=css(colorOverride(look.mapLabelColor,r.fill));
  if(selected.glyphs){chars.forEach((char,i)=>{const glyph=selected.glyphs[i];c.save();c.translate(...glyph.point);c.rotate(glyph.angle);if(stroke)c.strokeText(char,0,0);c.fillText(char,0,0);c.restore();});}
  else if(curve){let along=selected.distance-width/2;for(const char of chars){const cw=c.measureText(char).width,position=atDistance(curve,along+cw/2);c.save();c.translate(...position.point);c.rotate(position.angle);if(stroke)c.strokeText(char,0,0);c.fillText(char,0,0);c.restore();along+=cw+spacing;}}
  else{c.translate(x,y);c.rotate(road?angle:0);if(spacing){let offset=-width/2;for(const char of chars){const cw=c.measureText(char).width;if(stroke)c.strokeText(char,offset+cw/2,0);c.fillText(char,offset+cw/2,0);offset+=cw+spacing;}}else{if(stroke)c.strokeText(row.text,0,0);c.fillText(row.text,0,0);}}
  c.restore();labels++;drawnLabels.push({text:row.text,style:row.style,point:[x,y],visualPoint:selected.visualPoint,road,fromLine:!!row.lineGenerated,glyphAnchor:selected.glyphs?'middle-index':'word-center'});
 }
 // Standalone maps can quantize here. The completion renderer passes false
 // and converts the complete map+route+markers together, matching capture.
 if(quantize){const pixels=c.getImageData(0,0,canvas.width,canvas.height);quantizeNativePixels(pixels.data);c.putImageData(pixels,0,0);}
 // Canvas exposes a float32 transform: e.g.1280/375 can become slightly
 // larger, making ceil allocate1281px. Crop the source to its exact painted
 // extent instead of shrinking that padded pixel and blurring every icon.
 ctx.drawImage(canvas,0,0,rect.w*ratio,rect.h*ratio,rect.x,rect.y,rect.w,rect.h);
 lastNativeMapDiagnostics={fidelity:'IN_PROGRESS',provider:data.provider,styleResource:data.styleResource,zoom,blocks:data.blocks.map(b=>[b.idx,b.lv,b.bn]),shapes,labels,drawnLabels,drawnArrows,arrowScale,arrowReferenceDifference:data.blocks.some(b=>b.idx===136&&b.lv===0&&b.bn===14084)?'Jinan reference fixture: one extra visible candidate and two missing reference arrows; cause not established.':undefined,unsupported:[...new Set(data.blocks.flatMap(b=>b.unsupported))]};
 return lastNativeMapDiagnostics;
}
