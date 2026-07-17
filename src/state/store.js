import { toast } from '../utils/helpers.js';
import { updateSaveTimestamp } from '../components/Navigation.js';

export const store = {
  state: null,
  ui: { 
    page: 'dashboard', 
    siswaSearch: '', 
    siswaKelasFilter: '', 
    riwayatSearch: '', 
    riwayatKelasFilter: '', 
    riwayatStatusFilter: '', 
    laporanBulan: null, 
    laporanTahun: null, 
    laporanKelas: '', 
    bayarSiswaId: null, 
    bayarSelectedMonths: [], 
    pageSiswa: 1, 
    pageRiwayat: 1, 
    activeTahunMulai: null,
    currentUser: null
  },
  isDataCorrupt: false
};

const STORAGE_KEY = 'spp-data-v1';

export function defaultState(){
  const now = new Date();
  return {
    settings: {
      namaSekolah: 'MTs Yasta Bunter',
      tahunAjaran: `${now.getFullYear()}/${now.getFullYear()+1}`,
      bendahara: '',
      nominalSPP: 150000,
      nominalIjazah: 500000,
      bulanMulai: 7,
      tahunMulai: now.getMonth()+1 >= 7 ? now.getFullYear() : now.getFullYear()-1,
      kwitansiCounter: 0,
      adminPassword: 'admin'
    },
    siswa: [],
    pembayaran: []
  };
}

export async function loadData(onLoaded){
  try{
    const storage = window.storage || { get: async (k) => ({ value: localStorage.getItem(k) }) };
    const res = await storage.get(STORAGE_KEY);
    if(res && res.value){
      try {
        store.state = JSON.parse(res.value);
        const d = defaultState();
        store.state.settings = Object.assign({}, d.settings, store.state.settings);
        if(!store.state.siswa) store.state.siswa = [];
        if(!store.state.pembayaran) store.state.pembayaran = [];
      } catch(err) {
        store.isDataCorrupt = true;
        alert("Gagal memuat data! File penyimpanan mungkin corrupt. Segera Restore Data dari Backup jika Anda memilikinya.");
        store.state = defaultState();
      }
    } else {
      store.state = defaultState();
    }
    
    // Load auth
    try {
      const auth = await storage.get('spp-auth-v1');
      if (auth && auth.value) {
        store.ui.currentUser = JSON.parse(auth.value);
      }
    } catch(e) {}
  }catch(e){
    store.state = defaultState();
  }
  if (onLoaded) onLoaded();
}

export async function saveAuth(user) {
  try {
    const storage = window.storage || { set: async (k, v) => localStorage.setItem(k, v) };
    if (user) {
      await storage.set('spp-auth-v1', JSON.stringify(user));
    } else {
      await storage.set('spp-auth-v1', ''); // or localStorage.removeItem if native
    }
  } catch(e) {}
}

let saveTimeout = null;
export function saveData(showToast){
  if(store.isDataCorrupt) {
    if(showToast) toast("Data gagal tersimpan: File penyimpanan terdeteksi corrupt.", 'error');
    return;
  }
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async ()=>{
    try{
      const storage = window.storage || { set: async (k, v) => localStorage.setItem(k, v) };
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
  store.isDataCorrupt = false;
}
