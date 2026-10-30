import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { getPeriode, BULAN, downloadFile, toast, getActiveTahunMulai } from '../../utils/helpers.js';
import { escapeHtml, escapeAttr, fmtDate, fmtRupiah } from '../../utils/formatters.js';
import { openConfirm, openModal, closeModal } from '../../components/Modal.js';
import { cetakKwitansi } from '../pembayaran/kwitansi.js';
import { LOGO_BASE64 } from '../../utils/constants.js';
import { KATEGORI_PENGELUARAN, savePengeluaran, deletePengeluaran, cetakBuktiKasKeluar, exportPengeluaranExcel } from './pengeluaranService.js';
import * as XLSX from 'xlsx';

export function renderLaporan(){
  const el = document.getElementById('page-laporan');
  if (!store.ui.laporanViewMode) store.ui.laporanViewMode = 'bulanan';

  const viewMode = store.ui.laporanViewMode;

  el.innerHTML = `
    <!-- Top Sub-Navigation Tabs -->
    <div class="tabs" style="margin-bottom:16px;">
      <button class="tab-btn ${viewMode === 'bulanan' ? 'active' : ''}" id="tab-lap-bulanan">
        Laporan Pemasukan & Transaksi
      </button>
      <button class="tab-btn ${viewMode === 'pengeluaran' ? 'active' : ''}" id="tab-lap-pengeluaran">
        Buku Kas Keluar (Pengeluaran)
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

  document.getElementById('tab-lap-pengeluaran')?.addEventListener('click', () => {
    store.ui.laporanViewMode = 'pengeluaran';
    renderLaporan();
  });

  document.getElementById('tab-lap-tahunan')?.addEventListener('click', () => {
    store.ui.laporanViewMode = 'tahunan';
    renderLaporan();
  });

  const contentEl = document.getElementById('laporan-tab-content');

  if (viewMode === 'bulanan') {
    renderLaporanBulanan(contentEl);
  } else if (viewMode === 'pengeluaran') {
    renderLaporanPengeluaran(contentEl);
  } else {
    renderLaporanTahunan(contentEl);
  }
}

// -------------------------------------------------------------
// TAB 1: LAPORAN PEMASUKAN & DAFTAR TRANSAKSI
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
  const totalLainnya = rows.filter(p=>p.jenis && p.jenis!=='spp' && p.jenis!=='ijazah').reduce((a,p)=>a+p.nominal,0);
  const total = totalSPP + totalIjazah + totalLainnya;

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
      <div class="kpi"><span class="n">${fmtRupiah(total)}</span><span class="l">Total Kas Masuk</span></div>
      <div class="kpi"><span class="n">${fmtRupiah(totalSPP)}</span><span class="l">Penerimaan SPP</span></div>
      <div class="kpi"><span class="n">${fmtRupiah(totalIjazah)}</span><span class="l">Penerimaan Ijazah</span></div>
      <div class="kpi"><span class="n">${fmtRupiah(totalLainnya)}</span><span class="l">Tagihan Lainnya</span></div>
    </div>
    
    <div class="kpi-line">
      <div class="kpi"><span class="n">${rows.length}</span><span class="l">Jumlah Transaksi</span></div>
      <div class="kpi"><span class="n">${new Set(rows.map(r=>r.siswaId)).size}</span><span class="l">Siswa Membayar</span></div>
    </div>

    <div class="card" style="padding:0;">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Tanggal</th><th>Nama Siswa</th><th>Kelas</th><th>No. Kwitansi</th><th>Jenis Pembayaran</th><th class="num">Nominal</th><th style="width:80px; text-align:right;">Aksi</th></tr></thead>
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
      let jenisLabel = 'SPP';
      if (p.jenis === 'ijazah') {
        jenisLabel = 'Tabungan Ijazah';
      } else if (!p.jenis || p.jenis === 'spp') {
        jenisLabel = `SPP (${BULAN[(p.bulan||1)-1]} ${p.tahun||''})`;
      } else {
        const pos = (store.state.posTagihan || []).find(x => x.id === p.jenis);
        jenisLabel = pos ? pos.nama : (p.namaTagihan || p.jenis);
      }

      return `<tr>
        <td>${fmtDate(p.tanggal)}</td>
        <td>${escapeHtml(s.nama)}</td>
        <td><span class="kelas-chip">${escapeHtml(s.kelas)}</span></td>
        <td><span class="monospace" style="color:var(--primary); font-weight:600;">${p.noKwitansi||'-'}</span></td>
        <td>${escapeHtml(jenisLabel)}</td>
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
// TAB 2: BUKU KAS KELUAR (PENGELUARAN MADRASAH)
// -------------------------------------------------------------
function renderLaporanPengeluaran(contentEl) {
  const now = new Date();
  if (store.ui.pengeluaranBulan === undefined) store.ui.pengeluaranBulan = now.getMonth() + 1;
  if (store.ui.pengeluaranTahun === undefined) store.ui.pengeluaranTahun = now.getFullYear();
  if (store.ui.pengeluaranKategori === undefined) store.ui.pengeluaranKategori = '';

  const pengeluaranList = store.state.pengeluaran || [];

  // Filter
  const filtered = pengeluaranList.filter(item => {
    const d = new Date(item.tanggal);
    const matchBulan = store.ui.pengeluaranBulan === 0 || (d.getMonth() + 1) === store.ui.pengeluaranBulan;
    const matchTahun = store.ui.pengeluaranTahun === 0 || d.getFullYear() === store.ui.pengeluaranTahun;
    const matchKat = !store.ui.pengeluaranKategori || item.kategori === store.ui.pengeluaranKategori;
    return matchBulan && matchTahun && matchKat;
  }).sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));

  // Compute incoming for selected period to calculate net balance
  const incomingRows = store.state.pembayaran.filter(p => {
    const d = new Date(p.tanggal);
    const matchB = store.ui.pengeluaranBulan === 0 || (d.getMonth() + 1) === store.ui.pengeluaranBulan;
    const matchT = store.ui.pengeluaranTahun === 0 || d.getFullYear() === store.ui.pengeluaranTahun;
    return matchB && matchT;
  });
  const totalKasMasuk = incomingRows.reduce((sum, p) => sum + p.nominal, 0);
  const totalPengeluaran = filtered.reduce((sum, p) => sum + p.nominal, 0);
  const saldoBersih = totalKasMasuk - totalPengeluaran;

  const currentYear = now.getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  contentEl.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <select id="pengeluaran-bulan">
          <option value="0" ${store.ui.pengeluaranBulan === 0 ? 'selected' : ''}>Semua Bulan</option>
          ${BULAN.map((b, i) => `<option value="${i+1}" ${store.ui.pengeluaranBulan === i+1 ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
        <select id="pengeluaran-tahun">
          <option value="0" ${store.ui.pengeluaranTahun === 0 ? 'selected' : ''}>Semua Tahun</option>
          ${yearOptions.map(y => `<option value="${y}" ${store.ui.pengeluaranTahun === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
        <select id="pengeluaran-kategori">
          <option value="">Semua Kategori</option>
          ${KATEGORI_PENGELUARAN.map(k => `<option value="${escapeAttr(k)}" ${store.ui.pengeluaranKategori === k ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right" style="gap:8px;">
        <button class="btn btn-outline" id="btn-export-pengeluaran-excel" style="display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export Excel
        </button>
        <button class="btn btn-primary" id="btn-tambah-pengeluaran" style="display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Catat Pengeluaran Baru
        </button>
      </div>
    </div>

    <!-- 3 KPI Cards Arus Kas Riil -->
    <div class="kpi-line" style="margin-bottom:16px;">
      <div class="kpi">
        <span class="n" style="color:#DC2626;">${fmtRupiah(totalPengeluaran)}</span>
        <span class="l">Total Kas Keluar (Periode Ini)</span>
      </div>
      <div class="kpi">
        <span class="n" style="color:#059669;">${fmtRupiah(totalKasMasuk)}</span>
        <span class="l">Total Kas Masuk (Penerimaan)</span>
      </div>
      <div class="kpi">
        <span class="n" style="color:${saldoBersih >= 0 ? 'var(--primary)' : '#DC2626'};">${fmtRupiah(saldoBersih)}</span>
        <span class="l">Saldo Kas Bersih Riil</span>
      </div>
    </div>

    <div class="card" style="padding:0;">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No. BKK</th>
              <th>Kategori</th>
              <th>Keperluan / Keterangan</th>
              <th>Penerima</th>
              <th class="num">Nominal</th>
              <th style="width:80px; text-align:right;">Aksi</th>
            </tr>
          </thead>
          <tbody id="pengeluaran-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = document.getElementById('pengeluaran-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Belum ada catatan pengeluaran kas pada periode ini.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(p => `
      <tr>
        <td>${fmtDate(p.tanggal)}</td>
        <td><span class="monospace" style="color:#DC2626; font-weight:700;">${escapeHtml(p.noBkk)}</span></td>
        <td><span class="badge" style="background:rgba(67,56,202,0.1); color:var(--primary); font-size:11px;">${escapeHtml(p.kategori)}</span></td>
        <td>${escapeHtml(p.keterangan)}</td>
        <td><strong>${escapeHtml(p.penerima)}</strong></td>
        <td class="num" style="color:#DC2626; font-weight:700;">- ${fmtRupiah(p.nominal)}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn btn-sm btn-ghost" data-print-bkk="${p.id}" title="Cetak Bukti Kas Keluar (BKK)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:14px;height:14px;"><path d="M6 9V3h12v6M6 18h12v4H6v-4zM4 9h16v7H4z"/></svg>
          </button>
          <button class="btn btn-sm btn-ghost" data-del-bkk="${p.id}" title="Hapus pengeluaran" style="color:var(--rust);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:14px;height:14px;"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-print-bkk]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = pengeluaranList.find(x => x.id === btn.dataset.printBkk);
        if (item) cetakBuktiKasKeluar(item);
      });
    });

    tbody.querySelectorAll('[data-del-bkk]').forEach(btn => {
      btn.addEventListener('click', () => {
        openConfirm('Hapus data pengeluaran kas ini? Bukti Kas Keluar terkait akan dibatalkan.', () => {
          deletePengeluaran(btn.dataset.delBkk);
          renderLaporan();
        });
      });
    });
  }

  document.getElementById('pengeluaran-bulan')?.addEventListener('change', e => {
    store.ui.pengeluaranBulan = +e.target.value;
    renderLaporan();
  });
  document.getElementById('pengeluaran-tahun')?.addEventListener('change', e => {
    store.ui.pengeluaranTahun = +e.target.value;
    renderLaporan();
  });
  document.getElementById('pengeluaran-kategori')?.addEventListener('change', e => {
    store.ui.pengeluaranKategori = e.target.value;
    renderLaporan();
  });

  document.getElementById('btn-export-pengeluaran-excel')?.addEventListener('click', () => {
    const labelPeriode = `${store.ui.pengeluaranBulan ? BULAN[store.ui.pengeluaranBulan - 1] : 'Semua Bulan'} ${store.ui.pengeluaranTahun || ''}`;
    exportPengeluaranExcel(filtered, labelPeriode);
  });

  document.getElementById('btn-tambah-pengeluaran')?.addEventListener('click', () => {
    openModalTambahPengeluaran();
  });
}

