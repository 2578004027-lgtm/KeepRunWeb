import {routeStyleDefaults} from './route-style.mjs';
import {normalizeMapAppearance} from './map-appearance.mjs';
import {DEVICES,deviceDefaults} from './devices.mjs';
export const TEMPLATES = {
  result:{name:'完成详情', width:375, height:null, slots:Infinity, note:'字段按记录顺序显示，支持附加图表和长图'},
  map:{name:'地图卡', width:306, height:306, slots:3, note:'原布局 306 × 306 · 三个数据槽'},
  track:{name:'轨迹海报', width:281, height:500, slots:3, note:'原布局 281 × 500 · 三个数据槽'},
  run:{name:'跑步数据', width:281, height:500, slots:2, note:'原布局 281 × 500 · 公里数与两个数据槽'},
  square:{name:'方形轨迹', width:306, height:306, slots:0, note:'原布局 306 × 306 · 轨迹与公里数'},
  data:{name:'数据海报', width:306, height:408, slots:2, note:'原布局 306 × 408 · 热量与两个数据槽'}
};
export function completionDefaults(){return {enabled:false,mode:'screen',height:812.109375,scroll:0,clock:'09:41',battery:49,device:deviceDefaults(),endTime:'10:51',weather:'阴',temperature:'17',privacy:true,pb:{show:true,title:'最大爬升高度',value:'182',unit:'米'},routeCount:1,trend:{show:true,previousDistance:'3.26',up:8,down:3,equal:0},achievements:{show:true,items:[{kind:'pb',label:'创造新纪录',text:'最大爬升高度 182 米'},{kind:'medal',label:'示例公园',text:'个人成绩第二'}]},ad:{show:true,title:'团队跑量 PK 赛',text:'高校争霸：跑团对决！拼跑量，争荣誉，赢红包好礼！'}};}
export function defaultState() {
  const corners = [[.19,.14],[.62,.11],[.84,.28],[.79,.72],[.57,.87],[.20,.79],[.13,.51],[.30,.34],[.48,.42],[.58,.62],[.45,.77]];
  const points=[];
  corners.forEach((p,i)=>{if(!i){points.push({x:p[0],y:p[1]});return;}const q=corners[i-1];for(let k=1;k<=5;k++)points.push({x:q[0]+(p[0]-q[0])*k/5,y:q[1]+(p[1]-q[1])*k/5});});
  return {version:1, exportWidth:1080, sample:true, template:'result', title:'户外跑步', date:'2026-01-01T07:00', distance:5, duration:'00:30:00', autoPace:true, username:'晨跑的我', location:'公园晨跑', columns:3,
    metrics:[{id:'distance',title:'公里',valueStr:'5.00',unit:'',visible:true},{id:'duration',title:'运动时长',valueStr:'00:30:00',unit:'',visible:true},{id:'pace',title:'平均配速',valueStr:'6′00″',unit:'/公里',visible:true},{id:'calorie',title:'消耗热量',valueStr:'286',unit:'千卡',visible:true},{id:'cadence',title:'平均步频',valueStr:'168',unit:'步/分钟',visible:true},{id:'hr',title:'平均心率',valueStr:'145',unit:'次/分钟',visible:false}],
    route:{...routeStyleDefaults(),points, source:'示例手绘轨迹', mode:'none', image:null, color:'#36ba9a', width:3.5, markers:true, scale:1, offsetX:0, offsetY:0},
    style:{background:'#584f60',backgroundImage:null,avatar:null,qrImage:null,shade:.25,personal:true,dataBg:false,qrcode:false,watermark:false},completion:completionDefaults(), sections:[]};
}
export function parseDuration(value) {
  const p=String(value).trim().split(':').map(Number);
  if(p.length<2 || p.length>3 || p.some(v=>!Number.isFinite(v)||v<0||!Number.isInteger(v)))return null;
  if(p.at(-1)>59 || (p.length===3&&p[1]>59))return null;
  return p.length===2?p[0]*60+p[1]:p[0]*3600+p[1]*60+p[2];
}
export function formatDuration(seconds) {
  const s=Math.round(Math.max(0,seconds));
  return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,'0')).join(':');
}
export function formatPace(seconds) {if(!Number.isFinite(seconds)||seconds<=0)return '—';const s=Math.round(seconds);return `${Math.floor(s/60)}′${String(s%60).padStart(2,'0')}″`;}
export function syncMetrics(state) {
  const distance=state.metrics.find(m=>m.id==='distance');if(distance)distance.valueStr=state.distance.toFixed(2);
  const seconds=parseDuration(state.duration);
  const time=state.metrics.find(m=>m.id==='duration');if(time&&seconds!==null)time.valueStr=formatDuration(seconds);
  const pace=state.metrics.find(m=>m.id==='pace');if(pace&&state.autoPace)pace.valueStr=state.distance>0&&seconds>0?formatPace(seconds/state.distance):'—';
}
export function visibleMetrics(state,template=state.template){return state.metrics.filter(m=>m.visible!==false&&(template==='track'||m.id!=='distance')&&(template!=='data'||m.id!=='calorie')).slice(0,TEMPLATES[template]?.slots??Infinity);}
export function haversine(a,b){const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;const x=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;return 6371008.8*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));}
export function hasGeo(points){return points.length>1&&points.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));}
export function projectRoute(points){
  if(!hasGeo(points))return points.map(p=>({...p,x:Number(p.x)||0,y:Number(p.y)||0}));
  // Unwrap longitudes to preserve a short route crossing the antimeridian.
  let previous=points[0].lon;
  const projected=points.map(p=>{let lon=p.lon;while(lon-previous>180)lon-=360;while(lon-previous< -180)lon+=360;previous=lon;const lat=Math.max(-85.0511,Math.min(85.0511,p.lat))*Math.PI/180;return {...p,wx:(lon+180)/360,wy:(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2};});
  const xs=projected.map(p=>p.wx),ys=projected.map(p=>p.wy);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),span=Math.max(maxX-minX,maxY-minY,1e-7);
  return projected.map(p=>({...p,x:.5+(p.wx-(minX+maxX)/2)/span*.72,y:.5+(p.wy-(minY+maxY)/2)/span*.72}));
}
export function routeStats(points){
  if(!hasGeo(points))return {distance:0,duration:null,splits:[],series:{}};
  let distance=0,next=1000,splitTime=null;const splits=[],series={elevation:[],heartRate:[],cadence:[]};
  const firstTime=points.find(p=>Number.isFinite(p.time))?.time;
  for(let i=0;i<points.length;i++){
    const p=points[i];const before=distance;
    if(i&&!p.break)distance+=haversine(points[i-1],p);
    if(splitTime===null&&Number.isFinite(p.time))splitTime=p.time;
    if(i&&!p.break&&Number.isFinite(points[i-1].time)&&Number.isFinite(p.time)&&p.time>points[i-1].time){
      while(distance>=next){const fraction=(next-before)/(distance-before);const at=points[i-1].time+(p.time-points[i-1].time)*fraction;const seconds=(at-splitTime)/1000;if(seconds>0)splits.push({label:String(next/1000),pace:seconds});splitTime=at;next+=1000;}
    }
    for(const [key,property] of [['elevation','elevation'],['heartRate','hr'],['cadence','cad']])series[key].push([distance/1000,Number.isFinite(p[property])?p[property]:null]);
  }
  const lastTime=[...points].reverse().find(p=>Number.isFinite(p.time))?.time;
  for(const key of Object.keys(series))if(!series[key].some(p=>Number.isFinite(p[1])))series[key]=[];
  return {distance,duration:Number.isFinite(firstTime)&&lastTime>firstTime?(lastTime-firstTime)/1000:null,splits,series};
}
const validCoordinate=p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
export function parseGPX(text){
  const document=new DOMParser().parseFromString(text,'application/xml');if(document.getElementsByTagName('parsererror').length)throw new Error('GPX 文件不是有效的 XML');
  let nodes=[...document.getElementsByTagName('*')].filter(e=>e.localName==='trkpt');if(!nodes.length)nodes=[...document.getElementsByTagName('*')].filter(e=>e.localName==='rtept');
  let parent=null;
  const points=nodes.map(e=>{const find=name=>[...e.getElementsByTagName('*')].find(n=>n.localName===name)?.textContent;const p={lat:e.hasAttribute('lat')&&e.getAttribute('lat').trim()!==''?Number(e.getAttribute('lat')):NaN,lon:e.hasAttribute('lon')&&e.getAttribute('lon').trim()!==''?Number(e.getAttribute('lon')):NaN};const time=Date.parse(find('time'));if(Number.isFinite(time))p.time=time;for(const [key,tag] of [['elevation','ele'],['hr','hr'],['cad','cad']]){const raw=find(tag);if(raw!==undefined&&raw.trim()!==''&&Number.isFinite(Number(raw)))p[key]=Number(raw);}if(parent&&e.parentElement!==parent)p.break=true;parent=e.parentElement;return p;});
  if(points.length<2||points.length>100000||points.some(p=>!validCoordinate(p)))throw new Error('轨迹需要 2–100000 个有效经纬度点');return points;
}
function csvRows(text){const rows=[];let row=[],value='',quote=false;for(let i=0;i<=text.length;i++){const c=text[i]??'\n';if(c==='"'){if(quote&&text[i+1]==='"'){value+='"';i++;}else quote=!quote;}else if(!quote&&(c===','||c==='\t')){row.push(value.trim());value='';}else if(!quote&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value.trim());if(row.some(Boolean))rows.push(row);row=[];value='';}else value+=c;}if(quote)throw new Error('CSV 引号未闭合');return rows;}
export function parseCSV(text){const rows=csvRows(text.replace(/^\uFEFF/,''));if(!rows.length)throw new Error('CSV 为空');const header=rows[0].map(v=>v.toLowerCase());const latIndex=header.findIndex(v=>['lat','latitude','纬度'].includes(v));const lonIndex=header.findIndex(v=>['lon','lng','longitude','经度'].includes(v));const hasHeader=latIndex>=0&&lonIndex>=0;const a=hasHeader?latIndex:0,b=hasHeader?lonIndex:1;const ti=header.indexOf('time'),ei=header.findIndex(v=>['ele','elevation'].includes(v));
  const points=rows.slice(hasHeader?1:0).map(r=>{const p={lat:r[a]!==undefined&&r[a]!==''?Number(r[a]):NaN,lon:r[b]!==undefined&&r[b]!==''?Number(r[b]):NaN};if(ti>=0){const t=Date.parse(r[ti]);if(Number.isFinite(t))p.time=t;}if(ei>=0&&r[ei]!==undefined&&r[ei]!==''&&Number.isFinite(Number(r[ei])))p.elevation=Number(r[ei]);return p;});if(points.length<2||points.length>100000||points.some(p=>!validCoordinate(p)))throw new Error('CSV 需要 lat,lon 两列有效经纬度');return points;}
