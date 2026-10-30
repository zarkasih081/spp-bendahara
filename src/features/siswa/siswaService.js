import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { uid, toast } from '../../utils/helpers.js';

export function getSiswaById(id) {
  return store.state.siswa.find(s => s.id === id);
}

export function validateSiswa(nama, kelas, nis, editingId, rfidUid = '') {
  if (!nama || !kelas) {
    return { valid: false, error: 'Nama dan kelas wajib diisi' };
  }
  if (nis) {
    const duplikat = store.state.siswa.find(s => s.nis === nis && (!editingId || s.id !== editingId));
    if (duplikat) {
      return { valid: false, error: 'NIS sudah terdaftar untuk siswa lain' };
    }
  }
  if (rfidUid) {
    const cleanUid = String(rfidUid).trim();
    const duplikatRfid = store.state.siswa.find(s => s.rfidUid && s.rfidUid.trim() === cleanUid && (!editingId || s.id !== editingId));
    if (duplikatRfid) {
      return { valid: false, error: `UID Kartu RFID sudah terdaftar atas nama ${duplikatRfid.nama}` };
    }
  }
  return { valid: true };
}

export function addSiswa(data) {
  store.state.siswa.push({ id: uid(), ...data });
  saveData('Siswa baru ditambahkan');
}

export function updateSiswa(id, data) {
  const s = getSiswaById(id);
  if (s) {
    Object.assign(s, data);
    saveData('Data siswa diperbarui');
  }
}

export function deleteSiswa(id) {
  store.state.siswa = store.state.siswa.filter(x => x.id !== id);
  store.state.pembayaran = store.state.pembayaran.filter(p => p.siswaId !== id);
  if (store.state.absensi) {
    store.state.absensi = store.state.absensi.filter(a => a.siswaId !== id);
  }
  saveData('Data siswa dihapus');
}

export function bulkDeleteSiswa(ids) {
  const idSet = new Set(ids);
  store.state.siswa = store.state.siswa.filter(s => !idSet.has(s.id));
  store.state.pembayaran = store.state.pembayaran.filter(p => !idSet.has(p.siswaId));
  if (store.state.absensi) {
    store.state.absensi = store.state.absensi.filter(a => !idSet.has(a.siswaId));
  }
  saveData('Data siswa masal dihapus');
}

export function promoteSiswa(ids, kelasBaru) {
  const idSet = new Set(ids);
  store.state.siswa.forEach(s => {
    if (idSet.has(s.id)) s.kelas = kelasBaru;
  });
  saveData('Siswa berhasil dinaikkan kelas');
}
