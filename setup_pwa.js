import fs from 'fs';
import path from 'path';
import { LOGO_BASE64 } from './src/utils/constants.js';

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
  "name": "SPPKu",
  "short_name": "SPPKu",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0d9488",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
};

fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// 3. Create sw.js (Service Worker)
const swContent = `
const CACHE_NAME = 'buku-spp-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});
`;

fs.writeFileSync(path.join(publicDir, 'sw.js'), swContent.trim());
console.log('PWA setup completed.');
