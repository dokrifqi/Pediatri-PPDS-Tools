// Service Worker — Pediatri & PPDS Tools
//
// STRATEGI UPDATE OTOMATIS:
// - index.html & manifest.json  -> NETWORK-FIRST: selalu coba ambil versi
//   terbaru dari server dulu. Kalau berhasil, cache diperbarui. Kalau offline,
//   baru pakai salinan cache terakhir. Ini yang membuat perubahan (mis. data
//   BP_DATA) langsung terlihat tanpa perlu uninstall/reinstall PWA.
// - Ikon-ikon (jarang berubah) -> CACHE-FIRST agar hemat kuota & cepat.
//
// PENTING: setiap kali Anda mengedit index.html/manifest, cukup naikkan
// CACHE_NAME (mis. v2 -> v3). Ini memicu Service Worker baru ter-install,
// cache lama dibersihkan, dan halaman otomatis reload ke versi terbaru.

const CACHE_NAME = "ppds-tools-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

// File yang SELALU dicek ke network dulu (network-first)
const NETWORK_FIRST_FILES = ["index.html", "manifest.json", "./", ""];

function isNetworkFirst(url) {
  const path = new URL(url).pathname;
  return NETWORK_FIRST_FILES.some(
    (f) => path.endsWith(f) || path.endsWith("/")
  );
}

// Install: simpan aset inti, langsung aktif tanpa menunggu tab lama ditutup
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: hapus cache versi lama, ambil alih semua tab yang terbuka
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = event.request.url;
  if (!url.startsWith(self.location.origin)) return;

  if (isNetworkFirst(url)) {
    // NETWORK-FIRST: coba online dulu, cache hanya sebagai fallback offline
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // CACHE-FIRST: untuk ikon & aset statis lain
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});

// Terima pesan dari halaman untuk langsung aktifkan SW baru (skip waiting)
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
