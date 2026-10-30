import fs from 'fs';
import path from 'path';
import { LOGO_BASE64 } from '../src/utils/constants.js';

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// 1. Create icons
const base64Data = LOGO_BASE64.replace(/^data:image\/jpeg;base64,/, "");
const iconPath192 = path.join(publicDir, 'icon-192.png');
const iconPath512 = path.join(publicDir, 'icon-512.png');

fs.writeFileSync(iconPath192, base64Data, 'base64');
fs.writeFileSync(iconPath512, base64Data, 'base64');

// 2. Create manifest.json
const manifest = {
  "name": "EduPass",
  "short_name": "EduPass",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#f3f4f6",
  "theme_color": "#333594",
  "icons": [
    {
      "src": "./icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "./icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
};

fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// 3. Create sw.js (Service Worker — Network-First with Offline Cache Fallback)
const swContent = `
const CACHE_NAME = 'edupass-v4';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
`;

fs.writeFileSync(path.join(publicDir, 'sw.js'), swContent.trim());
console.log('PWA setup completed.');