export function parseGeoJSON(value){
  const lines=[];function visit(o){if(!o)return;if(o.type==='Feature')visit(o.geometry);else if(o.type==='FeatureCollection')o.features.forEach(visit);else if(o.type==='LineString')lines.push(o.coordinates);else if(o.type==='MultiLineString')lines.push(...o.coordinates);else if(o.type==='GeometryCollection')o.geometries.forEach(visit);}visit(value);
  const points=lines.flatMap(line=>line.map((c,i)=>({...{lon:Number(c[0]),lat:Number(c[1])},...(Number.isFinite(c[2])?{elevation:c[2]}:{}),...(i===0?{break:true}:{})})));if(points.length<2||points.length>100000||points.some(p=>!validCoordinate(p)))throw new Error('GeoJSON 需要有效的 LineString 轨迹');return points;
}
export function applyRoute(state,points,source,applyData){state.route.points=points;state.route.source=source;state.route.scale=1;state.route.offsetX=state.route.offsetY=0;state.route.viewport=null;state.route.coordinateSystem='wgs84';state.route.rasterEdited=false;state.route.embedded=false;if(state.route.image==='assets/reference-map.png'){state.route.image=null;state.route.mode='none';}state.sample=false;const stats=routeStats(points);if(applyData){if(stats.distance>0)state.distance=Number((stats.distance/1000).toFixed(2));if(stats.duration)state.duration=formatDuration(stats.duration);syncMetrics(state);const t=points.find(p=>p.time)?.time;if(t){const d=new Date(t);state.date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}}
  state.sections=state.sections.filter(s=>!s.fromRoute);if(stats.splits.length)state.sections.push({type:'splits',title:'分公里配速',rows:stats.splits,fromRoute:true});for(const [key,title,unit] of [['heartRate','心率','次/分钟'],['cadence','步频','步/分钟'],['elevation','海拔','米']])if(stats.series[key].length>1)state.sections.push({type:'chart',title,unit,points:stats.series[key],fromRoute:true});return stats;}
