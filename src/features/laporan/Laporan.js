import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { getPeriode, BULAN, downloadFile, toast, getActiveTahunMulai } from '../../utils/helpers.js';
import { escapeHtml, escapeAttr, fmtDate, fmtRupiah } from '../../utils/formatters.js';
import { openConfirm } from '../../components/Modal.js';
import { cetakKwitansi } from '../pembayaran/kwitansi.js';
import { LOGO_BASE64 } from '../../utils/constants.js';
import * as XLSX from 'xlsx';

export function renderLaporan(){
  const el = document.getElementById('page-laporan');
  if (!store.ui.laporanViewMode) store.ui.laporanViewMode = 'bulanan';

  const viewMode = store.ui.laporanViewMode;

  el.innerHTML = `
    <!-- Top Sub-Navigation Tabs -->
    <div class="tabs" style="margin-bottom:16px;">
      <button class="tab-btn ${viewMode === 'bulanan' ? 'active' : ''}" id="tab-lap-bulanan">
        Laporan Bulanan & Transaksi
      </button>
      <button class="tab-btn ${viewMode === 'tahunan' ? 'active' : ''}" id="tab-lap-tahunan">
        Rekap Kas Tahunan (1 Tahun Ajaran / BKU)
      </button>
    </div>

    <div id="laporan-tab-content"></div>
  `;

  document.getElementById('tab-lap-bulanan')?.addEventListener('click', () => {
    store.ui.laporanViewMode = 'bulanan';
    renderLaporan();
  });

  document.getElementById('tab-lap-tahunan')?.addEventListener('click', () => {
    store.ui.laporanViewMode = 'tahunan';
    renderLaporan();
  });

  const contentEl = document.getElementById('laporan-tab-content');

  if (viewMode === 'bulanan') {
    renderLaporanBulanan(contentEl);
  } else {
    renderLaporanTahunan(contentEl);
  }
}

