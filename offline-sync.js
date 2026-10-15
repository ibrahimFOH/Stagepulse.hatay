/* Stagepulse offline shell + durable, scoped outbox.
   Only allowlisted operational mutations may queue; auth, finance and admin
   writes are never replayed automatically by this module. */
(() => {
  'use strict';
  const DB_NAME = 'stagepulse-offline-v1';
  const DB_VERSION = 1;
  const STORE_CACHE = 'cache';
  const STORE_QUEUE = 'queue';
  const ALLOWED_STAFF_RPCS = new Set(['staff_update_job_status', 'staff_update_job_notes']);
  const ALLOWED_ADMIN_JOB_FIELDS = new Set(['title','location','status','setup_at','event_at','teardown_at','notes']);
  let dbPromise;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('Bu cihazda kalıcı çevrimdışı depolama desteklenmiyor.'));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_CACHE)) db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(STORE_QUEUE)) db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Çevrimdışı veri deposu açılamadı.'));
    });
    return dbPromise;
  }

  async function storeRequest(storeName, mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let request;
      try { request = action(store); } catch (e) { reject(e); return; }
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error || request?.error || new Error('Çevrimdışı veri yazılamadı.'));
      tx.onabort = () => reject(tx.error || new Error('Çevrimdışı işlem iptal edildi.'));
    });
  }

  async function cacheKeyForActor(key) {
    // Cached operational data can include customer and financial records. Never
    // share a cache namespace between accounts on the same device.
    const client = window.__stagepulsePortalClient || window.__stagepulseAdminClient;
    if (!client?.auth?.getSession) throw new Error('Çevrimdışı veri için kullanıcı oturumu doğrulanamadı.');
    const { data, error } = await client.auth.getSession();
    const actorId = data?.session?.user?.id;
    if (error || !actorId) throw new Error('Çevrimdışı veri için oturum bulunamadı. İnternet bağlantısıyla tekrar giriş yapın.');
    return 'actor:' + actorId + ':' + String(key);
  }
  async function putCache(key, value) {
    const scopedKey = await cacheKeyForActor(key);
    return storeRequest(STORE_CACHE, 'readwrite', store => store.put({ key: scopedKey, value, updatedAt: Date.now() }));
  }
  async function getCache(key) {
    const scopedKey = await cacheKeyForActor(key);
    const row = await storeRequest(STORE_CACHE, 'readonly', store => store.get(scopedKey));
    return row ? row.value : null;
  }
  async function clearActorCache() {
    const client = window.__stagepulsePortalClient || window.__stagepulseAdminClient;
    const { data, error } = await client?.auth?.getSession?.() || {};
    const actorId = data?.session?.user?.id;
    if (error || !actorId) return 0;
    const prefix = 'actor:' + actorId + ':';
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_CACHE);
      const request = store.openCursor();
      let removed = 0;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(prefix)) { cursor.delete(); removed += 1; }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error || new Error('Yerel önbellek temizlenemedi.'));
    });
  }
  async function getQueue() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve((req.result || []).sort((a,b) => a.createdAt-b.createdAt));
      req.onerror = () => reject(req.error || new Error('Senkronizasyon kuyruğu okunamadı.'));
    });
  }
  async function queueStaffAction(rpc, args, actorId, localPatch) {
    if (!ALLOWED_STAFF_RPCS.has(rpc)) throw new Error('Bu işlem çevrimdışı kuyruğa alınamaz.');
    if (!actorId) throw new Error('Personel oturumu doğrulanamadı; işlem kuyruğa alınmadı.');
    const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'sp-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    const row = { id, scope: 'staff', rpc, args, actorId, createdAt: Date.now(), state: 'pending', attempts: 0, localPatch: localPatch || null };
    await storeRequest(STORE_QUEUE, 'readwrite', store => store.put(row));
    await renderBanner();
    return row;
  }
  async function queueAdminJobUpdate(rowId, payload, actorId, baseUpdatedAt) {
    if (!rowId || !actorId) throw new Error('Yönetici oturumu veya iş kimliği doğrulanamadı.');
    const safePayload = Object.fromEntries(Object.entries(payload || {}).filter(([key]) => ALLOWED_ADMIN_JOB_FIELDS.has(key)));
    if (!Object.keys(safePayload).length || Object.keys(safePayload).length !== Object.keys(payload || {}).length) {
      throw new Error('Çevrimdışı yalnızca iş başlığı, konum, durum, zamanlar ve operasyon notu değiştirilebilir.');
    }
    const existing = (await getQueue()).find(item => item.scope === 'admin' && item.kind === 'table_update' && item.table === 'jobs' && item.rowId === rowId && item.actorId === actorId && item.state === 'pending');
    if (existing) {
      existing.payload = { ...existing.payload, ...safePayload };
      await updateQueue(existing);
      await renderBanner();
      return existing;
    }
    const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'sp-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    const row = { id, scope: 'admin', kind: 'table_update', table: 'jobs', rowId, payload: safePayload, actorId, baseUpdatedAt: baseUpdatedAt || null, createdAt: Date.now(), state: 'pending', attempts: 0 };
    await storeRequest(STORE_QUEUE, 'readwrite', store => store.put(row));
    await renderBanner();
    return row;
  }
  async function updateQueue(row) {
    return storeRequest(STORE_QUEUE, 'readwrite', store => store.put(row));
  }
  async function removeQueue(id) {
    return storeRequest(STORE_QUEUE, 'readwrite', store => store.delete(id));
  }
  function networkFailure(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return navigator.onLine === false || /failed to fetch|network|load failed|fetch failed|connection|internet|timeout|timed out|offline/.test(message);
  }
  async function flush() {
    if (navigator.onLine === false) { await renderBanner(); return { synced: 0, pending: (await getQueue()).length, offline: true }; }
    const client = window.__stagepulsePortalClient || window.__stagepulseAdminClient;
    if (!client?.auth?.getSession) { await renderBanner(); return { synced: 0, pending: (await getQueue()).length, offline: false }; }
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError || !data?.session?.user?.id) { await renderBanner(); return { synced: 0, pending: (await getQueue()).length, offline: false, blocked: true }; }
    const actorId = data.session.user.id;
    let synced = 0;
    const queue = await getQueue();
    for (const item of queue) {
      if (item.actorId !== actorId || item.state === 'blocked') continue;
      if (item.scope === 'staff' && !ALLOWED_STAFF_RPCS.has(item.rpc)) continue;
      if (item.scope === 'admin' && !(item.kind === 'table_update' && item.table === 'jobs')) continue;
      item.attempts = (item.attempts || 0) + 1;
      item.lastAttemptAt = Date.now();
      try {
        let result;
        if (item.scope === 'staff') {
          result = await client.rpc(item.rpc, item.args);
          if (result.error) throw result.error;
        } else {
          const current = await client.from('jobs').select('id,updated_at').eq('id', item.rowId).maybeSingle();
          if (current.error) throw current.error;
          if (!current.data) throw new Error('İş güncellenmedi: kayıt bulunamadı veya erişim yetkisi değişti.');
          if (item.baseUpdatedAt && (!current.data.updated_at || String(current.data.updated_at) !== String(item.baseUpdatedAt))) {
            throw new Error('Çakışma: iş çevrimdışıyken sunucudaki kayıt değişmiş veya zaman damgası doğrulanamıyor. Kayıt otomatik üzerine yazılmadı; çevrimiçi kontrol gerekiyor.');
          }
          result = await client.from('jobs').update(item.payload).eq('id', item.rowId).select('id');
          if (result.error) throw result.error;
          if (!Array.isArray(result.data) || result.data.length === 0) throw new Error('İş güncellenmedi: kayıt bulunamadı veya yetki değişti. Yönetici kontrolü gerekiyor.');
        }
        await removeQueue(item.id);
        synced += 1;
      } catch (e) {
        item.state = networkFailure(e) ? 'pending' : 'blocked';
        item.lastError = String(e?.message || e).slice(0, 300);
        await updateQueue(item);
        if (item.state === 'pending') break;
      }
    }
    await renderBanner();
    return { synced, pending: (await getQueue()).length, offline: false };
  }
  async function renderBanner() {
    let banner = document.getElementById('stagepulseOfflineBanner');
    const queue = await getQueue().catch(() => []);
    const pending = queue.filter(x => x.state !== 'blocked').length;
    const blocked = queue.filter(x => x.state === 'blocked').length;
    const offline = navigator.onLine === false || window.__stagepulseOfflineMode === true;
    if (!offline && !pending && !blocked) { banner?.remove(); return; }
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'stagepulseOfflineBanner';
      banner.setAttribute('role', 'status');
      banner.style.cssText = 'position:fixed;z-index:20000;top:0;left:0;right:0;padding:9px 12px;background:#17191e;color:#fff;border-bottom:1px solid #b88622;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;font:600 13px system-ui;box-shadow:0 2px 12px #0005';
      document.body.appendChild(banner);
    }
    const label = offline ? 'ÇEVRİMDIŞI' : 'SENKRONİZASYON';
    const detail = offline ? 'Kayıt kuyruğu cihazda tutuluyor; sunucuya gönderilmedi.' : pending ? pending + ' kayıt eşitleme bekliyor.' : 'Bazı kayıtlar sunucu tarafından reddedildi.';
    banner.replaceChildren();
    const text = document.createElement('span');
    text.textContent = label + ' · ' + detail + (blocked ? ' ' + blocked + ' kayıt kontrol gerektiriyor.' : '');
    banner.appendChild(text);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = offline ? 'Bağlantıyı bekle' : 'Şimdi eşitle';
    button.disabled = offline;
    button.style.cssText = 'border:1px solid #b88622;background:#b88622;color:#111;border-radius:7px;padding:6px 10px;font-weight:800';
    button.addEventListener('click', async () => {
      button.disabled = true;
      const result = await flush().catch(() => ({ synced: 0, pending, blocked: true }));
      if (result.synced) window.dispatchEvent(new CustomEvent('stagepulse:offline-synced', { detail: result }));
      await renderBanner();
    });
    banner.appendChild(button);
    document.body.style.scrollPaddingTop = '54px';
  }

  window.StagepulseOffline = {
    putCache, getCache, clearActorCache, queueStaffAction, queueAdminJobUpdate, flush, renderBanner, networkFailure,
    async queueCount() { return (await getQueue()).length; },
    async pendingForActor(actorId) { return (await getQueue()).filter(x => x.actorId === actorId); },
    safeJobSnapshot(rows) {
      const allowed = ['id','title','location','setup_at','event_at','teardown_at','status','response_status','notes','created_at','updated_at'];
      return (rows || []).map(row => Object.fromEntries(allowed.filter(k => row && Object.prototype.hasOwnProperty.call(row,k)).map(k => [k,row[k]])));
    }
  };

  window.addEventListener('online', () => {
    flush().then(result => {
      // Automatic sync must refresh the visible view too, not only the banner button.
      if (result.synced > 0) {
        window.dispatchEvent(new CustomEvent('stagepulse:offline-synced', { detail: result }));
      } else if (window.__stagepulseOfflineMode && window.loadView) {
        if (location.pathname.startsWith('/admin')) window.loadView('calendar');
        else if (location.pathname.startsWith('/portal')) window.loadView((location.hash || '#home').slice(1));
      }
    }).catch(() => {}).finally(() => renderBanner().catch(() => {}));
  });
  window.addEventListener('offline', () => { renderBanner().catch(() => {}); });
  window.addEventListener('stagepulse:offline-synced', () => {
    const target = window.__stagepulsePortalClient ? 'portal' : 'admin';
    if (target === 'portal' && window.loadView && location.pathname.startsWith('/portal')) window.loadView((location.hash || '#home').slice(1));
    if (target === 'admin' && window.loadView && location.pathname.startsWith('/admin')) window.loadView('calendar');
  });
  const registerServiceWorker = () => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  };
  if (document.readyState === 'complete') registerServiceWorker();
  else window.addEventListener('load', registerServiceWorker, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => renderBanner().catch(() => {}), { once: true });
  else renderBanner().catch(() => {});
})();