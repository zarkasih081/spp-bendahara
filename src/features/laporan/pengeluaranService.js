import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { terbilang, fmtRupiah, escapeHtml } from '../../utils/formatters.js';
import { getSchoolLogo } from '../../utils/helpers.js';
import * as XLSX from 'xlsx';

export const KATEGORI_PENGELUARAN = [
  'ATK & Percetakan',
  'Honor & Transport Guru/Staf',
  'Listrik, Air & Internet',
  'Pemeliharaan & Sarana Gedung',
  'Kegiatan Siswa & PHBI',
  'Konsumsi & Jamuan',
  'Pengembangan Kurikulum & Ujian',
  'Lain-lain / Operasional Umum'
];

export function generateNoBkk(tanggalStr) {
  const settings = store.state.settings;
  settings.bkkCounter = (settings.bkkCounter || 0) + 1;
  const d = tanggalStr ? new Date(tanggalStr) : new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `BKK-${ym}-${String(settings.bkkCounter).padStart(4, '0')}`;
}

export function savePengeluaran(data) {
  if (!store.state.pengeluaran) store.state.pengeluaran = [];
  const noBkk = data.noBkk || generateNoBkk(data.tanggal);
  const item = {
    id: 'bkk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    noBkk,
    tanggal: data.tanggal,
    kategori: data.kategori || 'Operasional Umum',
    keterangan: data.keterangan || '-',
    nominal: parseInt(data.nominal, 10) || 0,
    penerima: data.penerima || 'Pihak Terkait',
    createdAt: new Date().toISOString()
  };

  store.state.pengeluaran.unshift(item);
  saveData('Pengeluaran kas berhasil dicatat');
  return item;
}

export function deletePengeluaran(id) {
  if (!store.state.pengeluaran) return;
  const idx = store.state.pengeluaran.findIndex(x => x.id === id);
  if (idx !== -1) {
    store.state.pengeluaran.splice(idx, 1);
    saveData('Data pengeluaran berhasil dihapus');
  }
}

