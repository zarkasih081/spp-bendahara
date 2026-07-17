import { store, saveData } from '../state/store.js';
import { getPeriode, escapeHtml, escapeAttr, fmtDate, fmtRupiah, BULAN, downloadFile, toast } from '../utils/helpers.js';
import { openConfirm } from '../components/Modal.js';

export function renderLaporan(){
  const el = document.getElementById('page-laporan');
  const now = new Date();
  if(store.ui.laporanBulan===null) store.ui.laporanBulan = now.getMonth()+1;
  if(store.ui.laporanTahun===null) store.ui.laporanTahun = now.getFullYear();

  const kelasList = [...new Set(store.state.siswa.map(s=>s.kelas))].sort();
  const tahunOptions = [...new Set(getPeriode().map(p=>p.tahun))];

  let rows = store.state.pembayaran.filter(p=>p.bulan===store.ui.laporanBulan && p.tahun===store.ui.laporanTahun);
  if(store.ui.laporanKelas){
    const idsInKelas = new Set(store.state.siswa.filter(s=>s.kelas===store.ui.laporanKelas).map(s=>s.id));
    rows = rows.filter(p=>idsInKelas.has(p.siswaId));
  }
  rows = rows.sort((a,b)=> new Date(b.tanggal)-new Date(a.tanggal));
  const totalSPP = rows.filter(p=>!p.jenis || p.jenis==='spp').reduce((a,p)=>a+p.nominal,0);
  const totalIjazah = rows.filter(p=>p.jenis==='ijazah').reduce((a,p)=>a+p.nominal,0);
  const total = totalSPP + totalIjazah;

  el.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <select id="laporan-bulan">${BULAN.map((b,i)=>`<option value="${i+1}" ${store.ui.laporanBulan===i+1?'selected':''}>${b}</option>`).join('')}</select>
        <select id="laporan-tahun">${tahunOptions.map(t=>`<option value="${t}" ${store.ui.laporanTahun===t?'selected':''}>${t}</option>`).join('')}</select>
        <select id="laporan-kelas"><option value="">Semua Kelas</option>${kelasList.map(k=>`<option value="${escapeAttr(k)}" ${store.ui.laporanKelas===k?'selected':''}>${escapeHtml(k)}</option>`).join('')}</select>
      </div>
      <div class="toolbar-right">
        <button class="btn" id="btn-export-laporan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg> Export CSV</button>
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
          <thead><tr><th>Tanggal</th><th>Nama Siswa</th><th>Kelas</th><th>No. Kwitansi</th><th>Jenis</th><th class="num">Nominal</th><th style="width:40px;"></th></tr></thead>
          <tbody id="laporan-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  const tbody = document.getElementById('laporan-tbody');
  if(rows.length===0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Belum ada transaksi pada periode ini.</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(p=>{
      const s = store.state.siswa.find(x=>x.id===p.siswaId) || {nama:'(dihapus)', kelas:'-'};
      return `<tr>
        <td>${fmtDate(p.tanggal)}</td>
        <td>${escapeHtml(s.nama)}</td>
        <td><span class="kelas-chip">${escapeHtml(s.kelas)}</span></td>
        <td>${p.noKwitansi||'-'}</td>
        <td>${p.jenis==='ijazah' ? 'Ijazah' : 'SPP'}</td>
        <td class="num">${fmtRupiah(p.nominal)}</td>
        <td style="text-align:right;">
          <button class="btn btn-sm btn-ghost" data-del-lap="${p.id}" title="Hapus transaksi" style="color:var(--rust);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
        </td>
      </tr>`;
    }).join('');
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
