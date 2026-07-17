# SPPKu — Aplikasi Bendahara Sekolah

![SPPKu Banner](public/icon-512.png)

SPPKu adalah aplikasi berbasis web (*Progressive Web App* / PWA) yang dirancang khusus untuk membantu bendahara sekolah dalam mencatat dan mengelola pembayaran SPP serta Ijazah secara digital, cepat, dan transparan. Aplikasi ini sepenuhnya berjalan di sisi klien (browser) tanpa memerlukan *backend server* atau *database* terpusat, menjadikannya sangat responsif dan aman untuk penggunaan pribadi.

## ✨ Fitur Utama

- 🔒 **Sistem Login Ganda (Role-Based)**
  - **Bendahara:** Mengelola data siswa, input pembayaran, pengaturan nominal, dan melihat laporan. Dilengkapi dengan proteksi PIN/Sandi *Hash SHA-256*.
  - **Siswa:** Dapat masuk menggunakan NIS dan PIN masing-masing untuk memantau riwayat pembayaran, sisa tunggakan, dan tagihan (Read-only).
- 💰 **Manajemen Pembayaran SPP & Ijazah**
  - **SPP:** Mencatat pembayaran per bulan. Tampilan grid interaktif untuk melihat bulan mana yang sudah/belum lunas.
  - **Ijazah:** Mendukung pembayaran Ijazah dengan sistem *cicilan fleksibel*. Sisa tagihan dihitung otomatis.
- 🖨️ **Cetak Kwitansi**
  - Fitur cetak kwitansi otomatis setelah pembayaran, diformat rapi untuk dicetak menggunakan printer *thermal* maupun *inkjet*.
- 📊 **Laporan & Dashboard**
  - Ringkasan pemasukan total, tunggakan kelas, riwayat transaksi terakhir.
  - Filter laporan pemasukan berdasarkan Bulan, Tahun, atau Kelas.
- 🌙 **Mode Gelap (Dark Mode)**
  - Tampilan yang nyaman di mata dengan mode terang/gelap yang tersimpan secara otomatis.
- 📱 **Progressive Web App (PWA)**
  - Bisa diinstal layaknya aplikasi native di PC maupun Smartphone (Android/iOS).
  - Tampilan *mobile-first* yang mulus dan *responsive*.
- 💾 **Penyimpanan Lokal & Backup**
  - Semua data disimpan secara lokal di perangkat Anda (*localStorage/IndexedDB*).
  - Dilengkapi fitur **Export / Import (Backup & Restore) ke JSON** untuk menjaga data Anda tetap aman saat berpindah perangkat.

## 🚀 Cara Instalasi & Penggunaan

Karena aplikasi ini di-build menggunakan *Vite Plugin Singlefile*, Anda bisa langsung meng-host aplikasi ini di GitHub Pages, Vercel, Netlify, atau web server manapun.

### Pengembangan Lokal

Pastikan Anda telah menginstal **Node.js** di komputer Anda.

1. **Clone Repository**
   ```bash
   git clone https://github.com/zarkasih081/spp-bendahara.git
   cd spp-bendahara
   ```
2. **Install Dependensi**
   ```bash
   npm install
   ```
3. **Jalankan Server Development**
   ```bash
   npm run dev
   ```
   Buka `http://localhost:5173` di browser Anda.

### Build & Deploy (GitHub Pages)

Aplikasi ini telah dikonfigurasi untuk memudahkan proses *deploy* ke GitHub Pages.

1. Jalankan perintah untuk build:
   ```bash
   npm run build
   ```
2. Deploy langsung ke *branch* `gh-pages`:
   ```bash
   npm run deploy
   ```
   *(Pastikan pengaturan repositori GitHub Anda bagian **Settings > Pages** menggunakan source branch `gh-pages`)*.

## 🔐 Konfigurasi Awal (Tidak Butuh .env)

Aplikasi ini 100% *Client-Side* dan menyimpan data secara lokal. Anda tidak memerlukan file `.env` atau *database configuration*. 

- **Login Bendahara Default:**
  - Username: `admin`
  - Password: `admin`
  - *(Penting: Segera ubah password ini di menu **Pengaturan** setelah Anda berhasil login)*.

## 🛠️ Stack Teknologi

- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 Custom (Tailwind-like variables)
- **Build Tool:** [Vite](https://vitejs.dev/) + [vite-plugin-singlefile](https://www.npmjs.com/package/vite-plugin-singlefile)
- **Export Data:** [SheetJS (xlsx)](https://docs.sheetjs.com/)
- **Icons:** Inline SVG Icons

## 🛡️ Keamanan & Privasi Data

- **Penyimpanan Lokal:** Karena data tersimpan di browser perangkat, **JANGAN** menggunakan mode penyamaran (*Incognito/Private Mode*) karena data akan terhapus saat browser ditutup.
- **Backup Rutin:** Sangat disarankan untuk menekan tombol **Download Backup** (di menu Pengaturan) secara berkala untuk menghindari kehilangan data jika perangkat rusak atau *cache* browser terhapus.

---
Dibuat dengan ❤️ untuk memudahkan pekerjaan bendahara di mana saja.
