import {wgsToGcj} from './route-style.mjs';
export function parsePlaceCoordinates(query){
 const match=String(query).trim().match(/^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/);
 if(!match)return null;
 const lat=Number(match[1]),lon=Number(match[2]);
 if(Math.abs(lat)>85||Math.abs(lon)>180)throw new Error('纬度需要 −85 至 85，经度需要 −180 至 180');
 return {name:`${lat.toFixed(5)}, ${lon.toFixed(5)}`,address:'按经纬度定位（WGS84）',city:'',lat,lon,provider:'coordinates'};
}
export function placeViewport(place,mode='amap'){
 const lat=Number(place.lat),lon=Number(place.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)throw new Error('地点坐标无效');
 const center=['amap','keep-native'].includes(mode)?wgsToGcj({lat,lon}):{lat,lon};
 let span=1000;
 if(Array.isArray(place.bbox)&&place.bbox.length===4&&place.bbox.every(Number.isFinite)){
  const [south,north,west,east]=place.bbox;
  const across=Math.abs(east-west)*111320*Math.cos(lat*Math.PI/180),high=Math.abs(north-south)*111320;
  span=Math.max(600,Math.min(2500,Math.max(across,high)*1.2));
 }
 return {x:(center.lon+180)/360,y:(1-Math.log(Math.tan(Math.PI/4+center.lat*Math.PI/360))/Math.PI)/2,factor:375*40075016.686*Math.cos(center.lat*Math.PI/180)/span};
}
export function bindPlaceSearch({dialog,onSelect,toast}){
 const $=id=>dialog.querySelector('#'+id);let request=null,sequence=0;
 function clear(){++sequence;request?.abort();request=null;$('place-results').replaceChildren();$('place-results').hidden=true;$('place-search-button').disabled=false;}
 function show(results,attribution=''){
  const container=$('place-results');container.replaceChildren();container.hidden=false;
  if(!results.length){$('place-search-status').textContent='没有找到，试试加上城市名，或输入“纬度,经度”。';return;}
  $('place-search-status').textContent=`找到 ${results.length} 个地点，点击选择。`;
  for(const place of results){
   const button=document.createElement('button');button.type='button';button.className='place-result';button.setAttribute('data-place-result','');
   const name=document.createElement('strong'),address=document.createElement('span');name.textContent=place.name;address.textContent=place.address;
   button.append(name,address);button.addEventListener('click',()=>{onSelect(place);clear();$('place-query').value=place.name;$('place-search-status').textContent=`已选择 ${place.name}，在地图上画圈即可。`;});container.append(button);
  }
  if(attribution){const credit=document.createElement('small');credit.textContent=attribution;container.append(credit);}
 }
 async function search(){
  const query=$('place-query').value.trim();clear();const id=sequence;
  try{
   const coordinates=parsePlaceCoordinates(query);if(coordinates){show([coordinates]);return;}
   if(query.length<2)throw new Error('请输入地点名称，例如“公园名称”');
   $('place-search-button').disabled=true;$('place-search-status').textContent='正在搜索地点…';request=new AbortController();
   const response=await fetch('api/places?q='+encodeURIComponent(query),{signal:request.signal});
   if(!response.ok)throw new Error('地点搜索暂时不可用，可重试或输入“纬度,经度”');
   const data=await response.json();if(id!==sequence||!dialog.open)return;show(data.results||[],data.attribution);
  }catch(e){if(id===sequence&&e.name!=='AbortError')$('place-search-status').textContent=e.message;}
  finally{if(id===sequence)$('place-search-button').disabled=false;}
 }
 $('place-search-button').addEventListener('click',search);
 $('place-query').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();search();}if(event.key==='ArrowDown')$('place-results').querySelector('button')?.focus();});
 $('place-query').addEventListener('input',()=>{clear();$('place-search-status').textContent='输入城市、公园或学校名称，搜索后选择地点。';});
 return {reset(place){clear();$('place-query').value=place?.name||'';$('place-search-status').textContent=place?`当前地点：${place.name}`:'输入城市、公园或学校名称，也支持“纬度,经度”。';},cancel:clear};
}
