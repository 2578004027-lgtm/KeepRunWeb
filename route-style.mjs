// Keep APK assets/outdoor_map_style.json, Street theme.
import {mapAppearanceDefaults} from './map-appearance.mjs';
export const KEEP_COLORS={slow:'#f35252',normal:'#24c789',fast:'#2ce2ff'};
// Keep map endpoint palette; end matches APK color km_color_ff666f.
export const KEEP_MARKER_COLORS={start:'#24c789',end:'#ff666f'};
export const routeStyleDefaults=()=>({...mapAppearanceDefaults(),opacity:1,shade:1,colorMode:'solid',slowColor:KEEP_COLORS.slow,normalColor:KEEP_COLORS.normal,fastColor:KEEP_COLORS.fast,slowPace:480,fastPace:180,outline:0,markerStyle:'labels',mapFade:0,mapSaturation:1,mapBrightness:1,mapScale:1,mapX:0,mapY:0,coordinateSystem:'wgs84',place:null,viewport:null,rasterEdited:false});
export function mixColor(a,b,t){const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));const A=rgb(a),B=rgb(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');}
export function shadeColor(color,amount=1){return amount<1?mixColor('#000000',color,amount):mixColor(color,'#ffffff',Math.min(1,amount-1));}
export function paceColor(level,r){return shadeColor(level<=.5?mixColor(r.slowColor,r.normalColor,level*2):mixColor(r.normalColor,r.fastColor,(level-.5)*2),r.shade);}
export function segmentLevel(a,b,r){
 if(Number.isFinite(b.level))return Math.max(0,Math.min(1,b.level));
 if(Number.isFinite(a.lat)&&Number.isFinite(b.lat)&&Number.isFinite(a.time)&&b.time>a.time){
  const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  const meters=12742017.6*Math.asin(Math.sqrt(Math.min(1,h))),seconds=(b.time-a.time)/1000;
  if(meters>.1){const pace=seconds/meters*1000;return Math.max(0,Math.min(1,(r.slowPace-pace)/(r.slowPace-r.fastPace)));}
 }
 return .5;
}
export function wgsToGcj(p){
 const x=p.lon-105,y=p.lat-35;if(p.lon<72.004||p.lon>137.8347||p.lat<.8293||p.lat>55.8271)return {...p};
 let a=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x));
 a+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;
 a+=(20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3;
 a+=(160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3;
 let b=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));
 b+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;
 b+=(20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3;
 b+=(150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3;
 const rad=p.lat*Math.PI/180,magic=1-.006693421622965943*Math.sin(rad)**2,sqrt=Math.sqrt(magic);
 return {...p,lat:p.lat+a*180/((6378245*(1-.006693421622965943))/(magic*sqrt)*Math.PI),lon:p.lon+b*180/(6378245/sqrt*Math.cos(rad)*Math.PI)};
}
export function gcjToWgs(p){let out={...p};for(let i=0;i<3;i++){const c=wgsToGcj(out);out.lat+=p.lat-c.lat;out.lon+=p.lon-c.lon;}return out;}
export function worldToGeo(x,y){return {lon:x*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI};}

const rasterCache=new Map();
// Detect the saturated red/green/cyan route ink. Reconstruction under that ink
// is a local estimate, never presented as a recovered original street map.
export function rasterLayers(image){
 const key=image.src;if(rasterCache.has(key))return rasterCache.get(key);
 const canvas=document.createElement('canvas');const scale=Math.min(1,1600/image.width);canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
 const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0,canvas.width,canvas.height);
 const {width:w,height:h}=canvas,original=c.getImageData(0,0,w,h),mask=new Uint8Array(w*h);
 let count=0;
 for(let i=0;i<mask.length;i++){
  const [r,g,b]=original.data.slice(i*4,i*4+3),max=Math.max(r,g,b),min=Math.min(r,g,b),sat=(max-min)/Math.max(1,max);
  if(max-min>18&&((sat>.2&&g>r*1.12&&g>b*.7)||(sat>.14&&r>g*1.04&&r>b*1.12&&max<235)||(sat>.25&&r>g*1.3&&r>b*1.3))){mask[i]=1;count++;}
 }
 if(count>mask.length*.3)throw new Error('图片中相近颜色过多，无法可靠分离路线；请使用空白底图或 GPX');
 const expanded=mask.slice(),radius=Math.max(2,Math.round(w/170));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x])for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)expanded[(y+dy)*w+x+dx]=1;
 const clean=new ImageData(new Uint8ClampedArray(original.data),w,h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(expanded[y*w+x]){
  const candidates=[];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])for(let d=1;d<Math.max(50,w*.09);d++){
   const xx=x+dx*d,yy=y+dy*d;if(xx<0||xx>=w||yy<0||yy>=h)break;
   if(!expanded[yy*w+xx]){candidates.push({d,i:(yy*w+xx)*4});break;}
  }
  candidates.sort((a,b)=>a.d-b.d);const nearest=candidates.slice(0,2);const total=nearest.reduce((n,a)=>n+1/a.d,0);
  if(total)for(let k=0;k<3;k++)clean.data[(y*w+x)*4+k]=nearest.reduce((n,a)=>n+original.data[a.i+k]/a.d,0)/total;
 }
 const result={original,clean,mask:expanded,width:w,height:h,count};
 if(rasterCache.size>=3)rasterCache.delete(rasterCache.keys().next().value);rasterCache.set(key,result);return result;
}
export function rasterImage(image,r,{cleanOnly=false}={}){
 if(!cleanOnly&&!r.rasterEdited)return image;
 const parts=rasterLayers(image),canvas=document.createElement('canvas');canvas.width=parts.width;canvas.height=parts.height;
 const pixels=new ImageData(new Uint8ClampedArray(parts.clean.data),parts.width,parts.height);
 if(!cleanOnly)for(let i=0;i<parts.mask.length;i++)if(parts.mask[i]){
  const original=[...parts.original.data.slice(i*4,i*4+3)],base=[...parts.clean.data.slice(i*4,i*4+3)];
  let color=original;
  const strength=Math.min(1,Math.max(...original.map((v,k)=>Math.abs(v-base[k])))/85);
  if(r.colorMode==='solid'){
   const rgb=[1,3,5].map(k=>parseInt(r.color.slice(k,k+2),16));
   color=rgb;
  }
  for(let k=0;k<3;k++){
   const shaded=r.shade<=1?color[k]*r.shade:color[k]+(255-color[k])*(r.shade-1);
   pixels.data[i*4+k]=base[k]+(shaded-base[k])*r.opacity*strength;
  }
 }
 canvas.getContext('2d').putImageData(pixels,0,0);return canvas;
}