function safeImage(value){if(value===null||value===undefined||value==='')return null;if(typeof value==='string'&&/^(data:image\/(png|jpeg|webp|gif|bmp);base64,|https?:\/\/|assets\/[a-z0-9_.-]+$)/i.test(value))return value;throw new Error('图片仅支持本地素材、PNG/JPEG/WebP/GIF/BMP 数据或 HTTP(S) 地址');}
export function validateSections(sections){if(!Array.isArray(sections)||sections.length>50)throw new Error('附加区块必须是最多 50 项的数组');return sections.map(s=>{if(!['text','metrics','splits','chart','image'].includes(s.type))throw new Error(`不支持区块类型 ${s.type}`);const o={...s,title:String(s.title||'').slice(0,120)};if(s.type==='chart'){if(!Array.isArray(s.points)||s.points.length>100000||s.points.some(p=>!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!(Number.isFinite(p[1])||p[1]===null)))throw new Error('图表 points 需要 [x,y] 数组，缺失值使用 null');}if(s.type==='metrics'&&(!Array.isArray(s.list)||s.list.length>200))throw new Error('metrics 区块需要 list 数组');if(s.type==='splits'&&(!Array.isArray(s.rows)||s.rows.length>500))throw new Error('splits 区块需要 rows 数组');if(s.type==='image')o.src=safeImage(s.src);return o;});}
export function importConfig(value){
  const state=defaultState();
  if(value?.version===1){Object.assign(state,value);state.route={...defaultState().route,...value.route};state.style={...defaultState().style,...value.style};}
  else {
    const b=value.basicInfo||{};state.title=value.title||b.category||'户外跑步';if(Number.isFinite(Number(b.distance)))state.distance=Number(b.distance)/1000;
    const data=value.sportData||value.outdoorSportData||{};if(Array.isArray(data.list))state.metrics=data.list.map((m,i)=>({id:`import-${i}`,title:m.title||'',valueStr:m.valueStr??m.value??'',unit:m.unit||'',visible:m.visible!==false,chartIcon:m.chartIcon||null,privacyInfo:m.privacyInfo||null,explanation:m.explanation||null}));state.columns=data.columnSize===2?2:3;
    state.autoPace=false;if(value.date)state.date=value.date;if(value.username)state.username=value.username;if(value.location)state.location=value.location;
    if(b.startTime&&b.endTime&&b.endTime>b.startTime){const delta=b.endTime-b.startTime;state.duration=formatDuration(b.startTime>1e11?delta/1000:delta);}
    const points=value.geoPointsList||b.geoPointsList||[];if(points.length>1)state.route.points=points.map(p=>({lat:Number(p.latitude??p.lat),lon:Number(p.longitude??p.lon)}));
    if(value.template?.layoutType){state.template=({1:'data',6:'run',7:'track',8:'map',9:'square'})[value.template.layoutType]||'result';}
    if(value.sections)state.sections=value.sections;state.sample=false;
  }
  const cd=completionDefaults(),native=value.completion||{};state.completion={...cd,...native,device:{...cd.device,...native.device},pb:{...cd.pb,...native.pb},trend:{...cd.trend,...native.trend},achievements:{...cd.achievements,...native.achievements},ad:{...cd.ad,...native.ad}};if(!DEVICES[state.completion.device.preset])throw new Error('未知机型预设');if(state.completion.device.source){
    const source=structuredClone(state.completion.device.source);source.src=safeImage(source.src);
    if(!source.src||!Number.isInteger(source.width)||source.width<80||source.width>12000||!Number.isInteger(source.height)||source.height<8||source.height>40000||!Number.isFinite(source.cropHeight)||source.cropHeight<1||source.cropHeight>source.height)throw new Error('状态栏截图参数无效');
    source.cropHeight=Math.round(source.cropHeight);source.keepOriginal=source.keepOriginal!==false;
    const boxValid=b=>b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.x>=0&&b.y>=0&&b.w>0&&b.h>0&&b.x+b.w<=source.width+1&&b.y+b.h<=source.height+1;
    if(source.clockBox&&!boxValid(source.clockBox))throw new Error('状态栏时间区域无效');
    if(source.originalTime&&!/^([01]?\d|2[0-3]):[0-5]\d$/.test(source.originalTime))throw new Error('截图原时间无效');
    if(source.glyphs&&(!Array.isArray(source.glyphs)||source.glyphs.length>5||source.glyphs.some(g=>!boxValid(g)||!/^[:0-9]$/.test(g.char))))throw new Error('状态栏数字位置无效');
    if(source.font&&(!['DeviceRoboto','DeviceSF','Arial','Segoe UI','KeepSans'].includes(source.font.family)||![400,500,600,700].includes(source.font.weight)))throw new Error('状态栏字体参数无效');
    if(source.editBounds&&(!Number.isFinite(source.editBounds.left)||!Number.isFinite(source.editBounds.right)||source.editBounds.left<0||source.editBounds.right>source.width||source.editBounds.right<=source.editBounds.left))throw new Error('状态栏时间边界无效');
    if(!source.clockBox||!source.font||!source.originalTime)source.keepOriginal=true;
    state.completion.device.source=source;
  }
  state.completion.device.fontScale=Math.max(.7,Math.min(1.4,Number(state.completion.device.fontScale)||1));if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(state.completion.clock))throw new Error('状态栏时间需要 HH:MM');if(!['screen','full'].includes(state.completion.mode))throw new Error('截图模式无效');for(const key of ['height','scroll','battery','routeCount']){const num=Number(state.completion[key]);if(!Number.isFinite(num)||num<0||num>5000)throw new Error('截图参数无效');state.completion[key]=num;}state.completion.battery=Math.min(100,state.completion.battery);if(state.completion.height<500)throw new Error('截图高度过小');if(!Array.isArray(state.completion.achievements.items)||state.completion.achievements.items.length>20)throw new Error('成就数组无效');
  if(!TEMPLATES[state.template])throw new Error('未知版式');if(!Number.isFinite(Number(state.distance))||Number(state.distance)<0||Number(state.distance)>10000)throw new Error('距离需要 0–10000 公里');state.distance=Number(state.distance);if(parseDuration(state.duration)===null)throw new Error('时长需要 HH:MM:SS 或 MM:SS');
  for(const key of ['title','date','username','location'])state[key]=String(state[key]||'').slice(0,120);state.columns=state.columns===2?2:3;
  if(!Array.isArray(state.metrics)||state.metrics.length>200)throw new Error('数据项最多 200 个');state.metrics=state.metrics.map((m,i)=>({...m,id:String(m.id||`m-${i}`),title:String(m.title||'').slice(0,80),valueStr:String(m.valueStr??'').slice(0,120),unit:String(m.unit||'').slice(0,40),visible:m.visible!==false}));
  if(!Array.isArray(state.route.points)||state.route.points.length>100000)throw new Error('轨迹点数量无效');for(const p of state.route.points){if(p.lat!==undefined){if(!validCoordinate(p))throw new Error('轨迹经纬度无效');}else if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('手绘轨迹坐标无效');}
  for(const [key,min,max] of [['opacity',.05,1],['shade',.3,1.7],['outline',0,5],['mapFade',0,.85],['mapSaturation',0,2],['mapBrightness',.5,1.5],['mapScale',.3,5],['mapX',-2,2],['mapY',-2,2],['slowPace',60,3600],['fastPace',30,3599]]){const n=Number(state.route[key]);if(!Number.isFinite(n))throw new Error('路线自定义参数无效');state.route[key]=Math.max(min,Math.min(max,n));}
  if(state.route.fastPace>=state.route.slowPace)throw new Error('快速配速必须小于慢速配速');
  Object.assign(state.route,normalizeMapAppearance(state.route));
  state.exportWidth=Number(value.exportWidth??state.exportWidth??1080);if(!Number.isInteger(state.exportWidth)||state.exportWidth<80||state.exportWidth>12000)throw new Error('导出宽度需要 80–12000 像素');
  if(!['auto','android','ios','none'].includes(state.completion.device.homeStyle))throw new Error('底部手势条样式无效');
  const inset=state.completion.device.footerInset;if(inset!==null){if(!Number.isFinite(Number(inset)))throw new Error('底部留白无效');state.completion.device.footerInset=Math.max(0,Math.min(80,Number(inset)));}
  for(const key of ['slowColor','normalColor','fastColor'])if(!/^#[0-9a-f]{6}$/i.test(state.route[key]))throw new Error('路线颜色需要 #RRGGBB 格式');
  if(!['solid','pace','original'].includes(state.route.colorMode)||!['labels','dots','none'].includes(state.route.markerStyle)||!['wgs84','gcj02'].includes(state.route.coordinateSystem))throw new Error('路线样式无效');
  if(state.route.place){const p=state.route.place;if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>85||Math.abs(p.lon)>180)throw new Error('地点坐标无效');state.route.place={...p,name:String(p.name||'').slice(0,120),city:String(p.city||'').slice(0,80),address:String(p.address||'').slice(0,500)};}
 if(state.route.viewport&&(!['x','y','factor'].every(k=>Number.isFinite(state.route.viewport[k]))||state.route.viewport.factor<=0||state.route.viewport.factor>1e10))throw new Error('地图视角无效');
  for(const p of state.route.points)if(p.level!==undefined&&(!Number.isFinite(p.level)||p.level<0||p.level>1))throw new Error('分段深浅数值无效');
  if(!['none','image','osm','amap','keep-native'].includes(state.route.mode))throw new Error('底图模式无效');state.route.image=safeImage(state.route.image);for(const key of ['backgroundImage','avatar','qrImage'])state.style[key]=safeImage(state.style[key]);for(const [obj,key,min,max] of [[state.route,'scale',.15,5],[state.route,'offsetX',-2,2],[state.route,'offsetY',-2,2],[state.route,'width',1,10],[state.style,'shade',0,.85]]){if(!Number.isFinite(Number(obj[key])))throw new Error('样式数值无效');obj[key]=Math.max(min,Math.min(max,Number(obj[key])));}for(const c of [state.route.color,state.style.background])if(!/^#[0-9a-f]{6}$/i.test(c))throw new Error('颜色需要 #RRGGBB 格式');state.sections=validateSections(state.sections||[]);return state;
}
