import * as XLSX from 'xlsx';
import { store } from '../../app/state.js';
import { uid, toast } from '../../utils/helpers.js';
import { saveData } from '../../data/database.js';
import { validateSiswa } from './siswaService.js';

export function handleImportExcel(file, onComplete) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt){
    try{
      const wb = XLSX.read(evt.target.result, { type:'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval:'' });
      let added = 0, skipped = 0;
      rows.forEach(r => {
        const nama = (r.Nama || r.nama || r.NAMA || '').toString().trim();
        const kelas = (r.Kelas || r.kelas || r.KELAS || '').toString().trim();
        const nis = (r.NIS || r.Nis || r.nis || '').toString().trim();
        const nisn = (r.NISN || r.Nisn || r.nisn || '').toString().trim();
        const nik = (r.NIK || r.Nik || r.nik || '').toString().trim();
        const tempatLahir = (r['Tempat Lahir'] || r.tempatLahir || r.TempatLahir || '').toString().trim();
        const tanggalLahir = (r['Tanggal Lahir'] || r.tanggalLahir || r.TanggalLahir || '').toString().trim();
        const jenisKelamin = (r['Jenis Kelamin'] || r.JK || r.jk || r.jenisKelamin || '').toString().trim();
        const namaWali = (r['Nama Wali'] || r.namaWali || r.Wali || r.OrangTua || '').toString().trim();
        const alamat = (r.Alamat || r.alamat || '').toString().trim();
        const noHp = (r['No. HP'] || r.noHp || r.WA || r.Wa || '').toString().trim();
        const pin = (r.PIN || r.Pin || r.pin || '').toString().trim();
        const rfidUid = (r['RFID'] || r.rfid || r.rfidUid || r.RFID_UID || '').toString().trim();

        if(!validateSiswa(nama, kelas, nis, null, rfidUid).valid){ skipped++; return; }
        store.state.siswa.push({
          id: uid(),
          nama,
          kelas,
          nis,
          nisn,
          nik,
          tempatLahir,
          tanggalLahir,
          jenisKelamin,
          namaWali,
          alamat,
          noHp,
          pin,
          rfidUid
        });
        added++;
      });
      saveData(`Import selesai: ${added} siswa ditambahkan${skipped ? `, ${skipped} baris dilewati` : ''}`);
      if (onComplete) onComplete();
    }catch(err){
      toast('Gagal membaca file Excel. Pastikan format kolom sesuai template.', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

export function downloadSiswaTemplate() {
  const ws = XLSX.utils.json_to_sheet([
    {
      Nama: 'Ahmad Fauzi',
      Kelas: '7A',
      NIS: '202601',
      NISN: '0081234567',
      NIK: '3207010101080001',
      'Tempat Lahir': 'Ciamis',
      'Tanggal Lahir': '2012-05-14',
      'Jenis Kelamin': 'L',
      'Nama Wali': 'H. Ridwan',
      Alamat: 'Dusun Bunter RT 02 RW 03',
      WA: '081234567890',
      PIN: '202601',
      RFID: '0012345678'
    }
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "FormatSiswa");
  XLSX.writeFile(wb, "Template_Data_Siswa_SPP.xlsx");
}

export function exportSiswaExcel() {
  if (!store.state.siswa || store.state.siswa.length === 0) {
    toast('Belum ada data siswa untuk diekspor.', 'warning');
    return;
  }
  const data = store.state.siswa.map((s, idx) => ({
    No: idx + 1,
    Nama: s.nama || '',
    Kelas: s.kelas || '',
    NIS: s.nis || '',
    NISN: s.nisn || '',
    NIK: s.nik || '',
    'Tempat Lahir': s.tempatLahir || '',
    'Tanggal Lahir': s.tanggalLahir || '',
    'Jenis Kelamin': s.jenisKelamin || '',
    'Nama Wali': s.namaWali || '',
    Alamat: s.alamat || '',
    'No. WhatsApp': s.noHp || '',
    PIN: s.pin || '',
    'UID RFID': s.rfidUid || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DataSiswa");
  const fileName = `Data_Siswa_${(store.state.settings?.namaSekolah || 'Sekolah').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  toast('Database siswa berhasil diekspor ke Excel', 'success');
}