function openModalTambahPengeluaran() {
  const today = new Date().toISOString().slice(0, 10);
  openModal(`
    <div class="modal-head">
      <h3>Catat Pengeluaran Kas (BKK)</h3>
      <button class="close-x" id="modal-close">&times;</button>
    </div>
    <div class="modal-body" style="padding:16px;">
      <div class="form-row">
        <div class="form-group">
          <label>Tanggal Transaksi</label>
          <input type="date" id="bkk-input-tanggal" style="width:100%;" value="${today}">
        </div>
        <div class="form-group">
          <label>Kategori Pengeluaran</label>
          <select id="bkk-input-kategori" style="width:100%;">
            ${KATEGORI_PENGELUARAN.map(k => `<option value="${escapeAttr(k)}">${escapeHtml(k)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nominal Pengeluaran (Rp)</label>
          <input type="number" id="bkk-input-nominal" style="width:100%; font-family:monospace; font-size:15px; font-weight:700;" placeholder="cth. 250000">
        </div>
        <div class="form-group">
          <label>Dibayarkan Kepada / Penerima</label>
          <input type="text" id="bkk-input-penerima" style="width:100%;" placeholder="cth. Toko ATK Sejahtera / Guru Pembina">
        </div>
      </div>
      <div class="form-group">
        <label>Keterangan / Keperluan Lengkap</label>
        <textarea id="bkk-input-keterangan" style="width:100%; height:75px; padding:8px; border:1px solid var(--line); border-radius:6px;" placeholder="cth. Pembelian kertas HVS 5 rim dan spidol whiteboard untuk ujian semester"></textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="modal-cancel">Batal</button>
      <button class="btn btn-primary" id="btn-save-bkk" style="display:inline-flex; align-items:center; gap:6px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Simpan & Terbitkan BKK
      </button>
    </div>
  `);

  document.getElementById('btn-save-bkk')?.addEventListener('click', () => {
    const tanggal = document.getElementById('bkk-input-tanggal')?.value;
    const kategori = document.getElementById('bkk-input-kategori')?.value;
    const nominal = parseInt(document.getElementById('bkk-input-nominal')?.value || '0', 10);
    const penerima = document.getElementById('bkk-input-penerima')?.value.trim();
    const keterangan = document.getElementById('bkk-input-keterangan')?.value.trim();

    if (!nominal || nominal <= 0) {
      toast('Nominal pengeluaran wajib diisi dengan benar.', 'warning');
      return;
    }
    if (!keterangan) {
      toast('Keterangan / keperluan pengeluaran wajib diisi.', 'warning');
      return;
    }

    const saved = savePengeluaran({
      tanggal,
      kategori,
      nominal,
      penerima: penerima || 'Pihak Terkait',
      keterangan
    });

    closeModal();
    renderLaporan();

    openConfirm(`Pengeluaran kas berhasil disimpan dengan No. ${saved.noBkk}. Apakah ingin langsung mencetak Bukti Kas Keluar (BKK)?`, () => {
      cetakBuktiKasKeluar(saved);
    });
  });
}

// -------------------------------------------------------------
// TAB 3: REKAP KAS TAHUNAN (1 TAHUN AJARAN PENUH / BKU 12 BULAN)
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

  const allPengeluaran = store.state.pengeluaran || [];

  // Calculate monthly figures and running balance
  let runningBalance = 0;
  const monthlyData = periode12.map((p, idx) => {
    const monthPayments = paymentsPool.filter(pay => {
      const payBulan = pay.bulan || (pay.tanggal ? new Date(pay.tanggal).getMonth() + 1 : null);
      const payTahun = pay.tahun || (pay.tanggal ? new Date(pay.tanggal).getFullYear() : null);
      return payBulan === p.bulan && payTahun === p.tahun;
    });

    const spp = monthPayments.filter(pay => !pay.jenis || pay.jenis === 'spp').reduce((sum, pay) => sum + pay.nominal, 0);
    const ijazah = monthPayments.filter(pay => pay.jenis === 'ijazah').reduce((sum, pay) => sum + pay.nominal, 0);
    const lainnya = monthPayments.filter(pay => pay.jenis && pay.jenis !== 'spp' && pay.jenis !== 'ijazah').reduce((sum, pay) => sum + pay.nominal, 0);
    const totalMasuk = spp + ijazah + lainnya;

    // Monthly expenses (not filtered by class)
    const monthExpenses = allPengeluaran.filter(exp => {
      const d = new Date(exp.tanggal);
      return (d.getMonth() + 1) === p.bulan && d.getFullYear() === p.tahun;
    });
    const totalKeluar = monthExpenses.reduce((sum, exp) => sum + exp.nominal, 0);
    const saldoBersih = totalMasuk - totalKeluar;
    runningBalance += saldoBersih;

    const trxCount = monthPayments.length;
    const uniqueStudents = new Set(monthPayments.map(pay => pay.siswaId)).size;

    return {
      no: idx + 1,
      bulan: p.bulan,
      tahun: p.tahun,
      label: `${p.bulanName} ${p.tahun}`,
      spp,
      ijazah,
      lainnya,
      totalMasuk,
      totalKeluar,
      saldoBersih,
      saldoKumulatif: runningBalance,
      trxCount,
      uniqueStudents
    };
  });

  const grandSPP = monthlyData.reduce((acc, m) => acc + m.spp, 0);
  const grandIjazah = monthlyData.reduce((acc, m) => acc + m.ijazah, 0);
  const grandLainnya = monthlyData.reduce((acc, m) => acc + m.lainnya, 0);
  const grandTotalMasuk = monthlyData.reduce((acc, m) => acc + m.totalMasuk, 0);
  const grandTotalKeluar = monthlyData.reduce((acc, m) => acc + m.totalKeluar, 0);
  const grandSaldoKas = grandTotalMasuk - grandTotalKeluar;
  const grandTrx = monthlyData.reduce((acc, m) => acc + m.trxCount, 0);
  const avgSaldoPerBulan = Math.round(grandSaldoKas / 12);

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

    <!-- 4 Key Performance Indicators for BKU -->
    <div class="kpi-line" style="margin-bottom: 16px;">
      <div class="kpi"><span class="n" style="color:#059669;">${fmtRupiah(grandTotalMasuk)}</span><span class="l">Total Kas Masuk 1 Tahun</span></div>
      <div class="kpi"><span class="n" style="color:#DC2626;">${fmtRupiah(grandTotalKeluar)}</span><span class="l">Total Kas Keluar 1 Tahun</span></div>
      <div class="kpi"><span class="n" style="color:${grandSaldoKas >= 0 ? 'var(--primary)' : '#DC2626'};">${fmtRupiah(grandSaldoKas)}</span><span class="l">Saldo Kas Riil BKU</span></div>
      <div class="kpi"><span class="n">${fmtRupiah(avgSaldoPerBulan)}</span><span class="l">Rata-rata Saldo Bersih / Bulan</span></div>
    </div>

    <!-- Tabel Buku Kas Umum 12 Bulan -->
    <div class="card" style="padding:0;">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">No</th>
              <th>Bulan / Periode</th>
              <th class="num">Penerimaan SPP</th>
              <th class="num">Ijazah & Lainnya</th>
              <th class="num" style="color:#059669;">Total Masuk</th>
              <th class="num" style="color:#DC2626;">Total Keluar</th>
              <th class="num">Saldo Bersih</th>
              <th class="num" style="color:var(--primary); font-weight:800;">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyData.map(m => `
              <tr>
                <td style="text-align:center;">${m.no}</td>
                <td><strong>${escapeHtml(m.label)}</strong></td>
                <td class="num monospace">${fmtRupiah(m.spp)}</td>
                <td class="num monospace">${fmtRupiah(m.ijazah + m.lainnya)}</td>
                <td class="num monospace" style="color:#059669; font-weight:700;">+ ${fmtRupiah(m.totalMasuk)}</td>
                <td class="num monospace" style="color:#DC2626; font-weight:700;">${m.totalKeluar > 0 ? `- ${fmtRupiah(m.totalKeluar)}` : 'Rp 0'}</td>
                <td class="num monospace" style="font-weight:700; color:${m.saldoBersih >= 0 ? '#059669' : '#DC2626'};">${fmtRupiah(m.saldoBersih)}</td>
                <td class="num monospace" style="font-weight:800; color:var(--primary);">${fmtRupiah(m.saldoKumulatif)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--paper-dim); font-weight:800; border-top:2px solid var(--line);">
              <td colspan="2" style="text-align:center; font-size:13px; text-transform:uppercase;">TOTAL 1 TAHUN AJARAN</td>
              <td class="num monospace" style="font-size:12.5px;">${fmtRupiah(grandSPP)}</td>
              <td class="num monospace" style="font-size:12.5px;">${fmtRupiah(grandIjazah + grandLainnya)}</td>
              <td class="num monospace" style="font-size:13px; color:#059669;">+ ${fmtRupiah(grandTotalMasuk)}</td>
              <td class="num monospace" style="font-size:13px; color:#DC2626;">- ${fmtRupiah(grandTotalKeluar)}</td>
              <td class="num monospace" style="font-size:13px; color:${grandSaldoKas >= 0 ? '#059669' : '#DC2626'};">${fmtRupiah(grandSaldoKas)}</td>
              <td class="num monospace" style="font-size:14px; color:var(--primary);">${fmtRupiah(grandSaldoKas)}</td>
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
    exportRekapTahunanExcel(monthlyData, activeTaStart, grandTotalMasuk, grandTotalKeluar, grandSaldoKas);
  });

  document.getElementById('btn-print-rekap-tahunan')?.addEventListener('click', () => {
    cetakRekapKasTahunan(monthlyData, activeTaStart, grandTotalMasuk, grandTotalKeluar, grandSaldoKas);
  });
}

