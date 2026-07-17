import { store } from '../state/store.js';
import { currentPeriodeEntry, getPeriode, siswaTunggakan, siswaStatusBulan, siswaTotalBulan, escapeHtml, escapeAttr, fmtRupiah, BULAN, formatWaLink, emptyState } from '../utils/helpers.js';
import { triggerRender } from '../utils/events.js';
import { openModal } from '../components/Modal.js';



export function renderRiwayat(){
  const el = document.getElementById('page-riwayat');
  const user = store.ui.currentUser;

  // VIEW FOR SISWA
  if (user && user.role === 'siswa') {
    const s = store.state.siswa.find(x => x.id === user.id);
    if (!s) { el.innerHTML = emptyState('', 'Data tidak ditemukan', '', ''); return; }
    
    const periode = getPeriode();
    const t = siswaTunggakan(s.id);
    
    // Get their payments
    const payments = store.state.pembayaran.filter(p => p.siswaId === s.id).sort((a,b)=> new Date(b.tanggal) - new Date(a.tanggal));
    
    el.innerHTML = `
      <div class="card">
        <h3>Status Pembayaran per Bulan</h3>
        <div class="card-sub">Tahun Ajaran ${store.state.settings.tahunAjaran}</div>
        <div class="month-grid" style="margin-top:16px;">
          ${periode.map(p=>{
            const total = siswaTotalBulan(s.id, p.bulan, p.tahun);
            const nominal = store.state.settings.nominalSPP;
            const cls = total>=nominal ? 'paid' : '';
            return `<div class="month-pill ${cls}">${BULAN[p.bulan-1]} '${String(p.tahun).slice(2)}<span class="chk">${total>=nominal?'✓ Lunas':total>0?fmtRupiah(total):'—'}</span></div>`;
          }).join('')}
        </div>
      </div>
      
      <div class="card" style="margin-top:16px;">
        <h3>Status Pembayaran Ijazah</h3>
        <div style="display:flex; justify-content:space-between; margin-top:8px;">
          <span>Total Tagihan: <strong>${fmtRupiah(store.state.settings.nominalIjazah || 500000)}</strong></span>
          <span style="color:var(--rust); font-weight:600;">Sisa: ${fmtRupiah(Math.max(0, (store.state.settings.nominalIjazah || 500000) - payments.filter(p=>p.jenis==='ijazah').reduce((sum, p)=>sum+p.nominal, 0)))}</span>
        </div>
      </div>
      
      <div class="card" style="margin-top:16px;">
        <h3>Riwayat Transaksi</h3>
        ${payments.length === 0 ? '<div class="empty-state">Belum ada transaksi pembayaran.</div>' : `
          <div class="transaction-list" style="margin-top:16px;">
            ${payments.map(p=>`
              <div class="transaction-item">
                <div class="ti-left">
                  <div class="ti-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div>
                    <div class="ti-title">${(!p.jenis || p.jenis==='spp') ? 'SPP Bulan ' + BULAN[p.bulan-1] + ' ' + p.tahun : 'Pembayaran Ijazah'}</div>
                    <div class="ti-date">${new Date(p.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</div>
                  </div>
                </div>
                <div class="ti-amount">+ ${fmtRupiah(p.nominal)}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
    return;
  }

  // VIEW FOR BENDAHARA
  if(store.state.siswa.length===0){
    el.innerHTML = emptyState('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>', 'Belum ada data siswa', 'Data riwayat akan muncul setelah kamu menambahkan siswa dan mencatat pembayaran.', 'Tambah Data Siswa', () => {
      store.ui.page = 'siswa';
      triggerRender();
      setTimeout(()=>{ 
        const b = document.getElementById('btn-add-siswa'); 
        if(b) b.click(); 
      }, 30); 
    });
    return;
  }
  const kelasList = [...new Set(store.state.siswa.map(s=>s.kelas))].sort();
  const cur = currentPeriodeEntry();

  let rows = store.state.siswa.map(s=>{
    const t = siswaTunggakan(s.id);
    const st = siswaStatusBulan(s.id, cur.bulan, cur.tahun);
    return { s, t, st };
  });
  rows = rows.filter(r=>{
    const matchSearch = !store.ui.riwayatSearch || r.s.nama.toLowerCase().includes(store.ui.riwayatSearch.toLowerCase());
    const matchKelas = !store.ui.riwayatKelasFilter || r.s.kelas === store.ui.riwayatKelasFilter;
    const matchStatus = !store.ui.riwayatStatusFilter || r.st === store.ui.riwayatStatusFilter;
    return matchSearch && matchKelas && matchStatus;
  }).sort((a,b)=> b.t.totalKurang - a.t.totalKurang);

  el.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <input class="search-input" id="riwayat-search" placeholder="Cari nama siswa..." value="${escapeAttr(store.ui.riwayatSearch)}">
        <select id="riwayat-kelas-filter"><option value="">Semua Kelas</option>${kelasList.map(k=>`<option value="${escapeAttr(k)}" ${store.ui.riwayatKelasFilter===k?'selected':''}>${escapeHtml(k)}</option>`).join('')}</select>
        <select id="riwayat-status-filter">
          <option value="">Semua Status</option>
          <option value="lunas" ${store.ui.riwayatStatusFilter==='lunas'?'selected':''}>Lunas bulan ini</option>
          <option value="parsial" ${store.ui.riwayatStatusFilter==='parsial'?'selected':''}>Sebagian</option>
          <option value="nunggak" ${store.ui.riwayatStatusFilter==='nunggak'?'selected':''}>Belum bayar</option>
        </select>
      </div>
    </div>
    <div class="card" style="padding:0;">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Nama</th><th>Kelas</th><th>Status Bulan Ini</th><th class="num">Sisa Ijazah</th><th class="num">Bulan Tertunggak</th><th class="num">Tunggakan SPP</th><th style="width:50px;"></th></tr></thead>
          <tbody id="riwayat-tbody"></tbody>
        </table>
      </div>
    </div>
    <div id="riwayat-pagination"></div>
  `;
  const tbody = document.getElementById('riwayat-tbody');
  
  const ITEMS_PER_PAGE = 50;
  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE) || 1;
  if(store.ui.pageRiwayat > totalPages) store.ui.pageRiwayat = totalPages;
  const paged = rows.slice((store.ui.pageRiwayat-1)*ITEMS_PER_PAGE, store.ui.pageRiwayat*ITEMS_PER_PAGE);

  if(paged.length===0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Tidak ada data yang cocok dengan filter.</td></tr>`;
  } else {
    tbody.innerHTML = paged.map(r=>`<tr>
      <td>${escapeHtml(r.s.nama)}</td>
      <td><span class="kelas-chip">${escapeHtml(r.s.kelas)}</span></td>
      <td><span class="badge ${r.st}">${r.st==='lunas'?'Lunas':r.st==='parsial'?'Sebagian':'Belum Bayar'}</span></td>
      <td class="num">${fmtRupiah(Math.max(0, (store.state.settings.nominalIjazah || 500000) - store.state.pembayaran.filter(p=>p.siswaId===r.s.id && p.jenis==='ijazah').reduce((sum, p)=>sum+p.nominal, 0)))}</td>
      <td class="num">${r.t.jumlahBulan}</td>
      <td class="num">${fmtRupiah(r.t.totalKurang)}</td>
      <td style="display:flex; gap:4px; justify-content:flex-end;">
        ${r.s.noHp && r.t.totalKurang > 0 ? `<button class="btn btn-sm btn-ghost" style="color:#25D366;" data-wa-tagihan="${r.s.id}" title="Kirim Tagihan WA"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button>` : ''}
        <button class="btn btn-sm btn-ghost" data-detail="${r.s.id}">Detail</button>
      </td>
    </tr>`).join('');
  }

  const paginationEl = document.getElementById('riwayat-pagination');
  if(totalPages > 1){
    paginationEl.innerHTML = `
      <div style="display:flex; justify-content:center; gap:8px; margin-top:14px; align-items:center;">
        <button class="btn btn-sm" id="btn-prev-riw" ${store.ui.pageRiwayat===1?'disabled':''}>Sebelumnya</button>
        <span style="font-size:12px; color:var(--ink-soft);">Halaman ${store.ui.pageRiwayat} dari ${totalPages}</span>
        <button class="btn btn-sm" id="btn-next-riw" ${store.ui.pageRiwayat===totalPages?'disabled':''}>Selanjutnya</button>
      </div>`;
    const btnPrev = document.getElementById('btn-prev-riw');
    const btnNext = document.getElementById('btn-next-riw');
    if(btnPrev) btnPrev.addEventListener('click', ()=>{ store.ui.pageRiwayat--; renderRiwayat(); });
    if(btnNext) btnNext.addEventListener('click', ()=>{ store.ui.pageRiwayat++; renderRiwayat(); });
  }

  document.getElementById('riwayat-search').addEventListener('input', e=>{ store.ui.riwayatSearch=e.target.value; store.ui.pageRiwayat=1; renderRiwayat(); });
  document.getElementById('riwayat-kelas-filter').addEventListener('change', e=>{ store.ui.riwayatKelasFilter=e.target.value; store.ui.pageRiwayat=1; renderRiwayat(); });
  document.getElementById('riwayat-status-filter').addEventListener('change', e=>{ store.ui.riwayatStatusFilter=e.target.value; store.ui.pageRiwayat=1; renderRiwayat(); });
  tbody.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click', ()=>openDetailSiswa(b.dataset.detail)));
  tbody.querySelectorAll('[data-wa-tagihan]').forEach(b=>b.addEventListener('click', ()=>{
    const id = b.dataset.waTagihan;
    const s = store.state.siswa.find(x=>x.id===id);
    const t = siswaTunggakan(id);
    const bulanTeks = t.bulanBelum.map(m=>`- ${BULAN[m.bulan-1]} ${m.tahun} (Kurang: ${fmtRupiah(m.kurang)})`).join('\n');
    const teks = `Halo Bapak/Ibu,\n\nKami menginformasikan bahwa terdapat tunggakan pembayaran SPP atas nama *${s.nama}* (Kelas ${s.kelas}).\n\nRincian Tunggakan:\n${bulanTeks}\n\n*Total Tunggakan: ${fmtRupiah(t.totalKurang)}*\n\nMohon untuk segera melakukan pembayaran. Jika sudah membayar, abaikan pesan ini.\n\nTerima kasih,\nBendahara ${store.state.settings.namaSekolah}`;
    const url = formatWaLink(s.noHp, teks);
    window.open(url, '_blank');
  }));
}

