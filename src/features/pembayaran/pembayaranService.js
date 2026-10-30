import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { uid, siswaTotalBulan } from '../../utils/helpers.js';

export function getPembayaranBySiswaId(siswaId) {
  return store.state.pembayaran.filter(p => p.siswaId === siswaId).sort((a,b)=> new Date(b.tanggal)-new Date(a.tanggal));
}

export function getSuggestedSppNominal(siswaId, months, nominalSPP) {
  if (!months || months.length === 0) return 0;
  return months.reduce((sum, m) => {
    const sudah = siswaTotalBulan(siswaId, m.bulan, m.tahun);
    const kurang = Math.max(0, nominalSPP - sudah);
    return sum + (kurang > 0 ? kurang : nominalSPP);
  }, 0);
}

export function savePembayaranSPP(siswaId, nominal, tanggal, ket, months, noKwitansi) {
  const nominalSPP = store.state.settings.nominalSPP || 0;
  const sortedMonths = [...months].sort((a, b) => (a.tahun - b.tahun) || (a.bulan - b.bulan));
  let sisaUang = nominal;

  sortedMonths.forEach((m, i) => {
    if (sisaUang <= 0) return;
    const sudah = siswaTotalBulan(siswaId, m.bulan, m.tahun);
    const kurang = Math.max(0, nominalSPP - sudah);
    const targetBulanIni = kurang > 0 ? kurang : nominalSPP;
    const alokasi = (i === sortedMonths.length - 1) ? sisaUang : Math.min(sisaUang, targetBulanIni);
    sisaUang -= alokasi;

    if (alokasi > 0) {
      store.state.pembayaran.push({
        id: uid(), siswaId, jenis: 'spp', bulan: m.bulan, tahun: m.tahun,
        tanggal, nominal: alokasi, keterangan: ket, noKwitansi
      });
    }
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

export function savePembayaranPosTagihan(siswaId, posTagihanId, namaTagihan, nominal, tanggal, ket, noKwitansi) {
  const d = tanggal ? new Date(tanggal) : new Date();
  const bulan = !isNaN(d.getTime()) ? d.getMonth() + 1 : new Date().getMonth() + 1;
  const tahun = !isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
  store.state.pembayaran.push({
    id: uid(),
    siswaId,
    jenis: posTagihanId,
    namaTagihan,
    bulan,
    tahun,
    tanggal,
    nominal: parseInt(nominal, 10) || 0,
    keterangan: ket,
    noKwitansi
  });
  saveData('Pembayaran tersimpan');
}

export function getStatusPosTagihan(siswaId, posTagihanId, nominalKetetapan) {
  const terbayar = store.state.pembayaran
    .filter(p => p.siswaId === siswaId && p.jenis === posTagihanId)
    .reduce((sum, p) => sum + p.nominal, 0);
  return { terbayar, sisa: Math.max(0, nominalKetetapan - terbayar) };
}