function exportRekapTahunanExcel(monthlyData, activeTaStart, grandTotalMasuk, grandTotalKeluar, grandSaldoKas) {
  const sheetRows = monthlyData.map(m => ({
    'No': m.no,
    'Bulan / Periode': m.label,
    'Penerimaan SPP (Rp)': m.spp,
    'Ijazah & Lainnya (Rp)': m.ijazah + m.lainnya,
    'Total Pemasukan (Rp)': m.totalMasuk,
    'Total Pengeluaran (Rp)': m.totalKeluar,
    'Saldo Bersih Bulanan (Rp)': m.saldoBersih,
    'Saldo Kas Akhir (Rp)': m.saldoKumulatif
  }));

  sheetRows.push({
    'No': '',
    'Bulan / Periode': 'TOTAL 1 TAHUN AJARAN',
    'Penerimaan SPP (Rp)': '',
    'Ijazah & Lainnya (Rp)': '',
    'Total Pemasukan (Rp)': grandTotalMasuk,
    'Total Pengeluaran (Rp)': grandTotalKeluar,
    'Saldo Bersih Bulanan (Rp)': grandSaldoKas,
    'Saldo Kas Akhir (Rp)': grandSaldoKas
  });

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `BKU TA ${activeTaStart}-${activeTaStart+1}`);
  XLSX.writeFile(wb, `Buku_Kas_Umum_BKU_TA_${activeTaStart}_${activeTaStart+1}.xlsx`);
  toast('Buku Kas Umum (BKU) Excel berhasil didownload', 'success');
}

