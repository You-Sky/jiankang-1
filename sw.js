const CACHE='hengchang-static-v3';
const ASSETS=['./','./index.html','./style.css','./app.js','./core.js','./goals-ui.js','./data.js','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('hengchang-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const scopePath=new URL(self.registration.scope).pathname;
  const relative=url.pathname.slice(scopePath.length);
  if(!['','index.html','style.css','app.js','core.js','goals-ui.js','data.js','icon.svg','manifest.webmanifest'].includes(relative))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,clone)));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));
});
