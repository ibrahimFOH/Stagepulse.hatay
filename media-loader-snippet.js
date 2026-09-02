/* ============================================================
   STAGEPULSE — Customer Media Loader
   Public customer web only.
   Never touches admin, personnel, portal or teklif form logic.
   ============================================================ */
(function () {
  'use strict';

  const MEDIA_CDN = 'https://media.githubusercontent.com/media/ibrahimFOH/Stagepulse.hatay/main/';

  function safeMediaUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const clean = String(path).replace(/^\.\//, '').replace(/^\//, '');
    /* Public GitHub Pages cannot render Git-LFS pointer files directly. */
    if (/^images\//i.test(clean)) return MEDIA_CDN + clean.split('/').map(encodeURIComponent).join('/');
    return clean.split('/').map(encodeURIComponent).join('/');
  }

  async function loadMediaJson() {
    try {
      const res = await fetch('/media.json?_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) throw new Error('media.json HTTP ' + res.status);
      const data = await res.json();
      return {
        gallery: Array.isArray(data.gallery) ? data.gallery : [],
        videos: Array.isArray(data.videos) ? data.videos : [],
        documents: Array.isArray(data.documents) ? data.documents : []
      };
    } catch (err) {
      console.warn('Stagepulse media yükleme hatası:', err);
      return { gallery: [], videos: [], documents: [] };
    }
  }

  function ensureLightbox() {
    let box = document.getElementById('customerLightbox');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'customerLightbox';
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<button class="lightbox-close" type="button" aria-label="Kapat">×</button><img alt="">';
    document.body.appendChild(box);
    const close = () => { box.classList.remove('open'); document.body.style.overflow = ''; };
    box.querySelector('.lightbox-close')?.addEventListener('click', close);
    box.addEventListener('click', event => { if (event.target === box) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    return box;
  }

  function openLightbox(src, alt) {
    if (!src) return;
    const box = ensureLightbox();
    const image = box.querySelector('img');
    if (!image) return;
    image.src = src;
    image.alt = alt || 'Stagepulse galeri görseli';
    box.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function createGalleryItem(item) {
    const src = safeMediaUrl(item.webp || item.path);
    const fallback = safeMediaUrl(item.path);
    const alt = String(item.name || '').replace(/\.[^/.]+$/, '');
    const figure = document.createElement('figure');
    figure.className = 'gallery-item';
    const img = document.createElement('img');
    img.src = src || fallback;
    img.dataset.full = src || fallback;
    img.alt = alt || 'Stagepulse galeri görseli';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => { if (fallback && img.src !== fallback) img.src = fallback; });
    img.addEventListener('click', () => openLightbox(img.dataset.full || img.src, img.alt));
    figure.appendChild(img);
    return figure;
  }

  function createVideoItem(item) {
    const wrap = document.createElement('div');
    wrap.className = 'video-item';
    const video = document.createElement('video');
    video.src = safeMediaUrl(item.path);
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const title = document.createElement('p');
    title.className = 'video-title';
    title.textContent = item.title || item.name || '';
    wrap.append(video, title);
    return wrap;
  }

  function createDocItem(item) {
    const link = document.createElement('a');
    link.className = 'doc-item';
    link.href = safeMediaUrl(item.path);
    link.target = '_blank';
    link.rel = 'noopener';
    link.dataset.title = item.title || '';
    link.innerHTML = '<i class="fa-solid fa-file"></i>';
    const name = document.createElement('span');
    name.textContent = item.title || item.name || '';
    const size = document.createElement('small');
    size.textContent = item.size_human || '';
    link.append(name, size);
    return link;
  }

  async function initMediaSections() {
    const data = await loadMediaJson();
    const galleryContainer = document.getElementById('gallery') || document.getElementById('gallery-grid') || document.querySelector('.gallery-grid');
    if (galleryContainer && data.gallery.length) {
      galleryContainer.innerHTML = '';
      data.gallery.forEach(item => galleryContainer.appendChild(createGalleryItem(item)));
    }
    const videoContainer = document.getElementById('videos') || document.getElementById('video-grid') || document.querySelector('.video-grid');
    if (videoContainer && data.videos.length) {
      videoContainer.innerHTML = '';
      data.videos.forEach(item => videoContainer.appendChild(createVideoItem(item)));
    }
    const docContainer = document.getElementById('docs-list') || document.querySelector('.docs-list');
    if (docContainer && data.documents.length) {
      docContainer.innerHTML = '';
      data.documents.forEach(item => docContainer.appendChild(createDocItem(item)));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMediaSections, { once: true });
  else initMediaSections();
})();
