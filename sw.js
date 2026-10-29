/* Stagepulse Service Worker v20: license admin app assets are network-first */
const CACHE_VERSION='stagepulse-v20';
const STATIC_CACHE=`static-${CACHE_VERSION}`;
const MEDIA_CACHE=`media-${CACHE_VERSION}`;
const AUTHENTICATED_PATHS = ['/admin', '/portal', '/ses-merkezi-lisans'];

function isAuthenticatedPath(pathname){return AUTHENTICATED_PATHS.some(path=>pathname===path||pathname.startsWith(`${path}/`));}
function isOfflineShellAsset(request,url){
  if(request.method!=='GET'||!isAuthenticatedPath(url.pathname))return false;
  const root=AUTHENTICATED_PATHS.find(path=>url.pathname===path||url.pathname.startsWith(path+'/'));
  if(!root)return false;
  if(request.mode==='navigate'&&(url.pathname===root||url.pathname===root+'/'||url.pathname===root+'/index.html'))return true;
  if(!url.pathname.startsWith(root+'/'))return false;
  return ['script','style','image','font'].includes(request.destination)||/\.(html|css|js|svg|woff2?|png|jpe?g|webp)$/i.test(url.pathname);
}

const PRECACHE_ASSETS=['/favicon.svg','/manifest.webmanifest','/i18n.js','/offline-sync.js','/admin/','/portal/','/portal/portal.js','/portal/portal.css','/admin/admin.js?v=20261015-offline-nav7','/admin/admin.css?v=20261007-admin-rbac6'];
const NETWORK_FIRST_PATHS=['/','/index.html','/style.css','/script.js','/i18n.js','/consent.js','/teklif.html','/hizmetler.html','/muhendislik.html','/galeri.html','/dokumanlar.html','/hakkimizda.html','/referanslar.html','/nasil-calisiyoruz.html','/sss.html','/ekipman.html','/Kvkk.html','/media.json'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(STATIC_CACHE);
    const results=await Promise.allSettled(PRECACHE_ASSETS.map(asset=>cache.add(asset)));
    const failed=results.filter(result=>result.status==='rejected');
    if(failed.length) console.warn('Stagepulse offline shell precache had failures:',failed.length);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==STATIC_CACHE&&key!==MEDIA_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if (isAuthenticatedPath(url.pathname)) {
    if (isOfflineShellAsset(request,url)) {
      event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
        if(response&&response.status===200){const copy=response.clone();caches.open(STATIC_CACHE).then(cache=>cache.put(request,copy));}
        return response;
      }).catch(()=>caches.match(request).then(cached=>cached||new Response('Bu ekranın çevrimdışı açılması için önce internet bağlantısıyla yüklenmiş olması gerekir. Veriler ve kayıtlar çevrimdışı eşitlenmez.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}}))));
    } else {
      event.respondWith(fetch(request,{cache:'no-store'}));
    }
    return;
  }

  const isNetworkFirst=NETWORK_FIRST_PATHS.some(p=>url.pathname===p||url.pathname.endsWith(p))||request.destination==='document'||url.pathname.endsWith('.html')||url.pathname.endsWith('script.js')||url.pathname.endsWith('i18n.js')||url.pathname.endsWith('consent.js')||url.pathname.endsWith('media.json');

  if(isNetworkFirst){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(response&&response.status===200){const clone=response.clone();caches.open(STATIC_CACHE).then(cache=>cache.put(request,clone));}
      return response;
    }).catch(()=>caches.match(request).then(cached=>cached||caches.match('/index.html')||caches.match('/'))));
    return;
  }

  event.respondWith(caches.match(request).then(cached=>{
    if(cached)return cached;
    return fetch(request).then(response=>{
      if(response&&response.status===200&&request.method==='GET'){
        const clone=response.clone();
        const targetCache=request.destination==='video'||/\.(mp4|webm|mov|m4v)$/i.test(url.pathname)?MEDIA_CACHE:STATIC_CACHE;
        caches.open(targetCache).then(cache=>cache.put(request,clone));
      }
      return response;
    }).catch(()=>{
      if(request.destination==='image')return new Response('',{status:404});
      return caches.match('/index.html');
    });
  }));
});