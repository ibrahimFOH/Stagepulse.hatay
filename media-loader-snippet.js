/* ============================================================
   STAGEPULSE – Sağlam Medya Yükleyici (script.js içine ekle)
   - Türkçe, boşluk, özel karakterli dosya adlarını destekler
   - gallery / videos / documents otomatik okur
   - WebP varsa tercih eder
   - Video için hazır
   ============================================================ */

function safeMediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

async function loadMediaJson() {
  try {
    const res = await fetch('media.json?_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('media.json yüklenemedi');
    return await res.json();
  } catch (err) {
    console.warn('Media yükleme hatası:', err);
    return { gallery: [], videos: [], documents: [] };
  }
}

function createGalleryItem(item) {
  const src = item.webp ? safeMediaUrl(item.webp) : safeMediaUrl(item.path);
  const fallback = safeMediaUrl(item.path);

  const figure = document.createElement('figure');
  figure.className = 'gallery-item';
  figure.innerHTML = `
    <img 
      src="${src}" 
      data-full="${fallback}"
      alt="${item.name.replace(/\.[^/.]+$/, '')}"
      loading="lazy"
      decoding="async"
      onerror="this.src='${fallback}'"
    >
  `;
  return figure;
}

function createVideoItem(item) {
  const src = safeMediaUrl(item.path);
  const wrap = document.createElement('div');
  wrap.className = 'video-item';
  wrap.innerHTML = `
    <video 
      src="${src}" 
      controls 
      playsinline 
      preload="metadata"
      poster=""
    ></video>
    <p class="video-title">${item.name}</p>
  `;
  return wrap;
}

function createDocItem(item) {
  const href = safeMediaUrl(item.path);
  const a = document.createElement('a');
  a.className = 'doc-item';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.innerHTML = `
    <i class="fa-solid fa-file-pdf"></i>
    <span>${item.name}</span>
    <small>${item.size_human || ''}</small>
  `;
  return a;
}

async function initMediaSections() {
  const data = await loadMediaJson();

  // Galeri
  const galleryContainer = document.getElementById('gallery-grid') || document.querySelector('.gallery-grid');
  if (galleryContainer && data.gallery) {
    galleryContainer.innerHTML = '';
    data.gallery.forEach(item => {
      galleryContainer.appendChild(createGalleryItem(item));
    });
  }

  // Videolar
  const videoContainer = document.getElementById('video-grid') || document.querySelector('.video-grid');
  if (videoContainer && data.videos) {
    videoContainer.innerHTML = '';
    data.videos.forEach(item => {
      videoContainer.appendChild(createVideoItem(item));
    });
  }

  // Dokümanlar
  const docContainer = document.getElementById('docs-list') || document.querySelector('.docs-list');
  if (docContainer && data.documents) {
    docContainer.innerHTML = '';
    data.documents.forEach(item => {
      docContainer.appendChild(createDocItem(item));
    });
  }
}

// DOM hazır olduğunda çalıştır
document.addEventListener('DOMContentLoaded', () => {
  initMediaSections();
});
