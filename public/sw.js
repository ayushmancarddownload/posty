const C='posty-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(caches.open(C).then(c=>c.match(r).then(h=>{
    const n=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res}).catch(()=>h);
    return h||n;
  })));
});
