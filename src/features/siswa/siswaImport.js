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
        const noHp = (r['No. HP'] || r.noHp || r.WA || r.Wa || '').toString().trim();
        const pin = (r.PIN || r.Pin || r.pin || '').toString().trim();
        if(! validateSiswa(nama, kelas, nis).valid){ skipped++; return; }
        store.state.siswa.push({ id: uid(), nama, kelas, nis, noHp, pin });
        added++;
      });
      saveData(`Import selesai: ${added} siswa ditambahkan${skipped ? `, ${skipped} baris dilewati` : ''}`);
      if (onComplete) onComplete();
    }catch(err){
      toast('Gagal membaca file. Pastikan format kolom: Nama, Kelas, NIS, WA', 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

export function downloadSiswaTemplate() {
  const ws = XLSX.utils.json_to_sheet([{ Nama: '', Kelas: '', NIS: '', WA: '', PIN: '' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "FormatSiswa");
  XLSX.writeFile(wb, "Template_Siswa_SPP.xlsx");
}
