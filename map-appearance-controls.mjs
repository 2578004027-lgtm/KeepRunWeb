import {MAP_APPEARANCE,mapAppearancePreset} from './map-appearance.mjs';
export function mapAppearanceMarkup(range){
 const color=(key,label)=>`<div class="map-color-control"><label><input type="checkbox" data-map-color-enabled="${key}">自定义${label}</label><input type="color" data-map-color="${key}" aria-label="${label}"></div>`;
 return `<details id="map-appearance" class="extra-settings map-appearance"><summary>地图文字与配色</summary>
 <p id="map-appearance-note" class="helper"></p>
 <fieldset id="map-appearance-fields"><legend class="sr-only">可编辑地图外观</legend>
 <div class="route-preset-buttons"><button type="button" data-map-look="default">默认</button><button type="button" data-map-look="soft">柔和</button><button type="button" data-map-look="clear">清晰</button></div>
 <label class="check-row"><input type="checkbox" data-map-boolean="mapLabels">显示地点与道路文字</label>
 ${range('mapLabelScale','地图文字大小（倍）',.65,1.6,.05)}${range('mapLabelOpacity','地图文字深浅',0,1,.05)}
 <div class="field"><label>文字粗细<select data-map-select="mapLabelWeight"><option value="auto">跟随地图</option><option value="normal">常规</option><option value="bold">加粗</option></select></label></div>
 ${color('mapLabelColor','文字颜色')}
 ${range('mapRoadScale','道路宽度（倍）',.5,2,.05)}${range('mapRoadOpacity','道路深浅',0,1,.05)}
 ${color('mapRoadColor','道路颜色')}${color('mapGroundColor','底色')}${color('mapParkColor','绿地颜色')}
 <label class="check-row"><input type="checkbox" data-map-boolean="mapArrows">显示道路方向箭头</label>
 ${range('mapArrowScale','方向箭头大小（倍）',.5,2,.05)}
 <button type="button" id="reset-map-appearance" class="button subtle full">恢复地图外观</button>
 </fieldset><p class="helper">修改会实时预览；恢复外观不会清空路线或更换地点。</p></details>`;
}
export function syncMapAppearance(dialog,route){
 const enabled=route.mode==='keep-native';dialog.querySelector('#map-appearance-fields').disabled=!enabled;
 dialog.querySelector('#map-appearance-note').textContent=enabled?'按手机显示效果调字号、道路和配色。':'独立文字与颜色设置适用于 Keep 风格地图，请在上方切换地图来源。图片底图仍可调整体明暗。';
 for(const input of dialog.querySelectorAll('[data-map-boolean]'))input.checked=route[input.dataset.mapBoolean];
 for(const input of dialog.querySelectorAll('[data-map-select]'))input.value=route[input.dataset.mapSelect];
 for(const input of dialog.querySelectorAll('[data-map-color]')){
  const key=input.dataset.mapColor,custom=route[key]!=null;input.value=route[key]||MAP_APPEARANCE[key].color;input.disabled=!enabled||!custom;
  dialog.querySelector(`[data-map-color-enabled="${key}"]`).checked=custom;
 }
}
export function bindMapAppearance(dialog,{mutate,getRoute}){
 for(const input of dialog.querySelectorAll('[data-map-boolean]'))input.addEventListener('change',()=>mutate(()=>getRoute()[input.dataset.mapBoolean]=input.checked));
 for(const input of dialog.querySelectorAll('[data-map-select]'))input.addEventListener('change',()=>mutate(()=>getRoute()[input.dataset.mapSelect]=input.value));
 for(const input of dialog.querySelectorAll('[data-map-color]'))input.addEventListener('input',()=>mutate(()=>getRoute()[input.dataset.mapColor]=input.value));
 for(const input of dialog.querySelectorAll('[data-map-color-enabled]'))input.addEventListener('change',()=>mutate(()=>{const key=input.dataset.mapColorEnabled;getRoute()[key]=input.checked?dialog.querySelector(`[data-map-color="${key}"]`).value:null;}));
 for(const button of dialog.querySelectorAll('[data-map-look]'))button.addEventListener('click',()=>mutate(()=>Object.assign(getRoute(),mapAppearancePreset(button.dataset.mapLook))));
 dialog.querySelector('#reset-map-appearance').addEventListener('click',()=>mutate(()=>Object.assign(getRoute(),mapAppearancePreset('default'))));
}
