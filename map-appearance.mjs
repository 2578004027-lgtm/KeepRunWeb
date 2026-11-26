export const MAP_APPEARANCE={
 mapLabels:{value:true},mapLabelScale:{value:1,min:.65,max:1.6},mapLabelOpacity:{value:1,min:0,max:1},
 mapLabelWeight:{value:'auto',options:['auto','normal','bold']},mapLabelColor:{value:null,color:'#adb3bd'},
 mapArrows:{value:true},mapArrowScale:{value:1,min:.5,max:2},
 mapRoadScale:{value:1,min:.5,max:2},mapRoadOpacity:{value:1,min:0,max:1},mapRoadColor:{value:null,color:'#ffffff'},
 mapGroundColor:{value:null,color:'#f8f4f0'},mapParkColor:{value:null,color:'#d5e7c0'}
};
export const mapAppearanceDefaults=()=>Object.fromEntries(Object.entries(MAP_APPEARANCE).map(([key,spec])=>[key,spec.value]));
export function normalizeMapAppearance(input={}){
 const out={};
 for(const [key,spec] of Object.entries(MAP_APPEARANCE)){
  const value=input[key]===undefined?spec.value:input[key];
  if(spec.color){if(value!==null&&!/^#[0-9a-f]{6}$/i.test(value))throw new Error('地图颜色需要 #RRGGBB 格式');out[key]=value;}
  else if(spec.options){if(!spec.options.includes(value))throw new Error('地图文字样式无效');out[key]=value;}
  else if(typeof spec.value==='boolean'){if(typeof value!=='boolean')throw new Error('地图显示选项无效');out[key]=value;}
  else{const n=Number(value);if(!Number.isFinite(n))throw new Error('地图外观数值无效');out[key]=Math.max(spec.min,Math.min(spec.max,n));}
 }
 return out;
}
export function mapAppearancePreset(name){
 const defaults={...mapAppearanceDefaults(),mapFade:0,mapSaturation:1,mapBrightness:1};
 if(name==='soft')return {...defaults,mapLabelOpacity:.75,mapRoadOpacity:.75,mapFade:.08};
 if(name==='clear')return {...defaults,mapLabelScale:1.08,mapLabelWeight:'bold',mapLabelColor:'#7d8797',mapRoadScale:1.12};
 return defaults;
}
