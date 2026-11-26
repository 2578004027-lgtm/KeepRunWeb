import {haversine} from './model.mjs';
import {NATURAL_LOOP_PROFILE} from './natural-loop-profile.mjs';
const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const profile=NATURAL_LOOP_PROFILE.map(([x,y])=>({a:(Math.atan2(y,x)+Math.PI*2)%(Math.PI*2),r:Math.hypot(x,y)})).sort((a,b)=>a.a-b.a);
function referenceRadius(a){a=(a+Math.PI*2)%(Math.PI*2);let i=profile.findIndex(p=>p.a>=a);if(i<0)i=0;const right=profile[i],left=profile[(i-1+profile.length)%profile.length];let aa=a,ra=right.a,la=left.a;if(ra<la)ra+=Math.PI*2;if(aa<la)aa+=Math.PI*2;return left.r+(right.r-left.r)*(aa-la)/(ra-la||1);}
function retainNaturalShape(points){
 const c={x:points.reduce((n,p)=>n+p.x,0)/points.length,y:points.reduce((n,p)=>n+p.y,0)/points.length};
 let xx=0,yy=0,xy=0;for(const p of points){xx+=(p.x-c.x)**2;yy+=(p.y-c.y)**2;xy+=(p.x-c.x)*(p.y-c.y);}
 const a=.5*Math.atan2(2*xy,xx-yy);let major={x:Math.cos(a),y:Math.sin(a)};if(major.y<0)major={x:-major.x,y:-major.y};const minor={x:major.y,y:-major.x};
 const projected=points.map(p=>({u:(p.x-c.x)*minor.x+(p.y-c.y)*minor.y,v:(p.x-c.x)*major.x+(p.y-c.y)*major.y}));
 const rx=Math.max(...projected.map(p=>Math.abs(p.u))),ry=Math.max(...projected.map(p=>Math.abs(p.v))),blend=ry/rx>1.25?.72:.38;
 return projected.map(p=>{const u=p.u/rx,v=p.v/ry,r=Math.hypot(u,v)||1,angle=Math.atan2(v,u),desired=r*(1-blend)+referenceRadius(angle)*blend;return {x:c.x+minor.x*p.u*desired/r+major.x*p.v*desired/r,y:c.y+minor.y*p.u*desired/r+major.y*p.v*desired/r};});
}
function noise(t,seed){const hash=n=>{const v=Math.sin(n*127.1+seed*311.7)*43758.5453;return (v-Math.floor(v))*2-1;};const n=Math.floor(t),f=t-n,s=f*f*(3-2*f);return hash(n)+(hash(n+1)-hash(n))*s;}
function resample(points,count,closed=true){
 const ps=points.map(p=>({...p}));if(closed&&dist(ps[0],ps.at(-1))>.00001)ps.push({...ps[0]});
 const lengths=[0];for(let i=1;i<ps.length;i++)lengths.push(lengths.at(-1)+dist(ps[i-1],ps[i]));
 const total=lengths.at(-1);if(total<.001)throw new Error('圈线太小，请在地图上圈出跑步范围');
 const out=[];let j=1;
 for(let i=0;i<count;i++){const at=total*i/(closed?count:count-1);while(j<lengths.length-1&&lengths[j]<at)j++;const t=(at-lengths[j-1])/(lengths[j]-lengths[j-1]||1);out.push({x:ps[j-1].x+(ps[j].x-ps[j-1].x)*t,y:ps[j-1].y+(ps[j].y-ps[j-1].y)*t});}
 return out;
}
function area(ps){return Math.abs(ps.reduce((sum,p,i)=>{const q=ps[(i+1)%ps.length];return sum+p.x*q.y-q.x*p.y;},0)/2);}
export function refineCircle(input){
 let ps=input.filter((p,i)=>!i||dist(input[i-1],p)>.0005).map(p=>({x:p.x,y:p.y}));
 if(ps.length<5)throw new Error('请按住画出一个完整的圈，再松手生成');
 const perimeter=ps.slice(1).reduce((n,p,i)=>n+dist(ps[i],p),0),gap=dist(ps[0],ps.at(-1));
 if(gap>perimeter*.3)throw new Error('圈线还没闭合，请让终点靠近起点');
 if(area(ps)<.008)throw new Error('圈线太窄，请圈出一个有面积的跑步范围');
 ps=resample(ps,192);
 // Circular low-pass smoothing removes hand tremor without fitting a generic
 // ellipse. The deliberately drawn shape remains recognizable.
 ps=ps.map((p,i)=>{let x=0,y=0,weight=0;for(let d=-2;d<=2;d++){const w=3-Math.abs(d),q=ps[(i+d+ps.length)%ps.length];x+=q.x*w;y+=q.y*w;weight+=w;}return {x:x/weight,y:y/weight};});
 return resample(retainNaturalShape(ps),192);
}
export function generateLoop({outline,targetMeters=3000,paceSeconds=300,lapMeters=500,toGeo=null,roadPoints=null,seed=1,variationMeters=3.5,_travelMeters=null,_distancePass=0}){
 if(!Number.isFinite(targetMeters)||targetMeters<100||targetMeters>100000)throw new Error('目标距离需要 0.1–100 公里');
 if(!Number.isFinite(paceSeconds)||paceSeconds<120||paceSeconds>1200)throw new Error('配速需要 2:00–20:00 /公里');
 let ring=roadPoints?roadPoints.map(p=>({...p})):refineCircle(outline),geo=!!toGeo||!!roadPoints;
 if(!roadPoints&&toGeo)ring=ring.map(toGeo);
 const distance=geo?haversine:dist,closed=[...ring,{...ring[0]}],lengths=[0];
 for(let i=1;i<closed.length;i++)lengths.push(lengths.at(-1)+distance(closed[i-1],closed[i]));
 const rawLength=lengths.at(-1),loopMeters=geo?rawLength:Number(lapMeters);
 if(!Number.isFinite(loopMeters)||loopMeters<80||loopMeters>20000)throw new Error('单圈长度需要 80–20000 米；请调整圈线或地图范围');
 const travelMeters=_travelMeters??targetMeters,factor=loopMeters/rawLength,totalLaps=travelMeters/loopMeters;
 if(targetMeters/loopMeters>50)throw new Error('圈数超过 50，请扩大圈线或减少目标距离');
 // Sample by distance, with only low-frequency sub-metre position variation
 // between laps. No independent random zigzags or arbitrary speed jumps.
 const n=Math.max(100,Math.ceil(targetMeters/3)),points=[];let cursor=1;
 const center=geo?null:{x:ring.reduce((n,p)=>n+p.x,0)/ring.length,y:ring.reduce((n,p)=>n+p.y,0)/ring.length};
 for(let i=0;i<=n;i++){
  const travelled=travelMeters*i/n,phase=(travelled%loopMeters)/factor;
  if(i&&phase<lengths[cursor-1])cursor=1;
  while(cursor<lengths.length-1&&lengths[cursor]<phase)cursor++;
  const t=(phase-lengths[cursor-1])/(lengths[cursor]-lengths[cursor-1]||1),a=closed[cursor-1],b=closed[cursor];
  const p=geo?{lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t}:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  if(!geo){
   const amplitude=Math.min(.016,variationMeters/factor),dx=b.x-a.x,dy=b.y-a.y,den=Math.hypot(dx,dy)||1;
   const drift=noise(travelled/74,seed)+.4*noise(travelled/24,seed+11)+.18*noise(travelled/9,seed+29);
   p.x+=-dy/den*amplitude*drift+amplitude*.38*noise(travelled/130,seed+51);
   p.y+=dx/den*amplitude*drift+amplitude*.38*noise(travelled/115,seed+73);
  }else if(!roadPoints&&variationMeters>0){
   // Mapped freehand loops need the same correlated lap variation as image
   // loops. Keep snapped road routes on their actual network geometry.
   const cos=Math.cos(p.lat*Math.PI/180),dx=(b.lon-a.lon)*cos,dy=b.lat-a.lat,den=Math.hypot(dx,dy)||1,amplitude=Math.min(variationMeters,loopMeters*.012);
   const drift=noise(travelled/74,seed)+.4*noise(travelled/24,seed+11)+.18*noise(travelled/9,seed+29);
   const east=-dy/den*amplitude*drift+amplitude*.38*noise(travelled/130,seed+51),north=dx/den*amplitude*drift+amplitude*.38*noise(travelled/115,seed+73);
   p.lon+=east/(111195.08*cos);p.lat+=north/111195.08;
  }
  // Continuous speed variation, a modest slowdown near the last partial lap.
  p.level=Math.max(.28,Math.min(.88,.63+.16*Math.sin(travelled/180+seed)+.08*Math.sin(travelled/61)-.07*(i/n)**3));
  const q=ring[(cursor-2+ring.length)%ring.length],mid=ring[(cursor-1)%ring.length],next=ring[cursor%ring.length];
  const dx1=geo?(mid.lon-q.lon)*Math.cos(mid.lat*Math.PI/180):mid.x-q.x,dy1=geo?mid.lat-q.lat:mid.y-q.y,dx2=geo?(next.lon-mid.lon)*Math.cos(mid.lat*Math.PI/180):next.x-mid.x,dy2=geo?next.lat-mid.lat:next.y-mid.y;
  p.bend=Math.min(1,Math.acos(Math.max(-1,Math.min(1,(dx1*dx2+dy1*dy2)/(Math.hypot(dx1,dy1)*Math.hypot(dx2,dy2)||1))))/.1);
  p.lap=Math.floor(travelled/loopMeters);p.distance=travelled;points.push(p);
 }
 let actualMeters=geo?points.slice(1).reduce((n,p,i)=>n+haversine(points[i],p),0):targetMeters;
 // Sampling corners and adding correlated GPS variation change measured
 // length. Correct traversal along the same ring, not the displayed number.
 if(geo&&actualMeters>0&&Math.abs(actualMeters-targetMeters)>.05&&_distancePass<4)return generateLoop({outline,targetMeters,paceSeconds,lapMeters,toGeo,roadPoints,seed,variationMeters,_travelMeters:travelMeters*targetMeters/actualMeters,_distancePass:_distancePass+1});
 const duration=actualMeters/1000*paceSeconds;let totalWeight=0;
 const weights=points.map((p,i)=>{if(!i)return 0;const meters=geo?haversine(points[i-1],p):p.distance-points[i-1].distance;const nearby=points.slice(Math.max(0,i-4),i+5),bend=nearby.reduce((n,p)=>n+p.bend,0)/nearby.length;const w=meters*(1+(.63-p.level)*.22+bend*.08+.04*Math.max(0,1-i/n/.04));totalWeight+=w;return w;});
 let elapsed=0;for(let i=0;i<points.length;i++){
  const seconds=weights[i]/totalWeight*duration;elapsed+=seconds;points[i].elapsed=elapsed;
  if(i){const meters=geo?haversine(points[i-1],points[i]):targetMeters/n,localPace=meters>0?seconds/meters*1000:paceSeconds;points[i].level=Math.max(0,Math.min(1,(paceSeconds*1.12-localPace)/(paceSeconds*.24)));}
  delete points[i].distance;
  delete points[i].bend;
 }
 points[0].level=points[1].level;
 return {points,distanceMeters:actualMeters,durationSeconds:duration,paceSeconds,loopMeters,completeLaps:Math.floor(totalLaps),partialLap:totalLaps%1,source:roadPoints?'roads':geo?'mapped-loop':'image-loop'};
}

