import { storage, STORAGE_KEY } from './storage.js';
import { hashPassword, loadAuth } from './authStorage.js';
import { store } from '../app/state.js';
import { toast } from '../utils/helpers.js';
import { updateSaveTimestamp, setSaveLoading } from '../components/Navigation.js';

export function defaultState(){
  const now = new Date();
  return {
    settings: {
      namaSekolah: 'MTs Yasta Bunter',
      tahunAjaran: `${now.getFullYear()}/${now.getFullYear()+1}`,
      bendahara: '',
      noHpBendahara: '',
      nominalSPP: 150000,
      nominalIjazah: 500000,
      bulanMulai: 7,
      tahunMulai: now.getMonth()+1 >= 7 ? now.getFullYear() : now.getFullYear()-1,
      kwitansiCounter: 0,
      adminPassword: 'admin',
      jamMasuk: '07:15',
      jamPulang: '14:00',
      beepAudio: true
    },
    siswa: [
      {
        id: 's-demo-1',
        nis: '202501',
        nama: 'Muhammad Rizky',
        kelas: '8A',
        noHp: '081234567890',
        pin: '202501'
      },
      {
        id: 's-demo-2',
        nis: '202502',
        nama: 'Siti Nurhaliza',
        kelas: '8A',
        noHp: '081234567891',
        pin: '202502'
      },
      {
        id: 's-demo-3',
        nis: '202503',
        nama: 'Ahmad Fauzi',
        kelas: '7B',
        noHp: '081234567892',
        pin: '202503'
      }
    ],
    pembayaran: [],
    absensi: [
      {
        id: 'absen-demo-1',
        siswaId: 's-demo-1',
        tanggal: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,
        jamMasuk: '05:40:00',
        jamPulang: '',
        status: 'hadir',
        keterangan: 'Tepat Waktu'
      }
    ]
  };
}

export async function loadData(onLoaded){
  try{
    const res = await storage.get(STORAGE_KEY);
    if(res && res.value){
      try {
        store.state = JSON.parse(res.value);
        const d = defaultState();
        store.state.settings = Object.assign({}, d.settings, store.state.settings);
        if(!store.state.siswa) store.state.siswa = [];
        if(!store.state.pembayaran) store.state.pembayaran = [];
        if(!store.state.absensi) store.state.absensi = [];
        // Migrate legacy 'telepon' field to 'noHp'
        store.state.siswa.forEach(s => {
          if (s.telepon && !s.noHp) {
            s.noHp = s.telepon;
            delete s.telepon;
          }
        });
      } catch(err) {
        store.isDataCorrupt = true;
        alert("Gagal memuat data! File penyimpanan mungkin corrupt. Segera Restore Data dari Backup jika Anda memilikinya.");
        store.state = defaultState();
      }
    } else {
      store.state = defaultState();
    }
    
    // Auto-convert plain-text password to hash for security
    if (store.state.settings.adminPassword && store.state.settings.adminPassword.length < 60) {
      store.state.settings.adminPassword = await hashPassword(store.state.settings.adminPassword);
      saveData();
    }
    
    // Load auth
    const currentUser = await loadAuth();
    if (currentUser) {
      store.ui.currentUser = currentUser;
    }
  }catch(e){
    store.state = defaultState();
  }
  if (onLoaded) onLoaded();
}

let saveTimeout = null;
export function saveData(showToast){
  if(store.isDataCorrupt) {
    if(showToast) toast("Data gagal tersimpan: File penyimpanan terdeteksi corrupt.", 'error');
    return;
  }
  clearTimeout(saveTimeout);
  setSaveLoading();
  saveTimeout = setTimeout(async ()=>{
    try{
      await storage.set(STORAGE_KEY, JSON.stringify(store.state));
      updateSaveTimestamp();
      if(showToast) toast(showToast);
    }catch(e){
      const el = document.getElementById('sidebar-foot');
      if(el) el.innerHTML = '<span class="dot" style="background:#EF4444;"></span><span class="foot-text">Gagal menyimpan</span>';
    }
  }, 250);
}

export function resetData() {
  store.state = defaultState();
  store.isDataCorrupt = false;
}

export function restoreData(parsed) {
  store.state = parsed;
  if (!store.state.absensi) store.state.absensi = [];
  store.isDataCorrupt = false;
}