// -------------------------------------------------------------
// TAB 1: LAPORAN BULANAN & DAFTAR TRANSAKSI
// -------------------------------------------------------------
function renderLaporanBulanan(contentEl) {
  const now = new Date();
  if(store.ui.laporanBulan===null) store.ui.laporanBulan = now.getMonth()+1;
  if(store.ui.laporanTahun===null) store.ui.laporanTahun = now.getFullYear();

  const kelasList = [...new Set(store.state.siswa.map(s=>s.kelas))].sort();
  const paymentYears = store.state.pembayaran.map(p => p.tahun || (p.tanggal ? new Date(p.tanggal).getFullYear() : null)).filter(Boolean);
  const tahunOptions = [...new Set([...getPeriode().map(p=>p.tahun), ...paymentYears, store.ui.laporanTahun])].sort((a,b)=>a-b);

  let rows = store.state.pembayaran.filter(p=>{
    const pBulan = p.bulan || (p.tanggal ? new Date(p.tanggal).getMonth() + 1 : null);
    const pTahun = p.tahun || (p.tanggal ? new Date(p.tanggal).getFullYear() : null);
    return pBulan === store.ui.laporanBulan && pTahun === store.ui.laporanTahun;
  });
  if(store.ui.laporanKelas){
    const idsInKelas = new Set(store.state.siswa.filter(s=>s.kelas===store.ui.laporanKelas).map(s=>s.id));
    rows = rows.filter(p=>idsInKelas.has(p.siswaId));
  }
  rows = rows.sort((a,b)=> new Date(b.tanggal)-new Date(a.tanggal));
  const totalSPP = rows.filter(p=>!p.jenis || p.jenis==='spp').reduce((a,p)=>a+p.nominal,0);
  const totalIjazah = rows.filter(p=>p.jenis==='ijazah').reduce((a,p)=>a+p.nominal,0);
  const total = totalSPP + totalIjazah;

  contentEl.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <select id="laporan-bulan">${BULAN.map((b,i)=>`<option value="${i+1}" ${store.ui.laporanBulan===i+1?'selected':''}>${b}</option>`).join('')}</select>
        <select id="laporan-tahun">${tahunOptions.map(t=>`<option value="${t}" ${store.ui.laporanTahun===t?'selected':''}>${t}</option>`).join('')}</select>
        <select id="laporan-kelas"><option value="">Semua Kelas</option>${kelasList.map(k=>`<option value="${escapeAttr(k)}" ${store.ui.laporanKelas===k?'selected':''}>${escapeHtml(k)}</option>`).join('')}</select>
      </div>
      <div class="toolbar-right" style="gap:8px;">
        <button class="btn" id="btn-export-laporan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg> Export CSV</button>
        <button class="btn btn-primary" id="btn-export-laporan-excel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Export Excel</button>
      </div>
    </div>

    <div class="kpi-line" style="margin-bottom: 16px;">
      <div class="kpi"><span class="n">${fmtRupiah(total)}</span><span class="l">Total Diterima</span></div>
      <div class="kpi"><span class="n">${fmtRupiah(totalSPP)}</span><span class="l">Total SPP</span></div>
      <div class="kpi"><span class="n">${fmtRupiah(totalIjazah)}</span><span class="l">Total Ijazah</span></div>
    </div>
    
    <div class="kpi-line">
      <div class="kpi"><span class="n">${rows.length}</span><span class="l">Jumlah Transaksi</span></div>
      <div class="kpi"><span class="n">${new Set(rows.map(r=>r.siswaId)).size}</span><span class="l">Siswa Membayar</span></div>
    </div>

    <div class="card" style="padding:0;">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Tanggal</th><th>Nama Siswa</th><th>Kelas</th><th>No. Kwitansi</th><th>Jenis</th><th class="num">Nominal</th><th style="width:80px; text-align:right;">Aksi</th></tr></thead>
          <tbody id="laporan-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = document.getElementById('laporan-tbody');
  if(rows.length===0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Belum ada transaksi pada periode ini.</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(p=>{
      const s = store.state.siswa.find(x=>x.id===p.siswaId) || {nama:'(dihapus)', kelas:'-'};
      return `<tr>
        <td>${fmtDate(p.tanggal)}</td>
        <td>${escapeHtml(s.nama)}</td>
        <td><span class="kelas-chip">${escapeHtml(s.kelas)}</span></td>
        <td>${p.noKwitansi||'-'}</td>
        <td>${p.jenis==='ijazah' ? 'Ijazah' : `SPP (${BULAN[(p.bulan||1)-1]} ${p.tahun||''})`}</td>
        <td class="num">${fmtRupiah(p.nominal)}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn btn-sm btn-ghost" data-cetak-lap="${p.id}" title="Cetak Ulang Kwitansi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18h12v4H6v-4zM4 9h16v7H4z"/></svg></button>
          <button class="btn btn-sm btn-ghost" data-del-lap="${p.id}" title="Hapus transaksi" style="color:var(--rust);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
        </td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('[data-cetak-lap]').forEach(b=>b.addEventListener('click', ()=>{
      const p = store.state.pembayaran.find(x=>x.id===b.dataset.cetakLap);
      if (!p) return;
      const s = store.state.siswa.find(x=>x.id===p.siswaId) || { nama:'(Siswa Dihapus)', kelas:'-', nis:'-' };
      const jenis = p.jenis || 'spp';
      cetakKwitansi(s, [{ bulan: p.bulan || 1, tahun: p.tahun || new Date().getFullYear() }], p.nominal, p.noKwitansi || 'KW-ARSIP', p.tanggal, jenis);
    }));
    tbody.querySelectorAll('[data-del-lap]').forEach(b=>b.addEventListener('click', ()=>{
      openConfirm('Batalkan transaksi pembayaran ini?', ()=>{
        store.state.pembayaran = store.state.pembayaran.filter(x=>x.id!==b.dataset.delLap);
        saveData('Pembayaran dibatalkan');
        renderLaporan();
      });
    }));
  }
  document.getElementById('laporan-bulan').addEventListener('change', e=>{ store.ui.laporanBulan=+e.target.value; renderLaporan(); });
  document.getElementById('laporan-tahun').addEventListener('change', e=>{ store.ui.laporanTahun=+e.target.value; renderLaporan(); });
  document.getElementById('laporan-kelas').addEventListener('change', e=>{ store.ui.laporanKelas=e.target.value; renderLaporan(); });
  document.getElementById('btn-export-laporan').addEventListener('click', ()=>exportLaporanCsv(rows));
  document.getElementById('btn-export-laporan-excel').addEventListener('click', ()=>exportLaporanExcel(rows));
}

// -------------------------------------------------------------
// TAB 2: REKAP KAS TAHUNAN (1 TAHUN AJARAN PENUH / BKU 12 BULAN)
// -------------------------------------------------------------
function renderLaporanTahunan(contentEl) {
  const baseTa = store.state.settings.tahunMulai || new Date().getFullYear();
  if (!store.ui.laporanTahunanTa) store.ui.laporanTahunanTa = baseTa;
  if (store.ui.laporanTahunanKelas === undefined) store.ui.laporanTahunanKelas = '';

  const activeTaStart = store.ui.laporanTahunanTa;
  const startMonth = store.state.settings.bulanMulai || 7;

  // Generate 12 months for selected Academic Year
  const periode12 = [];
  let curB = startMonth;
  let curT = activeTaStart;
  for (let i = 0; i < 12; i++) {
    periode12.push({ bulan: curB, tahun: curT, bulanName: BULAN[curB - 1] });
    curB++;
    if (curB > 12) {
      curB = 1;
      curT++;
    }
  }

  const taOptions = [];
  for (let y = baseTa - 3; y <= baseTa + 3; y++) {
    taOptions.push(y);
  }

  const kelasList = [...new Set(store.state.siswa.map(s => s.kelas))].sort();

  // Filter payments by class if chosen
  let paymentsPool = store.state.pembayaran;
  if (store.ui.laporanTahunanKelas) {
    const studentIdsInKelas = new Set(store.state.siswa.filter(s => s.kelas === store.ui.laporanTahunanKelas).map(s => s.id));
    paymentsPool = paymentsPool.filter(p => studentIdsInKelas.has(p.siswaId));
  }

  // Calculate monthly figures (Cash basis: matched by payment month/year)
  const monthlyData = periode12.map((p, idx) => {
    const monthPayments = paymentsPool.filter(pay => {
      const payBulan = pay.bulan || (pay.tanggal ? new Date(pay.tanggal).getMonth() + 1 : null);
      const payTahun = pay.tahun || (pay.tanggal ? new Date(pay.tanggal).getFullYear() : null);
      return payBulan === p.bulan && payTahun === p.tahun;
    });

    const spp = monthPayments.filter(pay => !pay.jenis || pay.jenis === 'spp').reduce((sum, pay) => sum + pay.nominal, 0);
    const ijazah = monthPayments.filter(pay => pay.jenis === 'ijazah').reduce((sum, pay) => sum + pay.nominal, 0);
    const total = spp + ijazah;
    const trxCount = monthPayments.length;
    const uniqueStudents = new Set(monthPayments.map(pay => pay.siswaId)).size;

    return {
      no: idx + 1,
      bulan: p.bulan,
      tahun: p.tahun,
      label: `${p.bulanName} ${p.tahun}`,
      spp,
      ijazah,
      total,
      trxCount,
      uniqueStudents
    };
  });

  const grandSPP = monthlyData.reduce((acc, m) => acc + m.spp, 0);
  const grandIjazah = monthlyData.reduce((acc, m) => acc + m.ijazah, 0);
  const grandTotal = grandSPP + grandIjazah;
  const grandTrx = monthlyData.reduce((acc, m) => acc + m.trxCount, 0);
  const avgPerBulan = grandTotal > 0 ? Math.round(grandTotal / 12) : 0;

  contentEl.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <select id="lap-ta-select">
          ${taOptions.map(y => `<option value="${y}" ${y === activeTaStart ? 'selected' : ''}>Tahun Ajaran ${y}/${y+1}</option>`).join('')}
        </select>
        <select id="lap-ta-kelas">
          <option value="">Semua Kelas</option>
          ${kelasList.map(k => `<option value="${escapeAttr(k)}" ${store.ui.laporanTahunanKelas === k ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right" style="gap:8px;">
        <button class="btn btn-outline" id="btn-print-rekap-tahunan" style="display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M6 9V3h12v6M6 18h12v4H6v-4zM4 9h16v7H4z"/></svg>
          Cetak Rekap Kas Tahunan (BKU)
        </button>
        <button class="btn btn-primary" id="btn-excel-rekap-tahunan" style="display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export Excel 1 Tahun
        </button>
      </div>
    </div>

    <!-- 4 Key Performance Indicators for Full Academic Year -->
    <div class="kpi-line" style="margin-bottom: 16px;">
      <div class="kpi"><span class="n">${fmtRupiah(grandTotal)}</span><span class="l">Total Kas Masuk 1 Tahun</span></div>
      <div class="kpi"><span class="n">${fmtRupiah(grandSPP)}</span><span class="l">Penerimaan SPP 12 Bulan</span></div>
      <div class="kpi"><span class="n">${fmtRupiah(grandIjazah)}</span><span class="l">Penerimaan Tabungan Ijazah</span></div>
      <div class="kpi"><span class="n">${fmtRupiah(avgPerBulan)}</span><span class="l">Rata-rata Penerimaan / Bulan</span></div>
    </div>

    <!-- 12-Month Table -->
    <div class="card" style="padding:0; overflow:hidden;">
      <div style="padding:14px 18px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <h3 style="margin:0; font-size:15px;">Buku Kas Umum (BKU) Penerimaan — TA ${activeTaStart}/${activeTaStart+1}</h3>
          <div class="card-sub" style="margin-top:2px;">Rekapitulasi 12 bulan (Juli s.d Juni) ${store.ui.laporanTahunanKelas ? `• Kelas ${escapeHtml(store.ui.laporanTahunanKelas)}` : '• Seluruh Kelas'}</div>
        </div>
        <span class="badge lunas">12 Bulan Periode</span>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">No</th>
              <th>Bulan / Periode</th>
              <th class="num">Penerimaan SPP</th>
              <th class="num">Penerimaan Ijazah</th>
              <th class="num">Total Kas Masuk</th>
              <th style="text-align:center;">Transaksi</th>
              <th style="text-align:center;">Siswa Bayar</th>
              <th style="width:110px; text-align:right;">% Kontribusi</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyData.map(m => {
              const percent = grandTotal > 0 ? ((m.total / grandTotal) * 100).toFixed(1) : '0.0';
              return `
                <tr>
                  <td style="text-align:center; color:var(--ink-soft); font-weight:600;">${m.no}</td>
                  <td style="font-weight:700; color:var(--ink);">${escapeHtml(m.label)}</td>
                  <td class="num monospace">${fmtRupiah(m.spp)}</td>
                  <td class="num monospace">${fmtRupiah(m.ijazah)}</td>
                  <td class="num monospace" style="font-weight:800; color:var(--primary);">${fmtRupiah(m.total)}</td>
                  <td style="text-align:center;">${m.trxCount} trx</td>
                  <td style="text-align:center;">${m.uniqueStudents} siswa</td>
                  <td style="text-align:right; font-weight:600;">
                    <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
                      <span>${percent}%</span>
                      <div style="width:36px; height:5px; background:var(--paper-dim); border-radius:3px; overflow:hidden;">
                        <div style="width:${Math.min(100, Math.round(Number(percent) * 3))}%; height:100%; background:var(--primary);"></div>
                      </div>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--paper-dim); font-weight:800; border-top:2px solid var(--line);">
              <td colspan="2" style="text-align:center; font-size:13px; text-transform:uppercase;">TOTAL 1 TAHUN AJARAN</td>
              <td class="num monospace" style="font-size:13px; color:var(--ink);">${fmtRupiah(grandSPP)}</td>
              <td class="num monospace" style="font-size:13px; color:var(--ink);">${fmtRupiah(grandIjazah)}</td>
              <td class="num monospace" style="font-size:14px; color:var(--primary);">${fmtRupiah(grandTotal)}</td>
              <td style="text-align:center;">${grandTrx} trx</td>
              <td style="text-align:center;">-</td>
              <td style="text-align:right; font-size:13px;">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  document.getElementById('lap-ta-select')?.addEventListener('change', e => {
    store.ui.laporanTahunanTa = +e.target.value;
    renderLaporan();
  });

  document.getElementById('lap-ta-kelas')?.addEventListener('change', e => {
    store.ui.laporanTahunanKelas = e.target.value;
    renderLaporan();
  });

  document.getElementById('btn-excel-rekap-tahunan')?.addEventListener('click', () => {
    exportRekapTahunanExcel(monthlyData, activeTaStart, grandSPP, grandIjazah, grandTotal, grandTrx);
  });

  document.getElementById('btn-print-rekap-tahunan')?.addEventListener('click', () => {
    cetakRekapKasTahunan(monthlyData, activeTaStart, grandSPP, grandIjazah, grandTotal, grandTrx);
  });
}

function exportRekapTahunanExcel(monthlyData, activeTaStart, grandSPP, grandIjazah, grandTotal, grandTrx) {
  const sheetRows = monthlyData.map(m => {
    const percent = grandTotal > 0 ? ((m.total / grandTotal) * 100).toFixed(1) + '%' : '0.0%';
    return {
      'No': m.no,
      'Bulan / Periode': m.label,
      'Penerimaan SPP (Rp)': m.spp,
      'Penerimaan Ijazah (Rp)': m.ijazah,
      'Total Kas Masuk (Rp)': m.total,
      'Jumlah Transaksi': m.trxCount,
      'Siswa Membayar': m.uniqueStudents,
      'Kontribusi %': percent
    };
  });

  sheetRows.push({
    'No': '',
    'Bulan / Periode': 'TOTAL 1 TAHUN AJARAN',
    'Penerimaan SPP (Rp)': grandSPP,
    'Penerimaan Ijazah (Rp)': grandIjazah,
    'Total Kas Masuk (Rp)': grandTotal,
    'Jumlah Transaksi': grandTrx,
    'Siswa Membayar': '',
    'Kontribusi %': '100%'
  });

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Rekap Kas TA ${activeTaStart}-${activeTaStart+1}`);
  XLSX.writeFile(wb, `Rekap_Kas_Tahunan_TA_${activeTaStart}_${activeTaStart+1}.xlsx`);
  toast('Rekap Kas Tahunan Excel berhasil didownload', 'success');
}

function cetakRekapKasTahunan(monthlyData, activeTaStart, grandSPP, grandIjazah, grandTotal, grandTrx) {
  const s = store.state.settings || {};
  const printArea = document.getElementById('kwitansi-print-area');
  if (!printArea) return;

  const now = new Date();
  const tglStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const kota = s.alamatSekolah ? s.alamatSekolah.split(',')[0].trim() : 'Ciamis';

  printArea.innerHTML = `
    <div class="print-laporan-tahunan" style="max-width:820px; margin:0 auto; padding:24px 30px; font-family:'Inter', Arial, sans-serif; font-size:12px; color:#0F172A; line-height:1.5;">
      <!-- Kop Surat -->
      <div style="display:flex; align-items:center; gap:16px; border-bottom:3px double #0F172A; padding-bottom:12px; margin-bottom:16px;">
        <img src="${LOGO_BASE64}" alt="Logo" style="width:65px; height:65px; object-fit:contain;" />
        <div style="text-align:center; flex:1;">
          <div style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">LEMBAGA PENDIDIKAN MA'ARIF NU</div>
          <div style="font-size:18px; font-weight:800; text-transform:uppercase; color:#0F172A;">${escapeHtml(s.namaSekolah || 'MADRASAH TSANAWIYAH YASTA BUNTER')}</div>
          <div style="font-size:11px; color:#475569; margin-top:2px;">${escapeHtml(s.alamatSekolah || 'Kecamatan Sukadana, Kabupaten Ciamis')}</div>
          <div style="font-size:11px; color:#64748B;">Tahun Pelajaran ${activeTaStart}/${activeTaStart+1}</div>
        </div>
      </div>

      <!-- Judul Dokumen -->
      <div style="text-align:center; margin-bottom:18px;">
        <div style="font-size:15px; font-weight:800; text-decoration:underline; text-transform:uppercase;">BUKU KAS UMUM & REKAPITULASI PENERIMAAN 1 TAHUN AJARAN</div>
        <div style="font-size:11.5px; color:#475569; margin-top:2px;">Periode: Juli ${activeTaStart} s.d. Juni ${activeTaStart+1} ${store.ui.laporanTahunanKelas ? `• Kelas: ${escapeHtml(store.ui.laporanTahunanKelas)}` : ''}</div>
      </div>

      <!-- Tabel 12 Bulan -->
      <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:20px;">
        <thead>
          <tr style="background:#F1F5F9; border-top:1.5px solid #0F172A; border-bottom:1.5px solid #0F172A;">
            <th style="padding:6px 8px; text-align:center; width:30px; border:1px solid #CBD5E1;">No</th>
            <th style="padding:6px 8px; text-align:left; border:1px solid #CBD5E1;">Bulan / Periode</th>
            <th style="padding:6px 8px; text-align:right; border:1px solid #CBD5E1;">Penerimaan SPP</th>
            <th style="padding:6px 8px; text-align:right; border:1px solid #CBD5E1;">Penerimaan Ijazah</th>
            <th style="padding:6px 8px; text-align:right; border:1px solid #CBD5E1;">Total Kas Masuk</th>
            <th style="padding:6px 8px; text-align:center; border:1px solid #CBD5E1;">Trx</th>
            <th style="padding:6px 8px; text-align:right; width:65px; border:1px solid #CBD5E1;">Kontribusi</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyData.map(m => {
            const percent = grandTotal > 0 ? ((m.total / grandTotal) * 100).toFixed(1) + '%' : '0.0%';
            return `
              <tr>
                <td style="padding:5px 8px; text-align:center; border:1px solid #E2E8F0;">${m.no}</td>
                <td style="padding:5px 8px; font-weight:600; border:1px solid #E2E8F0;">${escapeHtml(m.label)}</td>
                <td style="padding:5px 8px; text-align:right; font-family:monospace; border:1px solid #E2E8F0;">${fmtRupiah(m.spp)}</td>
                <td style="padding:5px 8px; text-align:right; font-family:monospace; border:1px solid #E2E8F0;">${fmtRupiah(m.ijazah)}</td>
                <td style="padding:5px 8px; text-align:right; font-family:monospace; font-weight:700; border:1px solid #E2E8F0;">${fmtRupiah(m.total)}</td>
                <td style="padding:5px 8px; text-align:center; border:1px solid #E2E8F0;">${m.trxCount}</td>
                <td style="padding:5px 8px; text-align:right; border:1px solid #E2E8F0;">${percent}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#F8FAFC; font-weight:800; border-top:2px solid #0F172A; border-bottom:2px solid #0F172A;">
            <td colspan="2" style="padding:7px 8px; text-align:center; border:1px solid #CBD5E1; text-transform:uppercase;">TOTAL PENERIMAAN 1 TAHUN</td>
            <td style="padding:7px 8px; text-align:right; font-family:monospace; border:1px solid #CBD5E1;">${fmtRupiah(grandSPP)}</td>
            <td style="padding:7px 8px; text-align:right; font-family:monospace; border:1px solid #CBD5E1;">${fmtRupiah(grandIjazah)}</td>
            <td style="padding:7px 8px; text-align:right; font-family:monospace; font-size:12px; border:1px solid #CBD5E1;">${fmtRupiah(grandTotal)}</td>
            <td style="padding:7px 8px; text-align:center; border:1px solid #CBD5E1;">${grandTrx}</td>
            <td style="padding:7px 8px; text-align:right; border:1px solid #CBD5E1;">100%</td>
          </tr>
        </tfoot>
      </table>

      <!-- Tanda Tangan Pengesahan -->
      <div style="display:flex; justify-content:space-between; margin-top:28px; page-break-inside:avoid;">
        <div style="text-align:center; width:220px;">
          <div style="font-size:11px; color:#475569;">Mengetahui,</div>
          <div style="font-weight:700; margin-top:2px;">Kepala Madrasah</div>
          <div style="height:60px;"></div>
          <div style="font-weight:700; text-decoration:underline;">${escapeHtml(s.kepalaMadrasah || 'Kepala Madrasah')}</div>
          <div style="font-size:10.5px; color:#64748B;">NIP. ${escapeHtml(s.nipKepalaMadrasah || '-')}</div>
        </div>
        <div style="text-align:center; width:220px;">
          <div style="font-size:11px; color:#475569;">${escapeHtml(kota)}, ${tglStr}</div>
          <div style="font-weight:700; margin-top:2px;">Bendahara Madrasah</div>
          <div style="height:60px;"></div>
          <div style="font-weight:700; text-decoration:underline;">${escapeHtml(s.bendahara || 'Bendahara SPP')}</div>
          <div style="font-size:10.5px; color:#64748B;">NIP / NUPTK. -</div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 100);
}

function exportLaporanExcel(rows){
  if(rows.length===0){ toast('Tidak ada data untuk diexport', 'warning'); return; }
  const sheetRows = rows.map((p, idx) => {
    const s = store.state.siswa.find(x=>x.id===p.siswaId) || {nama:'(dihapus)',kelas:'-',nis:'-'};
    const jenis = p.jenis === 'ijazah' ? 'Ijazah' : 'SPP';
    const bln = p.jenis === 'ijazah' ? '-' : BULAN[(p.bulan||1)-1];
    const thn = p.jenis === 'ijazah' ? '-' : (p.tahun||'');
    return {
      'No': idx + 1,
      'Tanggal': fmtDate(p.tanggal),
      'Nama Siswa': s.nama,
      'Kelas': s.kelas,
      'NIS': s.nis || '-',
      'No. Kwitansi': p.noKwitansi || '-',
      'Jenis': jenis,
      'Bulan SPP': bln,
      'Tahun SPP': thn,
      'Nominal (Rp)': p.nominal,
      'Keterangan': p.keterangan || '-'
    };
  });
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Pemasukan');
  XLSX.writeFile(wb, `Laporan_Pemasukan_${BULAN[store.ui.laporanBulan-1]}_${store.ui.laporanTahun}.xlsx`);
  toast('Laporan Excel berhasil didownload', 'success');
}

function exportLaporanCsv(rows){
  if(rows.length===0){ toast('Tidak ada data untuk diexport', 'warning'); return; }
  const header = ['Tanggal','Nama Siswa','Kelas','NIS','No Kwitansi','Jenis','Bulan','Tahun','Nominal'];
  const lines = [header.join(',')];
  rows.forEach(p=>{
    const s = store.state.siswa.find(x=>x.id===p.siswaId) || {nama:'',kelas:'',nis:''};
    const jenis = p.jenis === 'ijazah' ? 'Ijazah' : 'SPP';
    const bln = p.jenis === 'ijazah' ? '-' : BULAN[p.bulan-1];
    const thn = p.jenis === 'ijazah' ? '-' : p.tahun;
    lines.push([fmtDate(p.tanggal), csvSafe(s.nama), csvSafe(s.kelas), csvSafe(s.nis||''), p.noKwitansi||'', jenis, bln, thn, p.nominal].join(','));
  });
  downloadFile(`laporan-pembayaran-${BULAN[store.ui.laporanBulan-1]}-${store.ui.laporanTahun}.csv`, lines.join('\n'));
}

function csvSafe(v){ v=String(v||''); return '"' + v.replace(/"/g, '""') + '"'; }
