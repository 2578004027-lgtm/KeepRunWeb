const validPoint=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=85&&Math.abs(lon)<=180;
const bbox=value=>Array.isArray(value)&&value.length===4&&value.every(Number.isFinite)?value:null;
export function photonPlaces(data){
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('Invalid Photon response');
 return data.features.flatMap(feature=>{
  const p=feature.properties||{},coordinates=feature.geometry?.coordinates;
  if(feature.geometry?.type!=='Point'||!Array.isArray(coordinates))return [];
  const [lon,lat]=coordinates;if(!validPoint(lat,lon))return [];
  const extent=bbox(p.extent),city=String(p.city||p.county||p.state||'').slice(0,80);
  return [{name:String(p.name||p.street||city).slice(0,120),
   address:[...new Set([p.country,p.state,p.city,p.county,p.district,p.street,p.housenumber].filter(Boolean))].join(' · ').slice(0,500),
   city,lat,lon,bbox:extent?[extent[3],extent[1],extent[0],extent[2]]:null,provider:'OpenStreetMap',geocoder:'Photon'}];
 }).slice(0,6);
}
export function nominatimPlaces(data){
 if(!Array.isArray(data))throw new Error('Invalid Nominatim response');
 return data.flatMap(p=>{
  if(p?.lat==null||p?.lon==null||String(p.lat).trim()===''||String(p.lon).trim()==='')return [];
  const lat=Number(p.lat),lon=Number(p.lon);if(!validPoint(lat,lon))return [];
  return [{name:String(p.name||p.display_name?.split(',')[0]||'').slice(0,120),address:String(p.display_name||'').slice(0,500),
   city:String(String(p.display_name||'').split(',').map(v=>v.trim()).find(v=>/市$/.test(v))||p.address?.city||p.address?.town||p.address?.municipality||p.address?.county||p.address?.state||'').slice(0,80),
   lat,lon,bbox:bbox(p.boundingbox?.map(Number)),provider:'OpenStreetMap',geocoder:'Nominatim'}];
 }).slice(0,6);
}
async function requestJson(url){
 const reply=await fetch(url,{headers:{'User-Agent':'RunStudio local route editor'},signal:AbortSignal.timeout(7000)});
 if(!reply.ok)throw new Error('Geocoder unavailable');return reply.json();
}
export async function searchPlaces(query,{request=requestJson}={}){
 const photon=new URL('https://photon.komoot.io/api/');photon.search=new URLSearchParams({q:query,limit:'6'});
 try{return photonPlaces(await request(photon.href));}
 catch{
  const nominatim=new URL('https://nominatim.openstreetmap.org/search');nominatim.search=new URLSearchParams({q:query,format:'jsonv2',limit:'6',addressdetails:'1','accept-language':'zh-CN,zh,en'});
  return nominatimPlaces(await request(nominatim.href));
 }
}
