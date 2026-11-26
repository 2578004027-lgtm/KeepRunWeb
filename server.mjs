import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {nativeMapView} from './native-map-data.mjs';
import {searchPlaces} from './place-providers.mjs';
const runFile=promisify(execFile);
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8766);
const types = { '.html':'text/html; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.otf':'font/otf', '.ttf':'font/ttf', '.woff2':'font/woff2', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml' };
const tiles=new Map();
const networks=new Map();
const places=new Map();
let searchQueue=Promise.resolve(),lastSearchStarted=0;
async function walkingXml(url){
  // urllib uses the Windows system proxy configuration. This optional path
  // helps on desktops where native Node fetch cannot reach the OSM endpoint.
  if(process.platform==='win32'){
    try{const result=await runFile('python',['-X','utf8','-c',"import sys,urllib.request; r=urllib.request.urlopen(urllib.request.Request(sys.argv[1],headers={'User-Agent':'RunStudio local route editor'}),timeout=15); sys.stdout.buffer.write(r.read(5000001))",url],{windowsHide:true,timeout:18000,maxBuffer:5100000,encoding:'utf8'});return result.stdout;}catch{}
  }
  const reply=await fetch(url,{headers:{'User-Agent':'RunStudio local route editor'},signal:AbortSignal.timeout(12000)});
  if(!reply.ok)throw new Error('Walking network unavailable');return reply.text();
}
http.createServer(async (req,res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if(u.pathname==='/api/native-map'){
      try{const box=(u.searchParams.get('bbox')||'').split(',').map(Number),zoom=Number(u.searchParams.get('zoom'));const data=await nativeMapView(box,zoom);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, max-age=600'});return res.end(JSON.stringify(data));}
      catch(error){res.writeHead(502,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({error:error.message}));}
    }
    if(u.pathname==='/api/places'){
      const query=(u.searchParams.get('q')||'').trim();
      if(query.length<2||query.length>120){res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({error:'请输入 2–120 个字的地点名称'}));}
      const key=query.toLocaleLowerCase();
      if(!places.has(key)){
        // Explicit searches only: no per-keystroke autocomplete. Cache and
        // serialize upstream requests to respect Nominatim's one/sec limit.
        const job=searchQueue.catch(()=>{}).then(async()=>{
          if(places.has(key))return;
          const delay=Math.max(0,1100-(Date.now()-lastSearchStarted));if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
          lastSearchStarted=Date.now();
          const results=await searchPlaces(query);
          if(places.size>=100)places.delete(places.keys().next().value);places.set(key,results);
        });searchQueue=job;await job;
      }
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-cache'});
      return res.end(JSON.stringify({results:places.get(key),attribution:'© OpenStreetMap contributors'}));
    }
    if(u.pathname==='/api/walk-network'){
      const box=(u.searchParams.get('bbox')||'').split(',').map(Number);
      if(box.length!==4||box.some(n=>!Number.isFinite(n))||box[0]>=box[2]||box[1]>=box[3]||box[2]-box[0]>.03||box[3]-box[1]>.03||Math.abs(box[0])>180||Math.abs(box[2])>180||Math.abs(box[1])>85||Math.abs(box[3])>85){res.writeHead(400);return res.end('Please draw a loop within a 2 km area');}
      const key=box.map(v=>v.toFixed(5)).join(',');
      if(!networks.has(key)){
        const xml=await walkingXml(`https://api.openstreetmap.org/api/0.6/map?bbox=${key}`);if(xml.length>5000000){res.writeHead(413);return res.end('Please draw a smaller loop');}
        if(networks.size>=16)networks.delete(networks.keys().next().value);networks.set(key,xml);
      }
      res.writeHead(200,{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=600'});return res.end(networks.get(key));
    }
    const tile=u.pathname.match(/^\/api\/tiles\/amap\/(\d+)\/(\d+)\/(\d+)$/);
    if(tile){
      const [z,x,y]=tile.slice(1).map(Number);
      if(z<1||z>18||x>=2**z||y>=2**z){res.writeHead(400);return res.end('Invalid tile');}
      const key=`${z}/${x}/${y}`;
      if(!tiles.has(key)){
        const response=await fetch(`https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x=${x}&y=${y}&z=${z}`,{headers:{'Referer':'https://www.amap.com/','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
        if(!response.ok||!response.headers.get('content-type')?.startsWith('image/')){res.writeHead(502);return res.end('Map provider unavailable');}
        if(tiles.size>=256)tiles.delete(tiles.keys().next().value);
        tiles.set(key,Buffer.from(await response.arrayBuffer()));
      }
      res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'});return res.end(tiles.get(key));
    }
    const relative = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname);
    const target = path.resolve(root, '.' + relative);
    if (!target.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    const data = await fs.readFile(target);
    res.writeHead(200, {'Content-Type':types[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache'});
    res.end(data);
  } catch { res.writeHead(req.url.startsWith('/api/')?502:404);res.end(req.url.startsWith('/api/')?'Map data temporarily unavailable':'Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Run Studio: http://127.0.0.1:${port}`));
