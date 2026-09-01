/* Stagepulse Admin — runtime repair for action buttons and server-side PDF flow. */
(() => {
  'use strict';

  const runtime = () => window.STAGEPULSE_RUNTIME || {};
  const client = () => window.sb || window.__stagepulseAdminClient || window.supabaseClient;
  const toast = (message, ok = true) => {
    if (typeof window.toast === 'function') window.toast(message, ok);
    else if (!ok) console.error(message);
  };

  async function sessionToken() {
    const c = client();
    if (!c) throw new Error('Yönetim bağlantısı hazır değil.');
    const { data, error } = await c.auth.getSession();
    if (error || !data?.session?.access_token) throw new Error('Yönetici oturumu bulunamadı.');
    return data.session.access_token;
  }

  async function edge(slug, body) {
    const cfg = runtime();
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) throw new Error('Supabase yapılandırması bulunamadı.');
    const token = await sessionToken();
    const response = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/functions/v1/${slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabasePublishableKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.error || `Sunucu işlemi başarısız (${response.status}).`);
    return data;
  }

  // Use the repository's canonical offer-pdf function. Versioned v3/v4
  // routes are not part of the deployed Supabase function tree.
  async function generatePdf(offerId) {
    if (!offerId) throw new Error('Teklif kimliği bulunamadı.');
    return edge('offer-pdf', { offer_id: offerId });
  }

  async function openPdf(offerId, download = false) {
    const generated = await generatePdf(offerId);
    const path = generated?.path;
    if (!path) throw new Error('PDF yolu oluşturulamadı.');
    const c = client();
    const { data, error } = await c.storage.from('offer-pdfs').createSignedUrl(path, 900, { download });
    if (error || !data?.signedUrl) throw error || new Error('PDF bağlantısı oluşturulamadı.');
    const target = window.open(data.signedUrl, '_blank', 'noopener');
    if (!target) location.href = data.signedUrl;
    return { url: data.signedUrl, generated };
  }

  window.openOfferPdfAdmin = openPdf;
  window.openOfferPdf = openPdf;
  window.stagepulseGenerateOfferPdf = generatePdf;

  window.addEventListener('stagepulse-admin-ready', () => {
    window.openOfferPdfAdmin = openPdf;
    window.openOfferPdf = openPdf;
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason && /PDF|Teklif|Supabase|Yönetici/i.test(String(reason.message || reason))) {
      toast(reason.message || String(reason), false);
    }
  });
})();