function openDetailSiswa(id){
  const s = store.state.siswa.find(x=>x.id===id);
  const t = siswaTunggakan(id);
  const periode = getPeriode();
  openModal(`
    <div class="modal-head"><h3>${escapeHtml(s.nama)}</h3><button class="close-x" id="modal-close">&times;</button></div>
    <div class="modal-body">
      <div class="kpi-line">
        <div class="kpi"><span class="n">${escapeHtml(s.kelas)}</span><span class="l">Kelas</span></div>
        <div class="kpi"><span class="n">${escapeHtml(s.nis||'-')}</span><span class="l">NIS</span></div>
        <div class="kpi"><span class="n">${fmtRupiah(t.totalKurang)}</span><span class="l">Tunggakan SPP</span></div>
      </div>
      <div class="divider"></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:12px; background:var(--paper-dim); padding:10px; border-radius:6px;">
        <span>Sisa Tagihan Ijazah:</span>
        <strong style="color:var(--rust);">${fmtRupiah(Math.max(0, (store.state.settings.nominalIjazah || 500000) - store.state.pembayaran.filter(p=>p.siswaId===s.id && p.jenis==='ijazah').reduce((sum, p)=>sum+p.nominal, 0)))}</strong>
      </div>
      <label>Status SPP per bulan — Tahun Ajaran ${store.state.settings.tahunAjaran}</label>
      <div class="month-grid">
        ${periode.map(p=>{
          const total = siswaTotalBulan(s.id, p.bulan, p.tahun);
          const nominal = store.state.settings.nominalSPP;
          const cls = total>=nominal ? 'paid' : '';
          return `<div class="month-pill ${cls}">${BULAN[p.bulan-1]} '${String(p.tahun).slice(2)}<span class="chk">${total>=nominal?'✓ Lunas':total>0?fmtRupiah(total):'—'}</span></div>`;
        }).join('')}
      </div>
    </div>
    <div class="modal-foot">
      ${s.noHp && t.totalKurang > 0 ? `<button class="btn" id="btn-wa-tagihan" style="background:#25D366; color:white; border-color:#25D366; margin-right:auto;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Kirim Tagihan WA</button>` : ''}
      <button class="btn btn-primary" id="modal-cancel">Tutup</button>
    </div>
  `, 'wide');

  if (s.noHp && t.totalKurang > 0) {
    document.getElementById('btn-wa-tagihan').addEventListener('click', ()=>{
      const bulanTeks = t.bulanBelum.map(b=>`- ${BULAN[b.bulan-1]} ${b.tahun} (Kurang: ${fmtRupiah(b.kurang)})`).join('\n');
      const teks = `Halo Bapak/Ibu,\n\nKami menginformasikan bahwa terdapat tunggakan pembayaran SPP atas nama *${s.nama}* (Kelas ${s.kelas}).\n\nRincian Tunggakan:\n${bulanTeks}\n\n*Total Tunggakan: ${fmtRupiah(t.totalKurang)}*\n\nMohon untuk segera melakukan pembayaran. Jika sudah membayar, abaikan pesan ini.\n\nTerima kasih,\nBendahara ${store.state.settings.namaSekolah}`;
      const url = formatWaLink(s.noHp, teks);
      window.open(url, '_blank');
    });
  }
}
