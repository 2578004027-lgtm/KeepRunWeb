import {bindPlaceSearch,placeViewport} from './place-search.mjs';
import {mapAppearanceMarkup,syncMapAppearance,bindMapAppearance} from './map-appearance-controls.mjs';
import {refineCircle,generateLoop,parseWalkNetwork,snapCircleToRoads} from './loop-generator.mjs';
import {renderRoutePreview,routeGeometry} from './renderer.mjs';
import {hasGeo,parseGPX,parseCSV,parseGeoJSON,applyRoute,importConfig} from './model.mjs';
import {KEEP_COLORS,routeStyleDefaults,worldToGeo,gcjToWgs,wgsToGcj,rasterImage} from './route-style.mjs';
import {readImage} from './status-reference.mjs';

export function createRouteEditor({getState,onApply,readFile,toast}){
 const dialog=document.createElement('dialog');dialog.id='route-editor';dialog.className='route-dialog';
 const range=(key,label,min,max,step=1)=>`<label class="route-control">${label}<output data-value="${key}"></output><input data-route="${key}" type="range" min="${min}" max="${max}" step="${step}"></label>`;
 dialog.innerHTML=`<div class="route-dialog-heading"><div><h2>画个圈，生成跑步路线</h2><p>圈出大致形状，自动细化路线、圈数与沿途配速</p></div><div class="circle-heading-actions"><button type="button" id="circle-advanced">地图与细节微调</button><button type="button" id="route-close" aria-label="关闭地图编辑器">×</button></div></div>
 <div class="route-dialog-body"><section class="route-workspace">
  <section class="place-search" role="search" aria-label="选择跑步地点"><label for="place-query">选择跑步地点</label><div class="place-search-row"><input id="place-query" type="search" maxlength="120" placeholder="城市、公园或学校，例如：公园名称" autocomplete="off"><button id="place-search-button" type="button">搜索地点</button></div><p id="place-search-status" role="status"></p><div id="place-results" class="place-results" hidden></div><button id="circle-reference-place" type="button">在示例底图重新画圈</button></section>
 <div class="circle-controls"><label>目标距离（公里）<input id="circle-distance" type="number" min="0.1" max="100" step="0.01"></label><label>平均配速<input id="circle-pace" placeholder="5:00"></label><button id="circle-demo" type="button">看看画圈效果</button></div>
  <div class="circle-options"><label>细化方式 <select id="circle-mode"><option value="smooth" selected>按圈线细化（默认）</option><option value="roads">沿可通行道路贴合 · 联网</option><option value="auto">自动 · 根据底图选择</option></select></label><label id="circle-calibration">原图单圈长度（米）<input id="circle-lap" type="number" min="80" max="20000" value="400"></label></div>
  <p id="circle-summary" class="circle-summary">按住在地图上画一个圈，松手自动生成。先看示范也可以。</p>
  <div class="route-tools" role="toolbar" aria-label="路线编辑工具">
   <button data-tool="circle" class="active">一笔画圈</button><button data-tool="pan">移动视图</button><button data-tool="draw">画路线</button><button data-tool="edit">拖动节点</button><button data-tool="erase">删节点</button><button data-tool="pace">涂配速</button>
  </div><div class="route-canvas-wrap"><canvas id="route-canvas" aria-label="地图路线编辑画布"></canvas><div id="route-editor-loading" hidden>正在绘制地图…</div></div>
  <p id="route-editor-hint" class="route-editor-hint" role="status"></p>
  <div class="route-operations"><button id="route-undo">↶ 撤销</button><button id="route-redo">↷ 重做</button><button id="route-fit">适应画布</button><button id="route-reverse">反转方向</button><button id="route-new-segment">另起一段</button><button id="route-empty">清空路线</button></div>
  <div id="route-pace-brush" hidden><label>分段配速：<select id="pace-brush"><option value="0">慢 · 红色</option><option value="0.5" selected>正常 · 绿色</option><option value="1">快 · 青色</option></select></label><span>沿路线涂抹即可修改颜色；有时间戳的轨迹默认按实际配速着色。</span></div>
 </section><aside class="route-sidebar">
  <div class="field"><label for="editor-map-mode">地图来源</label><select id="editor-map-mode"><option value="image">示例 / 上传的地图原图</option><option value="keep-native">Keep 风格 · 可编辑地图</option><option value="amap">高德地图 · 中文道路</option><option value="osm">OpenStreetMap</option><option value="none">纯色底图</option></select></div>
  <div class="route-small-actions"><button id="editor-keep-map">恢复示例底图</button><label class="button" for="editor-map-file">上传地图<input id="editor-map-file" type="file" accept="image/png,image/jpeg,image/webp" hidden></label></div>
  <label class="check-row"><input id="editor-embedded" type="checkbox">原图已经包含路线</label>
  <div id="raster-route-note" class="info-box" hidden>当前是合成图片，可调路线颜色和深浅。修改线形时，先修补去除原路线，再绘制新路线。<button id="editor-clean-map" class="button subtle full">修补底图，绘制新路线</button><small>路线下方的背景为估算修补，可撤销恢复。</small></div>
  <label class="file-button" for="editor-route-file">导入 GPX / CSV / GeoJSON<input id="editor-route-file" type="file" accept=".gpx,.csv,.json,.geojson" hidden></label>
  ${mapAppearanceMarkup(range)}
  <div class="route-preset-buttons"><button data-look="keep">Keep 配色</button><button data-look="soft">浅色路线</button><button data-look="bold">醒目路线</button></div>
  <div class="field"><label for="editor-color-mode">路线着色</label><select id="editor-color-mode"><option value="solid">单色</option><option value="pace">按配速渐变</option><option value="original">保留原图颜色</option></select></div>
  <div class="route-color-grid"><label>路线色<input data-route="color" type="color"></label><label>慢<input data-route="slowColor" type="color"></label><label>正常<input data-route="normalColor" type="color"></label><label>快<input data-route="fastColor" type="color"></label></div>
  ${range('opacity','路线透明度',.05,1,.05)}${range('shade','路线深浅（左深右浅）',.3,1.7,.05)}${range('width','线条粗细',1,10,.25)}${range('outline','白色描边',0,5,.25)}
  <div class="field"><label for="editor-markers">起终点与标记</label><select id="editor-markers"><option value="dots">Keep 圆点</option><option value="labels">起终点与公里数</option><option value="none">不显示</option></select></div>
  <details class="extra-settings"><summary>地图明暗与视角</summary>${range('mapFade','底图淡化',0,.85,.05)}${range('mapSaturation','底图色彩',0,2,.05)}${range('mapBrightness','底图亮度',.5,1.5,.05)}${range('scale','视图缩放',.15,5,.05)}<p class="helper">拖动地图选择绘制位置；也可用经纬度定位地图中心。</p><div class="field-row"><label>纬度<input id="editor-center-lat" type="number" step="0.0001" value="39.90"></label><label>经度<input id="editor-center-lon" type="number" step="0.0001" value="116.40"></label></div><button id="editor-center" class="button subtle full">定位地图中心</button>
   <div class="field"><label for="editor-coordinates">轨迹坐标系</label><select id="editor-coordinates"><option value="wgs84">WGS84 · GPX / GPS</option><option value="gcj02">GCJ-02 · 高德 / Keep 导出</option></select></div>
  </details>
  <details class="extra-settings"><summary>配速映射范围</summary><div class="field-row"><label>快（秒/公里）<input data-route="fastPace" type="number" min="30" max="3599"></label><label>慢（秒/公里）<input data-route="slowPace" type="number" min="60" max="3600"></label></div><button id="route-auto-pace" class="button subtle full">清除手涂配速，恢复自动计算</button></details>
  <p class="helper">Keep 原图保留截图细节；可编辑地图支持选址与外观自定义。不同手机的显示差异可按预览调整。</p>
 </aside></div><footer class="route-dialog-footer"><span id="route-editor-stats"></span><div><button id="route-cancel" class="button subtle">取消</button><button id="route-apply" class="button primary">应用到图片</button></div></footer>`;
 document.body.append(dialog);
 const $=id=>dialog.querySelector('#'+id),canvas=$('route-canvas'),ctx=canvas.getContext('2d');
 let outline=[],generated=null,generating=false,generationId=0;let draft=null,initial=null,tool='circle',history=[],future=[],last=null,paintId=0,paintTimer=null,drag=null,pendingBreak=false,closed=true,revision=0;
 function checkpoint(){history.push(structuredClone(draft.route));if(history.length>40)history.shift();future=[];}
 function mutate(fn){checkpoint();fn();refresh();paint();}
 function refresh(){
  const r=draft.route,embedded=r.mode==='image'&&r.embedded,geo=hasGeo(r.points);
  $('editor-map-mode').value=r.mode;$('editor-embedded').checked=!!r.embedded;$('editor-embedded').disabled=r.mode!=='image';
  $('raster-route-note').hidden=!embedded;$('editor-color-mode').value=r.colorMode;
  $('editor-color-mode').querySelector('[value=original]').disabled=!embedded;$('editor-color-mode').querySelector('[value=pace]').disabled=embedded;
  $('editor-markers').value=r.markers?r.markerStyle:'none';$('editor-markers').disabled=embedded;$('editor-coordinates').value=r.coordinateSystem;
  for(const input of dialog.querySelectorAll('[data-route]')){
   const k=input.dataset.route;input.value=r[k];const output=dialog.querySelector(`[data-value="${k}"]`);if(output)output.textContent=['opacity','mapFade','mapLabelOpacity','mapRoadOpacity'].includes(k)?Math.round(r[k]*100)+'%':Number(r[k]).toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
   input.disabled=embedded&&['width','outline'].includes(k);
  }
  for(const b of dialog.querySelectorAll('[data-tool]')){b.disabled=embedded&&!['pan','circle'].includes(b.dataset.tool);b.classList.toggle('active',b.dataset.tool===tool);}
  $('route-pace-brush').hidden=tool!=='pace';$('route-undo').disabled=!history.length;$('route-redo').disabled=!future.length;
  for(const id of ['route-empty','route-reverse','route-new-segment'])$(id).disabled=embedded;
  $('route-editor-stats').textContent=embedded?'Keep / 上传原图 · 彩色路线分离调整':`${r.points.length} 个节点 · ${geo?'经纬度路线':'手绘路线'}`;
  $('circle-reference-place').hidden=!(r.image==='assets/reference-map.png');$('circle-calibration').hidden=hasGeo(r.points)||['amap','osm','keep-native'].includes(r.mode);const hints={circle:'按住画一个闭合圈，松手后自动细化；不用逐点添加节点。',pan:'拖动移动视图，滚轮缩放。',draw:'点击逐点画线，也可以按住拖动连续绘制。',edit:'拖动圆点调整路线。双击空白位置可插入最近线段。',erase:'点击圆点删除；撤销可恢复。',pace:'先选择慢 / 正常 / 快，再沿路线涂抹。'};
  $('route-editor-hint').textContent=tool==='circle'?hints.circle:embedded?'原图路线可调颜色与深浅；独立绘制前可修补去除原路线。':hints[tool];
  $('route-canvas').style.cursor={circle:'crosshair',pan:'grab',draw:'crosshair',edit:'move',erase:'crosshair',pace:'crosshair'}[tool];
  syncMapAppearance(dialog,r);
 }
 function paint(){
  ++revision;++paintId;clearTimeout(paintTimer);$('route-apply').disabled=true;paintTimer=setTimeout(draw,35);
 }
 async function draw(){
  const id=++paintId;$('route-editor-loading').hidden=false;
  try{
   if(draft.route.fastPace>=draft.route.slowPace)throw new Error('快速配速必须小于慢速配速');
   const result=await renderRoutePreview(structuredClone(draft),1000);if(closed||id!==paintId)return;
   canvas.width=result.canvas.width;canvas.height=result.canvas.height;ctx.drawImage(result.canvas,0,0);last=result;
   if(['edit','erase'].includes(tool)&&!(draft.route.embedded&&draft.route.mode==='image')){
    ctx.save();ctx.scale(canvas.width/375,canvas.width/375);const stride=Math.max(1,Math.ceil(result.geometry.points.length/1000));
    result.geometry.points.forEach((p,i)=>{if(i%stride&&i!==drag?.index)return;ctx.beginPath();ctx.arc(p.px,p.py,2.4,0,Math.PI*2);ctx.fillStyle='#fff';ctx.strokeStyle='#625380';ctx.lineWidth=.9;ctx.fill();ctx.stroke();});ctx.restore();
   }
   if(tool==='circle'&&outline.length){ctx.save();ctx.scale(canvas.width/375,canvas.width/375);ctx.strokeStyle='#7254ad';ctx.lineWidth=1.4;ctx.setLineDash([3,3]);ctx.beginPath();outline.forEach((p,i)=>i?ctx.lineTo(p.x*375,p.y*281.25):ctx.moveTo(p.x*375,p.y*281.25));ctx.stroke();ctx.restore();}$('route-apply').disabled=generating;
  }catch(e){if(id===paintId)$('route-editor-hint').textContent=e.message;}
  finally{if(id===paintId)$('route-editor-loading').hidden=true;}
 }
 function point(event){const b=canvas.getBoundingClientRect();return {x:(event.clientX-b.left)/b.width*375,y:(event.clientY-b.top)/b.height*281.25};}
 function freeze(){if(hasGeo(draft.route.points)&&!draft.route.viewport){const g=routeGeometry(draft,{x:0,y:0,w:375,h:281.25});draft.route.viewport={x:g.centerX,y:g.centerY,factor:g.factor};draft.route.offsetX=draft.route.offsetY=0;}}
 function logical(p){const r=draft.route;
  if((r.points.length&&Number.isFinite(r.points[0].lat))||(['amap','osm','keep-native'].includes(r.mode)&&r.viewport)){const g=routeGeometry(draft,{x:0,y:0,w:375,h:281.25});let v=worldToGeo(g.centerX+(p.x-187.5)/g.factor,g.centerY+(p.y-140.625)/g.factor);if(['amap','keep-native'].includes(r.mode)&&r.coordinateSystem==='wgs84')v=gcjToWgs(v);if(r.mode==='osm'&&r.coordinateSystem==='gcj02')v=wgsToGcj(v);return v;}
  return {x:.5+(p.x/375-.5-r.offsetX)/r.scale,y:.5+(p.y/281.25-.5-r.offsetY)/r.scale};
 }
 function nearest(p){const ps=routeGeometry(draft,{x:0,y:0,w:375,h:281.25}).points;let best={index:-1,d:Infinity};ps.forEach((v,i)=>{const d=Math.hypot(v.px-p.x,v.py-p.y);if(d<best.d)best={index:i,d};});return best;}
 function brush(p){const ps=routeGeometry(draft,{x:0,y:0,w:375,h:281.25}).points;let best={index:-1,d:Infinity};
  for(let i=1;i<ps.length;i++){if(ps[i].break)continue;const a=ps[i-1],b=ps[i],dx=b.px-a.px,dy=b.py-a.py,t=Math.max(0,Math.min(1,((p.x-a.px)*dx+(p.y-a.py)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(p.x-a.px-t*dx,p.y-a.py-t*dy);if(d<best.d)best={index:i,d};}
  if(best.d<16){draft.route.points[best.index].level=Number($('pace-brush').value);draft.route.colorMode='pace';}
 }
 function add(p){const v=logical(p),r=draft.route;if(pendingBreak){v.break=true;pendingBreak=false;}r.points.push(v);r.source='自定义手绘路线';r.embedded=false;}
 canvas.addEventListener('pointerdown',e=>{
  if(!last||generating)return;e.preventDefault();checkpoint();freeze();const p=point(e);drag={start:p,last:p,index:-1,route:structuredClone(draft.route)};canvas.setPointerCapture(e.pointerId);
  if(['draw','edit','erase'].includes(tool)){generated=null;delete draft.route.generated;}if(tool==='circle'){outline=[{x:p.x/375,y:p.y/281.25}];generated=null;}if(tool==='draw')add(p);
  if(tool==='edit'){const near=nearest(p);drag.index=near.d<14?near.index:-1;}
  if(tool==='erase'){const near=nearest(p);if(near.d<14){const old=draft.route.points.splice(near.index,1)[0];if(old.break&&draft.route.points[near.index])draft.route.points[near.index].break=true;}}
  if(tool==='pace')brush(p);refresh();paint();
 });
 canvas.addEventListener('pointermove',e=>{
  if(!drag)return;const p=point(e),r=draft.route;
  if(tool==='circle'){outline.push({x:p.x/375,y:p.y/281.25});drag.last=p;}if(tool==='draw'&&Math.hypot(p.x-drag.last.x,p.y-drag.last.y)>2){add(p);drag.last=p;}
  if(tool==='edit'&&drag.index>=0)Object.assign(r.points[drag.index],logical(p));
  if(tool==='pace')brush(p);
  if(tool==='pan'){
   const dx=p.x-drag.start.x,dy=p.y-drag.start.y,old=drag.route;
   if(r.viewport){r.viewport.x=old.viewport.x-dx/old.viewport.factor;r.viewport.y=old.viewport.y-dy/old.viewport.factor;}
   else{r.offsetX=Math.max(-2,Math.min(2,old.offsetX+dx/375));r.offsetY=Math.max(-2,Math.min(2,old.offsetY+dy/281.25));if(r.mode==='image'){r.mapX=Math.max(-2,Math.min(2,old.mapX+dx/375));r.mapY=Math.max(-2,Math.min(2,old.mapY+dy/281.25));}}
  }refresh();paint();
 });
 const release=()=>{const wasCircle=!!drag&&tool==='circle';drag=null;refresh();paint();if(wasCircle)buildCircle();};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',()=>{drag=null;outline=[];refresh();paint();});
 canvas.addEventListener('dblclick',e=>{if(tool!=='edit')return;const p=point(e),ps=routeGeometry(draft,{x:0,y:0,w:375,h:281.25}).points;let nearest={d:Infinity,i:-1};for(let i=1;i<ps.length;i++){if(ps[i].break)continue;const a=ps[i-1],b=ps[i],dx=b.px-a.px,dy=b.py-a.py,t=Math.max(0,Math.min(1,((p.x-a.px)*dx+(p.y-a.py)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(p.x-a.px-t*dx,p.y-a.py-t*dy);if(d<nearest.d)nearest={d,i};}if(nearest.i>=0)mutate(()=>draft.route.points.splice(nearest.i,0,logical(p)));});
 async function buildCircle(){
  if(generating)return;const id=++generationId;generating=true;$('route-apply').disabled=true;
  const before=structuredClone(draft.route);
  try{
   const ring=refineCircle(outline),pace=$('circle-pace').value.match(/^(\d{1,2}):([0-5]\d)$/);if(!pace)throw new Error('平均配速请填 5:00 这样的格式');
   const seconds=Number(pace[1])*60+Number(pace[2]),target=Number($('circle-distance').value)*1000;
   const geographic=hasGeo(draft.route.points)||(['amap','osm','keep-native'].includes(draft.route.mode)&&draft.route.viewport);
   const toGeo=geographic?p=>logical({x:p.x*375,y:p.y*281.25}):null;
   let roadPoints=null,mode=$('circle-mode').value;
   if(mode==='roads'||(mode==='auto'&&geographic)){
    if(!geographic)throw new Error('这张图片没有地图坐标，请切到高德地图，或选择“按圈线平滑”');
    $('circle-summary').textContent='正在查找可通行道路并构建闭环…';
    const world=ring.map(toGeo).map(p=>draft.route.coordinateSystem==='gcj02'?gcjToWgs(p):p),xs=world.map(p=>p.lon),ys=world.map(p=>p.lat),bbox=[Math.min(...xs)-.0015,Math.min(...ys)-.0012,Math.max(...xs)+.0015,Math.max(...ys)+.0012];
    const response=await fetch('api/walk-network?bbox='+bbox.join(','),{signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error('道路数据暂不可用，请稍后重试；没有自动改成直线路线');
    roadPoints=snapCircleToRoads(world,parseWalkNetwork(await response.text()));if(draft.route.coordinateSystem==='gcj02')roadPoints=roadPoints.map(wgsToGcj);
   }
   if(id!==generationId||closed)return;
   $('circle-summary').textContent='正在细化圈线与分段配速…';
   const result=generateLoop({outline,targetMeters:target,paceSeconds:seconds,lapMeters:Number($('circle-lap').value),toGeo,roadPoints,seed:1});
   let clean=null;if(draft.route.mode==='image'&&draft.route.embedded){const im=await readImage(draft.route.image);clean=rasterImage(im,draft.route,{cleanOnly:true}).toDataURL();}
   if(id!==generationId||closed)return;
   if(clean)draft.route.image=clean;
   const start=Date.parse(draft.date);draft.route.points=result.points.map(p=>({...p,...(!geographic?logical({x:p.x*375,y:p.y*281.25}):{}),time:(Number.isFinite(start)?start:0)+p.elapsed*1000}));
   draft.route.embedded=false;draft.route.rasterEdited=false;draft.route.colorMode='pace';draft.route.opacity=.66;draft.route.shade=1;draft.route.width=3.3;draft.route.outline=0;draft.route.markers=true;draft.route.markerStyle='dots';draft.route.color=KEEP_COLORS.normal;
   draft.route.slowColor=KEEP_COLORS.slow;draft.route.normalColor=KEEP_COLORS.normal;draft.route.fastColor=KEEP_COLORS.fast;draft.route.fastPace=seconds*.88;draft.route.slowPace=seconds*1.12;
   draft.route.generated={...result,points:undefined};draft.route.source=result.source==='roads'?'按圈线沿道路生成':result.source==='image-loop'?'按圈线生成 · 单圈长度按设定估算':'按地图圈线生成';
   generated=draft.route.generated;outline=[];tool='circle';
   const laps=result.completeLaps+(result.partialLap>.01?' 圈＋最后一段':' 圈');
   $('circle-summary').textContent=`已生成 ${(result.distanceMeters/1000).toFixed(2)} 公里 · ${laps} · ${Math.floor(result.durationSeconds/60)} 分 ${Math.round(result.durationSeconds%60)} 秒`+(result.source==='image-loop'?'（单圈按设定长度估算）':result.source==='roads'?' · 已贴合可通行道路':' · 按圈线平滑');
  }catch(e){draft.route=before;generated=null;$('circle-summary').textContent=e.message;}
  finally{if(id===generationId){generating=false;refresh();paint();}}
 }
 $('circle-advanced').addEventListener('click',()=>{const enabled=dialog.classList.toggle('advanced');$('circle-advanced').textContent=enabled?'收起微调':'地图与细节微调';});
 bindMapAppearance(dialog,{mutate,getRoute:()=>draft.route});
 $('circle-demo').addEventListener('click',()=>{checkpoint();const angle=-.28;outline=Array.from({length:100},(_,i)=>{const a=Math.PI/3+i/99*Math.PI*2;return{x:.565+.105*Math.cos(a)*Math.cos(angle)-.25*Math.sin(a)*Math.sin(angle),y:.495+.105*Math.cos(a)*Math.sin(angle)+.25*Math.sin(a)*Math.cos(angle)};});tool='circle';paint();buildCircle();});
 for(const id of ['circle-distance','circle-pace','circle-lap'])$(id).addEventListener('change',()=>{$('circle-summary').textContent='参数已更新，再画一个圈即可重新生成。';});
 function zoom(factor){freeze();const r=draft.route,old=r.scale;r.scale=Math.max(.15,Math.min(5,old*factor));const q=r.scale/old;if(r.viewport)r.viewport.factor*=q;if(r.mode==='image')r.mapScale=Math.max(.3,Math.min(5,r.mapScale*q));}
 canvas.addEventListener('wheel',e=>{e.preventDefault();mutate(()=>zoom(e.deltaY<0?1.12:1/1.12));},{passive:false});
 for(const b of dialog.querySelectorAll('[data-tool]'))b.addEventListener('click',()=>{tool=b.dataset.tool;refresh();paint();});
 for(const input of dialog.querySelectorAll('[data-route]'))input.addEventListener('input',()=>mutate(()=>{
  const k=input.dataset.route,v=input.type==='color'?input.value:Number(input.value);
  if(k==='scale')zoom(v/draft.route.scale);else draft.route[k]=v;
  if(['opacity','shade','color'].includes(k)){draft.route.rasterEdited=true;if(k==='color')draft.route.colorMode='solid';}
 }));
 $('editor-color-mode').addEventListener('change',()=>mutate(()=>{draft.route.colorMode=$('editor-color-mode').value;draft.route.rasterEdited=true;}));
 $('editor-markers').addEventListener('change',()=>mutate(()=>{draft.route.markerStyle=$('editor-markers').value;draft.route.markers=draft.route.markerStyle!=='none';}));
 $('editor-center').addEventListener('click',()=>{const lat=Number($('editor-center-lat').value),lon=Number($('editor-center-lon').value);if(!['amap','osm','keep-native'].includes(draft.route.mode)){toast('请先切换到联网地图');return;}if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180){toast('请输入有效经纬度');return;}mutate(()=>{freeze();const center=['amap','keep-native'].includes(draft.route.mode)?wgsToGcj({lat,lon}):{lat,lon};draft.route.viewport={x:(center.lon+180)/360,y:(1-Math.log(Math.tan(Math.PI/4+center.lat*Math.PI/360))/Math.PI)/2,factor:draft.route.viewport?.factor||2**24};draft.route.offsetX=draft.route.offsetY=0;});});
$('editor-coordinates').addEventListener('change',()=>mutate(()=>{draft.route.coordinateSystem=$('editor-coordinates').value;draft.route.viewport=null;}));
 $('editor-embedded').addEventListener('change',()=>mutate(()=>{draft.route.embedded=$('editor-embedded').checked;draft.route.colorMode=draft.route.embedded?'original':'solid';tool='pan';}));
 $('editor-map-mode').addEventListener('change',async()=>{
  const mode=$('editor-map-mode').value;
  if(mode==='image'&&!draft.route.image){$('editor-map-file').click();refresh();return;}
  mutate(()=>{
   const oldMode=draft.route.mode,oldGeometry=routeGeometry(draft,{x:0,y:0,w:375,h:281.25}),geographic=['amap','osm','keep-native'].includes(mode);
   draft.route.mode=mode;draft.route.viewport=null;
   if(geographic){
    if(oldGeometry.factor&&Number.isFinite(oldGeometry.centerX)){
     let center=worldToGeo(oldGeometry.centerX,oldGeometry.centerY);
     if(['amap','keep-native'].includes(oldMode))center=gcjToWgs(center);
     if(['amap','keep-native'].includes(mode))center=wgsToGcj(center);
     draft.route.viewport={x:(center.lon+180)/360,y:(1-Math.log(Math.tan(Math.PI/4+center.lat*Math.PI/360))/Math.PI)/2,factor:oldGeometry.factor};
    }else draft.route.viewport=placeViewport(draft.route.place||{lat:39.90,lon:116.40},mode);
    draft.route.scale=1;draft.route.offsetX=draft.route.offsetY=0;
    if(!hasGeo(draft.route.points)){
     draft.route.points=[];draft.route.points=oldGeometry.points.map(p=>({...logical({x:p.px,y:p.py}),...(p.break?{break:true}:{}),...(p.level!==undefined?{level:p.level}:{})}));draft.route.source='在地图上手绘';
    }
   }
   if(mode!=='image'){draft.route.embedded=false;if(draft.route.colorMode==='original')draft.route.colorMode='solid';}
   if(mode==='keep-native'){draft.route.mapSaturation=1;draft.route.mapBrightness=1;draft.route.mapFade=0;}
   if(mode==='amap'){draft.route.mapSaturation=.55;draft.route.mapBrightness=1.06;draft.route.mapFade=.18;}
  });
 });
 for(const b of dialog.querySelectorAll('[data-look]'))b.addEventListener('click',()=>mutate(()=>{
  const r=draft.route;r.color=KEEP_COLORS.normal;r.slowColor=KEEP_COLORS.slow;r.normalColor=KEEP_COLORS.normal;r.fastColor=KEEP_COLORS.fast;r.markerStyle='dots';r.markers=true;
  r.colorMode=r.embedded?'original':'pace';r.width=b.dataset.look==='bold'?5:3.5;r.opacity=b.dataset.look==='soft'?.45:b.dataset.look==='bold'?1:.9;r.shade=b.dataset.look==='bold'?.8:1;r.outline=b.dataset.look==='bold'?1:0;r.rasterEdited=true;
 }));
 $('route-fit').addEventListener('click',()=>mutate(()=>{const r=draft.route;r.scale=r.mapScale=1;r.offsetX=r.offsetY=r.mapX=r.mapY=0;if(r.points.length||!['amap','osm','keep-native'].includes(r.mode))r.viewport=null;
  if(r.points.length&&!hasGeo(r.points)){const xs=r.points.map(p=>p.x),ys=r.points.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;r.scale=Math.min(4,.76/Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),.1));r.offsetX=(.5-cx)*r.scale;r.offsetY=(.5-cy)*r.scale;}
 }));
 $('route-empty').addEventListener('click',()=>mutate(()=>{freeze();draft.route.points=[];}));
 $('route-new-segment').addEventListener('click',()=>{pendingBreak=true;tool='draw';refresh();$('route-editor-hint').textContent='下一笔将另起一段，不连接上一段。';paint();});
 $('route-auto-pace').addEventListener('click',()=>mutate(()=>{draft.route.points.forEach(p=>delete p.level);draft.route.colorMode='pace';}));
 $('route-reverse').addEventListener('click',()=>mutate(()=>{const segments=[];let current=[];for(const p of draft.route.points){if(p.break&&current.length){segments.push(current);current=[];}current.push(p);}if(current.length)segments.push(current);draft.route.points=segments.reverse().flatMap((seg,si)=>{const levels=seg.map(p=>p.level);return seg.reverse().map((p,i)=>{const out={...p};delete out.time;delete out.break;delete out.level;if(i>0&&levels[seg.length-i]!==undefined)out.level=levels[seg.length-i];if(si&&i===0)out.break=true;return out;});});draft.route.source='反转后的路线（已清除原时间戳）';}));
 $('route-undo').addEventListener('click',()=>{if(history.length){future.push(structuredClone(draft.route));draft.route=history.pop();refresh();paint();}});
 $('route-redo').addEventListener('click',()=>{if(future.length){history.push(structuredClone(draft.route));draft.route=future.pop();refresh();paint();}});
 $('editor-keep-map').addEventListener('click',()=>mutate(()=>{draft.route={...draft.route,mode:'image',image:'assets/reference-map.png',embedded:false,colorMode:'pace',rasterEdited:false,opacity:1,shade:1,mapX:0,mapY:0,mapScale:1,mapFade:0,mapSaturation:1,mapBrightness:1};tool='pan';}));
 $('editor-map-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;$('route-apply').disabled=true;try{const src=await readFile(file);mutate(()=>{draft.route.image=src;draft.route.mode='image';draft.route.embedded=true;draft.route.rasterEdited=false;draft.route.colorMode='original';draft.route.mapScale=1;draft.route.mapX=draft.route.mapY=0;tool='pan';});}catch(e){toast(e.message);paint();}finally{e.target.value='';}});
 $('editor-route-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;$('route-apply').disabled=true;try{if(file.size>30*1024*1024)throw new Error('轨迹文件不能超过 30 MB');const text=await file.text(),points=/\.gpx$/i.test(file.name)?parseGPX(text):/\.csv$/i.test(file.name)?parseCSV(text):parseGeoJSON(JSON.parse(text));mutate(()=>{applyRoute(draft,points,file.name,false);draft.route.mode='amap';draft.route.mapSaturation=.55;draft.route.mapBrightness=1.06;draft.route.mapFade=.18;draft.route.colorMode='pace';draft.route.markerStyle='dots';draft.route.markers=true;});}catch(e){toast(e.message);paint();}finally{e.target.value='';}});
 $('editor-clean-map').addEventListener('click',async()=>{$('route-apply').disabled=true;try{const revisionBefore=revision;const im=await readImage(draft.route.image);const cleaned=rasterImage(im,draft.route,{cleanOnly:true}).toDataURL();if(closed||revision!==revisionBefore)return;mutate(()=>{draft.route.image=cleaned;draft.route.embedded=false;draft.route.points=[];draft.route.viewport=null;draft.route.colorMode='pace';draft.route.markers=true;draft.route.markerStyle='dots';draft.route.rasterEdited=false;draft.route.source='在修补底图上手绘';tool='draw';});}catch(e){toast(e.message);paint();}});
 const selectPlace=(place,explicitViewport=null)=>{
 ++generationId;generating=false;outline=[];generated=null;last=null;
 mutate(()=>{const mode=explicitViewport?'keep-native':draft.route.mode==='osm'||place.lon<72||place.lon>138||place.lat<.8||place.lat>56?'osm':draft.route.mode==='keep-native'?'keep-native':'amap';
   draft.route={...draft.route,place:structuredClone(place),mode,image:null,embedded:false,rasterEdited:false,points:[],viewport:explicitViewport?structuredClone(explicitViewport):placeViewport(place,mode),coordinateSystem:'wgs84',scale:1,offsetX:0,offsetY:0,mapScale:1,mapX:0,mapY:0,mapFade:mode==='keep-native'?0:.18,mapSaturation:mode==='keep-native'?1:.55,mapBrightness:mode==='keep-native'?1:1.06,colorMode:'pace',markerStyle:'dots',markers:true,source:'在 '+place.name+' 画圈'};
   delete draft.route.generated;tool='circle';
   $('editor-center-lat').value=place.lat;$('editor-center-lon').value=place.lon;
   $('circle-summary').textContent='地点已选好，画一个大致闭合圈，松手自动细化。';
 });
};
const placeSearch=bindPlaceSearch({dialog,toast,onSelect:selectPlace});
$('circle-reference-place').addEventListener('click',()=>{
 ++generationId;generating=false;outline=[];generated=null;last=null;
 mutate(()=>{draft.route={...draft.route,mode:'image',image:'assets/reference-map.png',embedded:false,points:[],place:null,viewport:null,scale:1,offsetX:0,offsetY:0,mapScale:1,mapX:0,mapY:0,colorMode:'pace',source:'人工生成演示底图'};tool='circle';});
 placeSearch.reset(null);$('circle-mode').value='smooth';$('circle-summary').textContent='示例底图已载入，画一个圈即可生成；地图不对应真实地址。';
});
const cancel=()=>{placeSearch.cancel();closed=true;++generationId;generating=false;++paintId;clearTimeout(paintTimer);dialog.close();};
 $('route-close').addEventListener('click',cancel);$('route-cancel').addEventListener('click',cancel);dialog.addEventListener('cancel',cancel);
 $('route-apply').addEventListener('click',async()=>{try{const checked=importConfig(draft);await onApply(checked.route,generated);cancel();toast('地图与路线已应用');}catch(e){toast(e.message);}});
 dialog.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();$(e.shiftKey?'route-redo':'route-undo').click();}});
 return {open({appearance=false}={}){dialog.classList.toggle('advanced',appearance);$('circle-advanced').textContent=appearance?'收起微调':'地图与细节微调';$('map-appearance').open=appearance;initial=getState();draft=structuredClone(initial);draft.route={...routeStyleDefaults(),...draft.route};if(draft.route.embedded&&!draft.route.rasterEdited)draft.route.colorMode='original';history=[];future=[];last=null;tool=appearance?'pan':'circle';closed=false;pendingBreak=false;outline=[];generated=null;generating=false;$('circle-distance').value=Math.max(.1,Number(draft.distance)||3).toFixed(2);const duration=String(draft.duration).split(':').reduce((a,v)=>a*60+Number(v),0),savedPace=draft.metrics.find(m=>m.id==='pace')?.valueStr?.match(/(\d+)\D+(\d{2})/),pace=savedPace?Number(savedPace[1])*60+Number(savedPace[2]):Math.round(duration/Math.max(.1,draft.distance))||300;$('circle-pace').value=Math.floor(pace/60)+':'+String(pace%60).padStart(2,'0');$('circle-summary').textContent='按住画一个大致的圈，松手自动生成。也可以先点“看看画圈效果”。';placeSearch.reset(draft.route.place);dialog.showModal();dialog.querySelector('.route-dialog-body').scrollTop=0;refresh();paint();},getDraft:()=>structuredClone(draft)};
}