function cetakRekapKasTahunan(monthlyData, activeTaStart, grandTotalMasuk, grandTotalKeluar, grandSaldoKas) {
  const s = store.state.settings || {};
  const printArea = document.getElementById('kwitansi-print-area');
  if (!printArea) return;

  const now = new Date();
  const tglStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const kota = s.alamatSekolah ? s.alamatSekolah.split(',')[0].trim() : 'Ciamis';

  printArea.innerHTML = `
    <div class="print-laporan-tahunan" style="max-width:860px; margin:0 auto; padding:24px 30px; font-family:'Inter', Arial, sans-serif; font-size:12px; color:#0F172A; line-height:1.5;">
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
        <div style="font-size:15px; font-weight:800; text-decoration:underline; text-transform:uppercase;">BUKU KAS UMUM (BKU) 1 TAHUN AJARAN</div>
        <div style="font-size:11.5px; color:#475569; margin-top:2px;">Arus Kas Masuk & Kas Keluar: Juli ${activeTaStart} s.d. Juni ${activeTaStart+1}</div>
      </div>

      <!-- Tabel 12 Bulan BKU -->
      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px;">
        <thead>
          <tr style="background:#F1F5F9; border-top:1.5px solid #0F172A; border-bottom:1.5px solid #0F172A;">
            <th style="padding:6px 6px; text-align:center; width:28px; border:1px solid #CBD5E1;">No</th>
            <th style="padding:6px 8px; text-align:left; border:1px solid #CBD5E1;">Bulan / Periode</th>
            <th style="padding:6px 8px; text-align:right; border:1px solid #CBD5E1;">SPP</th>
            <th style="padding:6px 8px; text-align:right; border:1px solid #CBD5E1;">Lainnya</th>
            <th style="padding:6px 8px; text-align:right; border:1px solid #CBD5E1; color:#059669;">Total Masuk</th>
            <th style="padding:6px 8px; text-align:right; border:1px solid #CBD5E1; color:#DC2626;">Total Keluar</th>
            <th style="padding:6px 8px; text-align:right; border:1px solid #CBD5E1;">Saldo Bersih</th>
            <th style="padding:6px 8px; text-align:right; border:1px solid #CBD5E1; font-weight:800;">Saldo Akhir</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyData.map(m => `
            <tr>
              <td style="padding:5px 6px; text-align:center; border:1px solid #E2E8F0;">${m.no}</td>
              <td style="padding:5px 8px; font-weight:600; border:1px solid #E2E8F0;">${escapeHtml(m.label)}</td>
              <td style="padding:5px 8px; text-align:right; font-family:monospace; border:1px solid #E2E8F0;">${fmtRupiah(m.spp)}</td>
              <td style="padding:5px 8px; text-align:right; font-family:monospace; border:1px solid #E2E8F0;">${fmtRupiah(m.ijazah + m.lainnya)}</td>
              <td style="padding:5px 8px; text-align:right; font-family:monospace; font-weight:700; color:#059669; border:1px solid #E2E8F0;">${fmtRupiah(m.totalMasuk)}</td>
              <td style="padding:5px 8px; text-align:right; font-family:monospace; font-weight:700; color:#DC2626; border:1px solid #E2E8F0;">${fmtRupiah(m.totalKeluar)}</td>
              <td style="padding:5px 8px; text-align:right; font-family:monospace; font-weight:700; border:1px solid #E2E8F0;">${fmtRupiah(m.saldoBersih)}</td>
              <td style="padding:5px 8px; text-align:right; font-family:monospace; font-weight:800; border:1px solid #E2E8F0;">${fmtRupiah(m.saldoKumulatif)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#F8FAFC; font-weight:800; border-top:2px solid #0F172A; border-bottom:2px solid #0F172A;">
            <td colspan="4" style="padding:7px 8px; text-align:center; border:1px solid #CBD5E1; text-transform:uppercase;">TOTAL KAS 1 TAHUN AJARAN</td>
            <td style="padding:7px 8px; text-align:right; font-family:monospace; color:#059669; border:1px solid #CBD5E1;">${fmtRupiah(grandTotalMasuk)}</td>
            <td style="padding:7px 8px; text-align:right; font-family:monospace; color:#DC2626; border:1px solid #CBD5E1;">${fmtRupiah(grandTotalKeluar)}</td>
            <td style="padding:7px 8px; text-align:right; font-family:monospace; border:1px solid #CBD5E1;">${fmtRupiah(grandSaldoKas)}</td>
            <td style="padding:7px 8px; text-align:right; font-family:monospace; font-size:12px; color:#1E1B4B; border:1px solid #CBD5E1;">${fmtRupiah(grandSaldoKas)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Tanda Tangan -->
      <div style="display:flex; justify-content:space-between; margin-top:35px; page-break-inside:avoid;">
        <div style="text-align:center; width:220px;">
          <div>Mengetahui,</div>
          <div style="font-weight:700;">Kepala Madrasah</div>
          <div style="height:65px;"></div>
          <div style="font-weight:800; text-decoration:underline;">${escapeHtml(s.kepalaMadrasah || 'Drs. H. Mamat Rahmat, M.Pd.I')}</div>
          <div style="font-size:11px; color:#64748B;">NIP. ${escapeHtml(s.nipKepalaMadrasah || '-')}</div>
        </div>
        <div style="text-align:center; width:220px;">
          <div>${escapeHtml(kota)}, ${tglStr}</div>
          <div style="font-weight:700;">Bendahara Madrasah</div>
          <div style="height:65px;"></div>
          <div style="font-weight:800; text-decoration:underline;">${escapeHtml(s.bendahara || 'Bendahara')}</div>
          <div style="font-size:11px; color:#64748B;">Pengelola Kas Madrasah</div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => window.print(), 100);
}

function exportLaporanCsv(rows){
  const headers = ['Tanggal', 'Nama Siswa', 'Kelas', 'NIS', 'No. Kwitansi', 'Jenis', 'Nominal'];
  const csvRows = [headers.join(',')];
  rows.forEach(r => {
    const s = store.state.siswa.find(x => x.id === r.siswaId) || { nama: '(dihapus)', kelas: '-', nis: '-' };
    let jNama = 'SPP';
    if (r.jenis === 'ijazah') jNama = 'Ijazah';
    else if (!r.jenis || r.jenis === 'spp') jNama = `SPP (${BULAN[(r.bulan||1)-1]} ${r.tahun||''})`;
    else {
      const pos = (store.state.posTagihan || []).find(x => x.id === r.jenis);
      jNama = pos ? pos.nama : (r.namaTagihan || r.jenis);
    }

    csvRows.push([
      `"${r.tanggal}"`,
      `"${s.nama.replace(/"/g, '""')}"`,
      `"${s.kelas}"`,
      `"${s.nis || '-'}"`,
      `"${r.noKwitansi || '-'}"`,
      `"${jNama}"`,
      r.nominal
    ].join(','));
  });
  const csvStr = csvRows.join('\n');
  const b = store.ui.laporanBulan ? BULAN[store.ui.laporanBulan - 1] : 'Semua';
  downloadFile(`Laporan_Pemasukan_${b}_${store.ui.laporanTahun || ''}.csv`, csvStr, 'text/csv');
}

function exportLaporanExcel(rows){
  const sheetRows = rows.map((r, i) => {
    const s = store.state.siswa.find(x => x.id === r.siswaId) || { nama: '(dihapus)', kelas: '-', nis: '-' };
    let jenisStr = 'SPP';
    if (r.jenis === 'ijazah') jenisStr = 'Ijazah';
    else if (!r.jenis || r.jenis === 'spp') jenisStr = `SPP (${BULAN[(r.bulan||1)-1]} ${r.tahun||''})`;
    else {
      const pos = (store.state.posTagihan || []).find(x => x.id === r.jenis);
      jenisStr = pos ? pos.nama : (r.namaTagihan || r.jenis);
    }

    return {
      'No': i + 1,
      'Tanggal': r.tanggal,
      'Nama Siswa': s.nama,
      'Kelas': s.kelas,
      'NIS': s.nis || '-',
      'No. Kwitansi': r.noKwitansi || '-',
      'Jenis Pembayaran': jenisStr,
      'Nominal (Rp)': r.nominal
    };
  });

  const totalNominal = rows.reduce((sum, r) => sum + r.nominal, 0);
  sheetRows.push({
    'No': '',
    'Tanggal': '',
    'Nama Siswa': 'TOTAL',
    'Kelas': '',
    'NIS': '',
    'No. Kwitansi': '',
    'Jenis Pembayaran': '',
    'Nominal (Rp)': totalNominal
  });

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  const b = store.ui.laporanBulan ? BULAN[store.ui.laporanBulan - 1] : 'Semua';
  XLSX.utils.book_append_sheet(wb, ws, 'Pemasukan Kas');
  XLSX.writeFile(wb, `Laporan_Pemasukan_${b}_${store.ui.laporanTahun || ''}.xlsx`);
  toast('Laporan Excel berhasil didownload', 'success');
}
