# Panduan Integrasi Database Cloud (Firebase)

Dokumen ini dibuat khusus untuk Anda sebagai panduan jika di kemudian hari Anda ingin mengubah sistem penyimpanan aplikasi **SPPKu** dari penyimpanan lokal (Browser) menjadi penyimpanan awan (*Cloud*). 

Dengan Database Cloud, data SPP Anda tidak akan hilang meski Anda mengganti perangkat (HP/Laptop) dan data akan otomatis tersinkronisasi secara *real-time*.

---

## 🛠️ Tahap 1: Membuat Database di Google Firebase (Gratis)

Langkah ini harus Anda lakukan sendiri karena menyangkut akun Google dan kepemilikan data pribadi Anda.

1. Buka situs **[Firebase Console](https://console.firebase.google.com/)**.
2. Login menggunakan akun Google (Gmail) Anda.
3. Klik tombol **Create a project** (Buat proyek).
4. Beri nama proyek Anda, misalnya `sppku-database`, lalu klik **Continue**.
5. Jika ditanya mengenai *Google Analytics*, matikan saja (Disable), lalu klik **Create Project**.
6. Setelah proyek selesai dibuat, lihat menu di sebelah kiri layar, klik menu **Build**, lalu pilih **Firestore Database**.
7. Klik tombol **Create database**. 
8. Akan muncul pilihan mode keamanan. Pilih **Start in test mode** (Mode pengujian), lalu klik Next dan Enable. 
   *(Catatan: Mode test ini agar aplikasi web Anda bisa langsung membaca dan menulis data tanpa harus repot mengatur sistem Login Google/Email).*
9. Kembali ke halaman beranda proyek Firebase Anda (Klik ikon rumah/Project Overview di kiri atas).
10. Anda akan melihat tulisan *"Get started by adding Firebase to your app"*. Klik ikon **Web** (berlogo `</>`).
11. Beri nama aplikasi `SPPKu Web`, lalu klik **Register app**.
12. **Selesai!** Anda akan mendapatkan sebuah kotak berisi kode bernama `firebaseConfig`. Kodenya terlihat seperti ini:
    ```javascript
    const firebaseConfig = {
      apiKey: "AIzaSyB-xxxxxxx",
      authDomain: "sppku-xxxx.firebaseapp.com",
      projectId: "sppku-xxxx",
      storageBucket: "sppku-xxxx.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef"
    };
    ```

---

## 💻 Tahap 2: Menghubungkan Firebase dengan Kode Aplikasi

Jika Anda sudah mendapatkan kode `firebaseConfig` di atas, ikuti langkah berikut untuk memasukkannya ke dalam aplikasi SPPKu.

### 1. Install Firebase
Buka terminal/Command Prompt di folder proyek Anda, lalu jalankan perintah:
```bash
npm install firebase
```

### 2. Buat file `src/utils/firebase.js`
Buatlah sebuah file baru bernama `firebase.js` di dalam folder `src/utils/`, lalu masukkan kode berikut (jangan lupa ganti `firebaseConfig` dengan milik Anda):

```javascript
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

// TODO: GANTI KODE DI BAWAH INI DENGAN firebaseConfig MILIK ANDA!
const firebaseConfig = {
  apiKey: "AIzaSyB-xxxxxxx",
  authDomain: "sppku-xxxx.firebaseapp.com",
  projectId: "sppku-xxxx",
  storageBucket: "sppku-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ID Dokumen unik untuk menyimpan data SPP Anda
const DOC_ID = "sppku-data-master"; 

export async function getCloudData() {
  const docRef = doc(db, "sppku", DOC_ID);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { value: docSnap.data().jsonString };
  } else {
    return null;
  }
}

export async function setCloudData(key, jsonString) {
  // Kita abaikan 'key' dari localStorage, kita langsung timpa dokumen utama
  const docRef = doc(db, "sppku", DOC_ID);
  await setDoc(docRef, { jsonString: jsonString });
}
```

### 3. Modifikasi File `src/main.js`
Buka file `src/main.js`, lalu tambahkan baris kode ini di bagian **paling atas**:

```javascript
import { getCloudData, setCloudData } from './utils/firebase.js';

// Mengubah mekanisme penyimpanan dari LocalStorage menjadi Cloud Firebase
window.storage = {
  get: getCloudData,
  set: setCloudData
};
```

---

## ✅ Tahap 3: Uji Coba

Setelah ketiga tahap di atas dilakukan, simpan semua file, lalu jalankan ulang server (`npm run dev`).

Sekarang, setiap kali Anda menambah siswa atau menginput pembayaran, datanya akan langsung dikirim ke Cloud Firestore milik Google. 

Anda bisa membuka link website dari HP Anda, dan semua data dari Laptop akan otomatis muncul di sana!

***Catatan Tambahan:** Jika di masa depan Anda benar-benar ingin mengimplementasikannya dan butuh bantuan, Anda cukup memberikan file kode `firebaseConfig` Anda ke AI Assistant, dan asisten tersebut akan melakukan sisa modifikasi kodenya secara otomatis.*