export function parseWalkNetwork(xml){
 const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw new Error('道路数据解析失败');
 const nodes=new Map([...doc.querySelectorAll('node')].map(n=>[n.getAttribute('id'),{id:n.getAttribute('id'),lat:Number(n.getAttribute('lat')),lon:Number(n.getAttribute('lon'))}]));
 const graph=new Map();
 for(const way of doc.querySelectorAll('way')){
  const tags=Object.fromEntries([...way.querySelectorAll('tag')].map(t=>[t.getAttribute('k'),t.getAttribute('v')]));
  if(!tags.highway||/^(motorway|motorway_link|trunk|trunk_link|construction|proposed|raceway)$/.test(tags.highway)||tags.foot==='no'||['private','no'].includes(tags.access))continue;
  const ids=[...way.querySelectorAll('nd')].map(n=>n.getAttribute('ref'));
  for(let i=1;i<ids.length;i++){const a=nodes.get(ids[i-1]),b=nodes.get(ids[i]);if(!a||!b)continue;for(const [from,to] of [[a,b],[b,a]]){if(!graph.has(from.id))graph.set(from.id,{...from,edges:[]});graph.get(from.id).edges.push({id:to.id,d:haversine(from,to),weight:/^(footway|path|pedestrian|living_street)$/.test(tags.highway)?1:/^(primary|secondary|tertiary)$/.test(tags.highway)?1.6:1.15});}}
 }
 return graph;
}
export function snapCircleToRoads(outline,graph){
 if(graph.size<8)throw new Error('这片区域缺少可通行道路数据，无法可靠生成道路闭环');
 const anchors=outline.filter((_,i)=>i%Math.max(1,Math.floor(outline.length/18))===0),nearest=[];
 // Nearby parallel paths or a bridge may belong to separate components.
 // Pick one connected network for the entire loop before selecting anchors.
 const seen=new Set(),components=[];
 for(const id of graph.keys())if(!seen.has(id)){const stack=[id],ids=[];seen.add(id);while(stack.length){const n=stack.pop();ids.push(n);for(const e of graph.get(n).edges)if(graph.has(e.id)&&!seen.has(e.id)){seen.add(e.id);stack.push(e.id);}}if(ids.length>=5)components.push(ids);}
 let component=null,bestScore=Infinity;
 for(const ids of components){let score=0;for(const p of anchors){let d=Infinity;for(const id of ids)d=Math.min(d,haversine(p,graph.get(id)));score+=d;if(d>160){score=Infinity;break;}}if(score<bestScore){bestScore=score;component=ids;}}
 if(!component)throw new Error('圈选范围没有连通的可通行环路，请调整圈线');
 graph=new Map(component.map(id=>[id,graph.get(id)]));
 for(const p of anchors){let best={d:Infinity};for(const node of graph.values()){const d=haversine(p,node);if(d<best.d)best={d,id:node.id};}if(best.d>160)throw new Error('圈线离已知道路太远，请沿图中的道路重新圈选');if(best.id!==nearest.at(-1))nearest.push(best.id);}
 nearest.push(nearest[0]);const result=[];
 for(let i=1;i<nearest.length;i++){
  const start=nearest[i-1],end=nearest[i],open=new Set([start]),cost=new Map([[start,0]]),previous=new Map();let visits=0;
  while(open.size&&visits++<25000){let id=null,best=Infinity;for(const n of open){const score=cost.get(n)+haversine(graph.get(n),graph.get(end));if(score<best){best=score;id=n;}}if(id===end)break;open.delete(id);
   for(const e of graph.get(id).edges){if(!graph.has(e.id))continue;const next=cost.get(id)+e.d*(e.weight||1);if(next<(cost.get(e.id)??Infinity)){cost.set(e.id,next);previous.set(e.id,id);open.add(e.id);}}
  }
  if(start!==end&&!previous.has(end))throw new Error('圈选道路不连通，请调整范围');
  const path=[end];while(path.at(-1)!==start){const prev=previous.get(path.at(-1));if(!prev||path.length>graph.size)throw new Error('未找到合理闭环');path.push(prev);}path.reverse();
  for(const id of path){if(id===result.at(-1))continue;if(id===result.at(-2))result.pop();else result.push(id);}
 }
 if(result.length<5)throw new Error('这些道路无法形成环线，请圈选有完整环路的区域');
 const ps=result.map(id=>({lat:graph.get(id).lat,lon:graph.get(id).lon}));if(haversine(ps[0],ps.at(-1))>5)throw new Error('未能沿道路闭合');ps.pop();return ps;
}
