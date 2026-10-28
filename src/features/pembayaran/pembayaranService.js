import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { uid } from '../../utils/helpers.js';

export function getPembayaranBySiswaId(siswaId) {
  return store.state.pembayaran.filter(p => p.siswaId === siswaId).sort((a,b)=> new Date(b.tanggal)-new Date(a.tanggal));
}

export function savePembayaranSPP(siswaId, nominal, tanggal, ket, months, noKwitansi) {
  const per = Math.floor(nominal / months.length);
  const remainder = nominal - per * months.length;
  months.forEach((m, i) => {
    store.state.pembayaran.push({
      id: uid(), siswaId, jenis: 'spp', bulan: m.bulan, tahun: m.tahun,
      tanggal, nominal: per + (i === 0 ? remainder : 0), keterangan: ket, noKwitansi
    });
  });
  saveData('Pembayaran tersimpan');
}

export function savePembayaranIjazah(siswaId, nominal, tanggal, ket, noKwitansi) {
  const d = tanggal ? new Date(tanggal) : new Date();
  const bulan = !isNaN(d.getTime()) ? d.getMonth() + 1 : new Date().getMonth() + 1;
  const tahun = !isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
  store.state.pembayaran.push({
    id: uid(), siswaId, jenis: 'ijazah', bulan, tahun,
    tanggal, nominal, keterangan: ket, noKwitansi
  });
  saveData('Pembayaran tersimpan');
}

export function generateNoKwitansi(tanggal) {
  store.state.settings.kwitansiCounter = (store.state.settings.kwitansiCounter || 0) + 1;
  return 'KW-' + new Date(tanggal).getFullYear() + '-' + String(store.state.settings.kwitansiCounter).padStart(4, '0');
}

export function cancelPembayaran(id) {
  store.state.pembayaran = store.state.pembayaran.filter(x => x.id !== id);
  saveData('Pembayaran dibatalkan');
}

export function getSisaTagihanIjazah(siswaId, nominalIjazah) {
  const ijazahTerbayar = store.state.pembayaran
    .filter(p => p.siswaId === siswaId && p.jenis === 'ijazah')
    .reduce((sum, p) => sum + p.nominal, 0);
  return { terbayar: ijazahTerbayar, sisa: Math.max(0, nominalIjazah - ijazahTerbayar) };
}
