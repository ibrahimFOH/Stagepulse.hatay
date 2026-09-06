/* Stagepulse Admin — canonical data-action repair for views whose existing renderer has no usable CRUD controls. */
(() => {
  'use strict';
  if (window.__STAGEPULSE_ADMIN_DATA_ACTIONS_REPAIR__) return;
  window.__STAGEPULSE_ADMIN_DATA_ACTIONS_REPAIR__ = true;

  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const db = () => window.__stagepulseAdminClient || window.sb || window.supabaseClient || null;
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const toast = (m, ok = true) => window.toast?.(m, ok);
  const hash = () => (location.hash || '#dashboard').slice(1).split('?')[0].toLowerCase();

  const specs = {
    finance: {
      table: 'payments', title: 'Ödeme düzenle',
      fields: [
        ['description','Açıklama','text'], ['amount','Tutar','number'], ['due_date','Vade','date'],
        ['paid_at','Ödeme tarihi','date'], ['status','Durum','text']
      ]
    },
    equipment: {
      table: 'equipment', title: 'Ekipman düzenle',
      fields: [
        ['category','Kategori','text'], ['brand','Marka','text'], ['model','Model','text'],
        ['quantity','Adet','number'], ['daily_price','Günlük fiyat','number'], ['active','Aktif','checkbox'], ['notes','Notlar','text']
      ]
    }
  };

  function modal(spec, row) {
    q('#spCanonicalActionModal')?.remove();
    const w = document.createElement('div');
    w.id = 'spCanonicalActionModal';
    w.className = 'sp-runtime-modal';
    w.innerHTML = `<div class="sp-runtime-modal-card">
      <h2>${esc(spec.title)}</h2>
      <div class="sp-runtime-modal-grid">${spec.fields.map(([key,label,type]) => {
        const value = row[key];
        if (type === 'checkbox') return `<label>${esc(label)}<input data-key="${esc(key)}" type="checkbox" ${value === true ? 'checked' : ''}></label>`;
        return `<label>${esc(label)}<input data-key="${esc(key)}" type="${type}" value="${esc(value ?? '')}"></label>`;
      }).join('')}</div>
      <div class="sp-runtime-modal-actions"><button type="button" class="btn" data-cancel>Vazgeç</button><button type="button" class="btn btn-primary" data-save>Kaydet</button></div>
    </div>`;
    document.body.appendChild(w);
    q('[data-cancel]', w).onclick = () => w.remove();
    q('[data-save]', w).onclick = async () => {
      const client = db();
      if (!client) return toast('Supabase bağlantısı hazır değil.', false);
      const patch = {};
      qa('[data-key]', w).forEach(input => {
        const key = input.dataset.key;
        if (input.type === 'checkbox') patch[key] = input.checked;
        else if (input.type === 'number') patch[key] = input.value === '' ? null : Number(input.value);
        else patch[key] = input.value.trim() || null;
      });
      const button = q('[data-save]', w);
      button.disabled = true;
      try {
        const { error } = await client.from(spec.table).update(patch).eq('id', row.id);
        if (error) throw error;
        w.remove(); toast('Kayıt güncellendi.');
        await window.loadView?.(hash());
      } catch (e) {
        toast(e?.message || 'Kayıt güncellenemedi.', false);
        button.disabled = false;
      }
    };
  }

  async function edit(view, id) {
    const spec = specs[view], client = db();
    if (!spec || !client || !id) return;
    const { data, error } = await client.from(spec.table).select('*').eq('id', id).maybeSingle();
    if (error || !data) return toast(error?.message || 'Kayıt bulunamadı.', false);
    modal(spec, data);
  }

  async function remove(table, id, label) {
    const client = db();
    if (!client || !id) return;
    if (!confirm(`${label || 'Bu kayıt'} silinsin mi? Bu işlem geri alınamaz.`)) return;
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) return toast(error.message || 'Silme işlemi başarısız.', false);
    toast('Kayıt silindi.');
    await window.loadView?.(hash());
  }

  async function markPaid(id) {
    const client = db();
    if (!client || !id) return;
    const { error } = await client.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast(error.message || 'Ödeme durumu güncellenemedi.', false);
    toast('Ödeme ödendi olarak kaydedildi.');
    await window.loadView?.('finance');
  }

  function rowId(row) {
    return row?.dataset?.spRowId || row?.querySelector('[data-id]')?.dataset?.id || row?.querySelector('[data-id]')?.getAttribute('data-id') || '';
  }

  async function decorateTable(view, table) {
    const spec = specs[view];
    const tableName = view === 'activity' ? 'activity_logs' : spec?.table;
    if (!tableName || table.dataset.spCanonicalActions === '1') return;
    table.dataset.spCanonicalActions = '1';
    table.dataset.spActions = '1';
    qa('.sp-runtime-actions', table).forEach(x => x.remove());
    let ids = [];
    try {
      let query = db().from(tableName).select('id');
      if (view === 'equipment') query = query.order('created_at', { ascending: false });
      else query = query.order('created_at', { ascending: false });
      const result = await query.limit(250);
      ids = (result.data || []).map(x => x.id);
    } catch (_) { return; }
    const head = table.tHead?.rows?.[0];
    if (head) {
      const th = document.createElement('th');
      th.className = 'sp-runtime-actions';
      th.textContent = 'İşlem';
      head.appendChild(th);
    }
    qa('tbody tr', table).forEach((tr, index) => {
      const id = rowId(tr) || ids[index];
      if (!id) return;
      tr.dataset.spRowId = id;
      const td = document.createElement('td');
      td.className = 'sp-runtime-actions';
      if (view !== 'activity') {
        const editBtn = document.createElement('button');
        editBtn.type = 'button'; editBtn.className = 'sp-runtime-edit'; editBtn.textContent = 'Düzenle';
        editBtn.onclick = () => edit(view, id);
        td.appendChild(editBtn);
      }
      if (view === 'finance') {
        const paid = document.createElement('button');
        paid.type = 'button'; paid.className = 'sp-runtime-edit'; paid.textContent = 'Ödendi';
        paid.onclick = () => markPaid(id);
        td.appendChild(paid);
      }
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'sp-runtime-delete'; del.textContent = 'Sil';
      del.onclick = () => remove(tableName, id, view === 'activity' ? 'Aktivite kaydı' : view === 'equipment' ? 'Ekipman kaydı' : 'Ödeme kaydı');
      td.appendChild(del);
      tr.appendChild(td);
    });
  }

  async function mediaActions() {
    if (hash() !== 'media') return;
    const cards = qa('.sp-media-card, [data-media-card]');
    if (!cards.length) return;
    const client = db();
    if (!client) return;
    const { data: { session } = {} } = await client.auth.getSession();
    if (!session?.access_token) return;
    const endpoint = `${window.STAGEPULSE_RUNTIME?.supabaseUrl || ''}/functions/v1/admin-github-media`;
    cards.forEach(card => {
      if (card.dataset.spMediaDelete === '1') return;
      const path = mediaPathFromCard(card);
      if (!path) return;
      card.dataset.spMediaDelete = '1';
      const actions = q('.actions,.modal-actions,.sp-runtime-actions', card) || card;
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'sp-runtime-delete'; del.textContent = 'Sil';
      del.onclick = async () => {
        if (!confirm('Bu medya dosyası silinsin mi? Bu işlem geri alınamaz.')) return;
        del.disabled = true;
        try {
          const r = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json', apikey:window.STAGEPULSE_RUNTIME?.supabasePublishableKey || '', Authorization:`Bearer ${session.access_token}`}, body:JSON.stringify({action:'delete',path}) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || 'Medya silinemedi.');
          toast('Medya silindi.');
          await window.loadView?.('media');
        } catch (e) { toast(e?.message || 'Medya silinemedi.', false); del.disabled = false; }
      };
      actions.appendChild(del);
    });
  }

  function mediaPathFromCard(card) {
    const explicit = card.dataset.path || card.dataset.mediaPath || card.dataset.filePath;
    if (explicit) return explicit;
    const link = qa('a[href]', card).find(a => /stagepulse\.com\.tr\//i.test(a.href) || /github\.com\/ibrahimFOH\/Stagepulse\.hatay\/blob\//i.test(a.href));
    if (!link) return '';
    try {
      const u = new URL(link.href);
      if (u.hostname === 'stagepulse.com.tr' || u.hostname === 'www.stagepulse.com.tr') return u.pathname.replace(/^\//, '');
      const m = u.pathname.match(/\/blob\/[^/]+\/(.+)$/);
      return m ? decodeURIComponent(m[1]) : '';
    } catch (_) { return ''; }
  }

  async function run() {
    const view = hash();
    const client = db();
    if (!client) return;
    if (['finance','equipment','activity'].includes(view)) {
      for (const table of qa('.admin-table')) await decorateTable(view, table);
    }
    await mediaActions();
  }

  const observer = new MutationObserver(() => { clearTimeout(window.__spActionRepairTimer); window.__spActionRepairTimer = setTimeout(run, 40); });
  const boot = () => {
    const content = q('#content');
    if (content) observer.observe(content, { childList:true, subtree:true });
    run();
  };
  window.addEventListener('hashchange', () => setTimeout(run, 80));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