export function cetakBuktiKasKeluar(bkk) {
  const printArea = document.getElementById('kwitansi-print-area');
  if (!printArea) return;

  const s = store.state.settings;
  const d = new Date(bkk.tanggal);
  const tanggalFmt = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const terbilangStr = terbilang(bkk.nominal) + ' Rupiah';

  printArea.innerHTML = `
    <div class="kwitansi-print-wrapper" style="max-width:740px; margin:0 auto; padding:24px; font-family:'Plus Jakarta Sans', sans-serif; color:#0F172A; background:#FFFFFF; border:2px solid #334155; border-radius:12px;">
      <!-- KOP RESMI -->
      <div style="display:flex; align-items:center; gap:16px; border-bottom:2.5px solid #1E293B; padding-bottom:14px; margin-bottom:14px;">
        <img src="${getSchoolLogo()}" alt="Logo" style="width:64px; height:64px; object-fit:contain;">
        <div style="flex:1;">
          <div style="font-size:18px; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:#1E1B4B;">${escapeHtml(s.namaSekolah)}</div>
          <div style="font-size:12px; color:#475569; margin-top:2px;">${escapeHtml(s.alamatSekolah)}</div>
          <div style="font-size:11px; color:#64748B; margin-top:1px;">Email / Kontak: ${escapeHtml(s.noHpBendahara || '-')}</div>
        </div>
        <div style="text-align:right;">
          <div style="display:inline-block; border:2px solid #EF4444; color:#DC2626; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:800; letter-spacing:0.05em;">
            BUKTI KAS KELUAR
          </div>
          <div style="font-size:12px; font-family:'IBM Plex Mono', monospace; font-weight:700; color:#1E293B; margin-top:4px;">
            ${escapeHtml(bkk.noBkk)}
          </div>
        </div>
      </div>

      <!-- KONTEN BKK -->
      <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:18px;">
        <tbody>
          <tr>
            <td style="padding:6px 0; width:160px; color:#64748B;">Tanggal Transaksi</td>
            <td style="padding:6px 0; width:10px;">:</td>
            <td style="padding:6px 0; font-weight:600;">${tanggalFmt}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748B;">Kategori Pengeluaran</td>
            <td style="padding:6px 0;">:</td>
            <td style="padding:6px 0; font-weight:700; color:#4338CA;">${escapeHtml(bkk.kategori)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748B;">Dibayarkan Kepada</td>
            <td style="padding:6px 0;">:</td>
            <td style="padding:6px 0; font-weight:700; font-size:14px;">${escapeHtml(bkk.penerima)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748B;">Jumlah Uang</td>
            <td style="padding:6px 0;">:</td>
            <td style="padding:6px 0; font-size:16px; font-weight:800; font-family:'IBM Plex Mono', monospace; color:#DC2626;">
              ${fmtRupiah(bkk.nominal)}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748B; vertical-align:top;">Terbilang</td>
            <td style="padding:6px 0; vertical-align:top;">:</td>
            <td style="padding:6px 0; font-style:italic; font-weight:600; color:#1E293B; background:#F8FAFC; padding:8px; border-radius:6px; border:1px dashed #CBD5E1;">
              "${terbilangStr}"
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0; color:#64748B; vertical-align:top;">Untuk Keperluan</td>
            <td style="padding:6px 0; vertical-align:top;">:</td>
            <td style="padding:6px 0; font-weight:500; line-height:1.5;">${escapeHtml(bkk.keterangan)}</td>
          </tr>
        </tbody>
      </table>

      <!-- BLOK TANDA TANGAN 3 KOLOM -->
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; text-align:center; font-size:12px; margin-top:28px; padding-top:12px; border-top:1px solid #E2E8F0;">
        <div>
          <div style="color:#64748B;">Penerima Uang,</div>
          <div style="height:60px;"></div>
          <div style="font-weight:700; text-decoration:underline;">${escapeHtml(bkk.penerima)}</div>
          <div style="font-size:10.5px; color:#94A3B8;">Tanda Tangan & Nama Terang</div>
        </div>
        <div>
          <div style="color:#64748B;">Bendahara Madrasah,</div>
          <div style="height:60px;"></div>
          <div style="font-weight:700; text-decoration:underline;">${escapeHtml(s.bendahara || 'Bendahara')}</div>
          <div style="font-size:10.5px; color:#94A3B8;">Pengelola Kas</div>
        </div>
        <div>
          <div style="color:#64748B;">Menyetujui, Kepala Madrasah</div>
          <div style="height:60px;"></div>
          <div style="font-weight:700; text-decoration:underline;">${escapeHtml(s.kepalaMadrasah || 'Kepala Madrasah')}</div>
          <div style="font-size:10.5px; color:#94A3B8;">NIP. ${escapeHtml(s.nipKepalaMadrasah || '-')}</div>
        </div>
      </div>

      <!-- FOOTER NOTE -->
      <div style="font-size:10.5px; color:#94A3B8; text-align:right; margin-top:20px; font-style:italic;">
        Dicetak otomatis melalui EduPass SPP & Kas Madrasah • ${new Date().toLocaleDateString('id-ID')}
      </div>
    </div>
  `;

  setTimeout(() => window.print(), 100);
}

export function exportPengeluaranExcel(pengeluaranList, periodeLabel) {
  const rows = pengeluaranList.map((p, idx) => ({
    'No': idx + 1,
    'No. BKK': p.noBkk,
    'Tanggal': p.tanggal,
    'Kategori': p.kategori,
    'Keterangan / Keperluan': p.keterangan,
    'Penerima': p.penerima,
    'Nominal (Rp)': p.nominal
  }));

  const totalPengeluaran = pengeluaranList.reduce((sum, p) => sum + p.nominal, 0);
  rows.push({
    'No': '',
    'No. BKK': '',
    'Tanggal': '',
    'Kategori': 'TOTAL PENGELUARAN',
    'Keterangan / Keperluan': '',
    'Penerima': '',
    'Nominal (Rp)': totalPengeluaran
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pengeluaran Kas');
  XLSX.writeFile(wb, `Pengeluaran_Kas_${(periodeLabel || 'Semua').replace(/\s+/g, '_')}.xlsx`);
}

