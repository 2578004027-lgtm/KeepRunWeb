// Basemap CLabelLayer, native0x1f28c4 /0x1f2f94: the supplied path anchor
// belongs to glyph floor(count/2), not the center of the complete word.
// This ports anchoring and neighbor-derived angles only. Native glyph advance,
// font rasterization, path selection and collision parity remain in progress.
export function nativeRoadGlyphs(points,anchorDistance,advance,count){
 if(points.length<2||!Number.isFinite(anchorDistance)||!Number.isFinite(advance)||advance<=0||!Number.isInteger(count)||count<1)return [];
 const segments=points.slice(1).map((b,i)=>({a:points[i],b,length:Math.hypot(b[0]-points[i][0],b[1]-points[i][1])}));
 const total=segments.reduce((n,s)=>n+s.length,0),middle=Math.floor(count/2);
 const first=anchorDistance-middle*advance,last=first+(count-1)*advance;
 if(first<0||last>total)return [];
 const sample=distance=>{
  for(let i=0;i<segments.length;i++){
   const {a,b,length}=segments[i];
   if(distance<=length||i===segments.length-1){const t=length?Math.max(0,Math.min(1,distance/length)):0;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
   distance-=length;
  }
 };
 const positions=Array.from({length:count},(_,i)=>sample(first+i*advance));
 return positions.map((point,i)=>{
  // Native angles use the neighboring glyph centers; ends use one neighbor.
  const a=count===1?points[0]:positions[Math.max(0,i-1)],b=count===1?points.at(-1):positions[Math.min(count-1,i+1)];
  const angle=Math.trunc(Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI)*Math.PI/180;
  return {point,angle,distance:first+i*advance};
 });
}
