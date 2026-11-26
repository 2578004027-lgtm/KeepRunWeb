import {inflateRawSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const runFile=promisify(execFile),world=2**28;
const indexPromise=readFile(new URL('assets/keep-native-index.json',import.meta.url),'utf8').then(JSON.parse);
const cache=new Map();
class Reader{
 constructor(bytes){this.b=bytes;this.p=0;}
 take(n){if(!Number.isSafeInteger(n)||n<0||this.p+n>this.b.length)throw new Error('Native map data is truncated');const v=this.b.subarray(this.p,this.p+n);this.p+=n;return v;}
 u8(){return this.take(1)[0];}u16(){return this.take(2).readUInt16LE();}i16(){return this.take(2).readInt16LE();}u24(){return this.take(3).readUIntLE(0,3);}u32(){return this.take(4).readUInt32LE();}
 tag(t){return this.b.subarray(this.p,this.p+4).toString('ascii')===t;}
}
function packedPoint(r){const v=r.u24();return [v&4095,v>>>12];}
function geometryPoints(r,n,direct=false){
 if(n<1||n>4095)throw new Error('Invalid native geometry count');
 if(direct)return Array.from({length:n},()=>[r.u16(),r.u16()]);
 let [x,y]=packedPoint(r);const points=[[x,y]];
 for(let i=1;i<n;i++){if(r.b[r.p]===127){r.u8();[x,y]=packedPoint(r);}else{const d=r.take(2);x+=d.readInt8(0);y+=d.readInt8(1);}points.push([x,y]);}return points;
}
function roadGroup(r,n){
 if(n>100000)throw new Error('Invalid native label count');
 const rows=Array.from({length:n},()=>{const h=r.u24();return {style:h&4095,chars:(h>>>12)&15,angleByte:h>>>16,point:packedPoint(r)};});
 for(const row of rows)row.text=r.take(row.chars*2).toString('utf16le');return rows;
}
export function decodeVectorPayload(payload){
 const table=new Reader(payload),n=table.u32();if(n>4096)throw new Error('Invalid native layer count');
 const offsets=Array.from({length:n+1},()=>table.u32());
 if(offsets[0]!==table.p||offsets.at(-1)>payload.length||offsets.some((v,i)=>i&&v<=offsets[i-1]))throw new Error('Invalid native layer offsets');
 const geometries=[],labels=[],roads=[],lineNames=[],arrows=[],unsupported=new Set();
 for(let i=0;i<n;i++){
  const raw=payload.subarray(offsets[i],offsets[i+1]),r=new Reader(raw),kind=r.u8(),flags=r.u8(),style=r.u16()&4095;
  if([0,1,10,13,16].includes(kind)){
   let counts,styles,feature=null;
   if(kind===10||kind===13){const count=r.u32();if(count>50000)throw new Error('Invalid shape count');const h=Array.from({length:count},()=>r.u24());counts=h.map(v=>v&4095);styles=h.map(v=>v>>>12);}
   else{feature=r.u32();const count=r.u32();if(count>50000)throw new Error('Invalid shape count');counts=Array.from({length:count},()=>r.u16()&4095);styles=counts.map(()=>style);}
   const shapes=counts.map((count,j)=>({style:styles[j],points:geometryPoints(r,count,kind===16)}));
   geometries.push({layer:i,kind,flags,style,feature,shapes});
   if(kind===1&&r.p<raw.length){
    const nameStyle=r.u16(),n=shapes.length;
    const readNames=()=>{const counts=[...r.take(n)];return counts.map(c=>r.take(c*2).toString('utf16le'));};
    const first=readNames(),properties=Array.from({length:n},()=>r.u32()),second=r.p<raw.length?readNames():[];
    const effective=second.some(Boolean)?second:first;
    let alternateStyleRaw=null,alternate=[];
    if(r.tag('EXRN')){r.take(4);alternateStyleRaw=r.u16();alternate=readNames();}
    // Keep road style separate from text style: native0x15cb64 groups names
    // by the former before joining paths and generating label candidates.
    for(let j=0;j<n;j++)if(effective[j])lineNames.push({layer:i,roadStyle:style,style:nameStyle&4095,zoomMask:nameStyle>>>12||7,text:effective[j],flags,priorityRaw:50000-properties[j],path:shapes[j].points,alternate:alternate[j]||'',alternateStyleRaw});
   }
  }else if(kind===5){
   const count=r.u32();if(count>100000)throw new Error('Invalid native arrow count');
   for(let j=0;j<count;j++)arrows.push({layer:i,style,flags,angleByte:r.u8(),point:packedPoint(r)});
  }else if(kind===2){
   const count=r.u32();if(count>100000)throw new Error('Invalid point label count');
   const group=Array.from({length:count},()=>{const h=r.u24();return {style:h&4095,chars:(h>>>16)&31,firstLine:(h>>>12)&15,placement:h>>>21,point:packedPoint(r),flags,layer:i};});
   for(const item of group)item.text=r.take(item.chars*2).toString('utf16le');
   if(r.tag('EXTP')){r.take(4);if(r.u32()!==count)throw new Error('Invalid label priority count');for(const item of group)item.priorityRaw=r.u32();}
   labels.push(...group);
  }else if(kind===3){
   const main=roadGroup(r,r.u32());
   if(r.tag('EXTP')){r.take(4);if(r.u32()!==main.length)throw new Error('Invalid road priority count');for(const item of main)item.priorityRaw=r.u32();}
   if(r.tag('EXTD')){r.take(4);r.u32();}
   let paths=[];
   if(r.tag('EXTF')){
    r.take(4);paths=roadGroup(r,r.u32());for(const item of paths)item.priorityRaw=r.u32();
    const counts=[...r.take(paths.length)];
    for(let j=0;j<paths.length;j++){
     if(!counts[j])throw new Error('Invalid road path');let x=r.i16(),y=r.i16();const points=[[x,y]];
     for(let k=1;k<counts[j];k++){if(r.b[r.p]===127){r.u8();x=r.i16();y=r.i16();}else{const b=r.take(2);x+=b.readInt8(0);y+=b.readInt8(1);}points.push([x,y]);}paths[j].path=points;
    }
   }
   roads.push(...main.map(v=>({...v,flags,layer:i})),...paths.map(v=>({...v,flags,layer:i})));
  }else unsupported.add(kind);
 }
 return {geometries,labels,roads,lineNames,arrows,unsupported:[...unsupported].sort((a,b)=>a-b)};
}
export function decodeNativeBlock(bytes,expected){
 if(bytes.length<32||bytes.toString('ascii',12,16)!=='TXVM')throw new Error('Invalid native map header');
 for(let i=0;i<3;i++)if(bytes.readUInt32LE(i*4)!==expected[i])throw new Error('Native map block identity mismatch');
 if(bytes.readUInt32LE(24)!==bytes.length-32)throw new Error('Native map block size mismatch');
 if(bytes.length===32)return null;
 const payload=inflateRawSync(bytes.subarray(32),{maxOutputLength:16*1024*1024});return decodeVectorPayload(payload);
}
async function requestBlock(idx,lv,bn){
 const key=`${idx}/${lv}/${bn}`;if(cache.has(key))return cache.get(key);
 const job=(async()=>{
  const url=`https://vectorsdk.map.qq.com/mvd_map?df=3&idx=${idx}&lv=${lv}&bn=${bn}`;let bytes;
  try{const response=await fetch(url,{headers:{'User-Agent':'QQ Map Mobile'},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Native map provider unavailable');bytes=Buffer.from(await response.arrayBuffer());}
  catch(error){
   if(process.platform!=='win32')throw error;
   const result=await runFile('python',['-X','utf8','-c',"import sys,urllib.request,base64; r=urllib.request.urlopen(urllib.request.Request(sys.argv[1],headers={'User-Agent':'QQ Map Mobile'}),timeout=15); sys.stdout.buffer.write(base64.b64encode(r.read(4000001)))",url],{windowsHide:true,timeout:18000,maxBuffer:5400000});bytes=Buffer.from(result.stdout,'base64');
  }
  if(bytes.length>4000000)throw new Error('Native map block too large');return decodeNativeBlock(bytes,[idx,lv,bn]);
 })();if(cache.size>=48)cache.delete(cache.keys().next().value);cache.set(key,job);
 try{return await job;}catch(error){cache.delete(key);throw error;}
}
export async function nativeMapView(box,zoom){
 if(box.length!==4||box.some(v=>!Number.isFinite(v)||v<0||v>1)||box[0]>=box[2]||box[1]>=box[3]||!Number.isInteger(zoom)||zoom<11||zoom>20)throw new Error('原生地图需要有效范围，缩放级别为 11–20');
 const index=await indexPromise;
 // Follow the retrieved map catalogue. The SDK contains an optional shifted
 // mode; enabling it without evidence dropped reference POIs and park detail.
 const level=index.levels.find(l=>l.zooms.includes(Math.min(zoom,18)));
 if(!level)throw new Error('此缩放级别尚未校准');
 const cell=level.worldCell,worldBox=box.map(v=>v*world),jobs=[];
 for(const d of index.directories){
  if(zoom<d.minZoom||Math.min(zoom,18)>d.maxZoom)continue;
  const [l,t,r,b]=d.bbox;if(r<=worldBox[0]||l>=worldBox[2]||b<=worldBox[1]||t>=worldBox[3])continue;
  const columns=Math.floor((r-1)/cell)-Math.floor(l/cell)+1;
  const sx=Math.floor(Math.max(l,worldBox[0])/cell),ex=Math.floor(Math.min(r-1,worldBox[2])/cell),sy=Math.floor(Math.max(t,worldBox[1])/cell),ey=Math.floor(Math.min(b-1,worldBox[3])/cell);
  if(jobs.length+(ex-sx+1)*(ey-sy+1)>20)throw new Error('地图范围过大，请放大后重试');
  for(let y=sy;y<=ey;y++)
   for(let x=sx;x<=ex;x++){
    const bn=(y-Math.floor(t/cell))*columns+x-Math.floor(l/cell);
    jobs.push({idx:d.index,lv:level.level,bn,origin:[x*cell,y*cell],unit:2**(20-level.baseZoom)});
   }
 }
 if(jobs.length>20)throw new Error('地图范围过大，请放大后重试');
 const blocks=[];
 // Bound concurrency to four downloads; empty adjacent city blocks are valid.
 for(let i=0;i<jobs.length;i+=4)await Promise.all(jobs.slice(i,i+4).map(async j=>{const data=await requestBlock(j.idx,j.lv,j.bn);if(data)blocks.push({...j,...data});}));
 if(!blocks.length)throw new Error('该区域暂无可用的原生地图数据，请选择其他底图');
 blocks.sort((a,b)=>a.idx-b.idx||a.bn-b.bn);
 return {provider:'Tencent native vector',styleResource:9059,zoom,level:level.level,levelZooms:level.zooms,blocks,
  fidelity:'IN_PROGRESS',limitations:['部分图层、文字避让与原图对齐仍在校准']};
}
