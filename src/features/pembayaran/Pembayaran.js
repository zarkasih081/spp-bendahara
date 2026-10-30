import { store } from '../../app/state.js';
import { getPeriode, currentPeriodeEntry, siswaTunggakan, emptyState, siswaTotalBulan, toast, BULAN, getActiveTahunMulai } from '../../utils/helpers.js';
import { fmtDate, fmtRupiah, escapeHtml, escapeAttr } from '../../utils/formatters.js';
import { triggerRender } from '../../utils/events.js';
import { openConfirm } from '../../components/Modal.js';
import { getPembayaranBySiswaId, getSuggestedSppNominal, savePembayaranSPP, savePembayaranIjazah, savePembayaranPosTagihan, getStatusPosTagihan, generateNoKwitansi, cancelPembayaran, getSisaTagihanIjazah } from './pembayaranService.js';
import { cetakKwitansi } from './kwitansi.js';

export function renderBayar(){
  const el = document.getElementById('page-bayar');
  const wasSearchFocused = document.activeElement?.id === 'bayar-siswa-search';
  const selStart = wasSearchFocused ? document.activeElement.selectionStart : null;
  const selEnd = wasSearchFocused ? document.activeElement.selectionEnd : null;

  if(store.state.siswa.length===0){
    el.innerHTML = emptyState('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>', 'Belum ada data siswa', 'Tambahkan siswa terlebih dahulu sebelum mencatat pembayaran.', 'Tambah Data Siswa', () => {
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
  const bayarKelasFilter = store.ui.bayarKelasFilter || '';
  const bayarSearch = store.ui.bayarSiswaSearch || '';

  const allSorted = [...store.state.siswa].sort((a,b)=> a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  const filteredSiswa = allSorted.filter(s => {
    const matchKelas = !bayarKelasFilter || s.kelas === bayarKelasFilter;
    const matchSearch = !bayarSearch || s.nama.toLowerCase().includes(bayarSearch.toLowerCase()) || (s.nis||'').includes(bayarSearch);
    return matchKelas && matchSearch;
  });

  const listToUse = filteredSiswa.length > 0 ? filteredSiswa : allSorted;
  const existingSiswa = listToUse.find(s => s.id === store.ui.bayarSiswaId);
  const siswa = existingSiswa || listToUse[0];
  const selectedId = siswa.id;
  store.ui.bayarSiswaId = selectedId;
  
  store.ui.bayarJenis = store.ui.bayarJenis || 'spp';
  const jenis = store.ui.bayarJenis;
  const periode = getPeriode();
  const nominalSPP = store.state.settings.nominalSPP;
  const nominalIjazah = store.state.settings.nominalIjazah || 500000;
  
  const tagihanIjazah = getSisaTagihanIjazah(siswa.id, nominalIjazah);
  const tunggakanSiswa = siswaTunggakan(siswa.id);

  // Pos tagihan list
  const posTagihanList = store.state.posTagihan || [];
  if (!store.ui.bayarSelectedPosId && posTagihanList.length > 0) {
    store.ui.bayarSelectedPosId = posTagihanList[0].id;
  }
  const selectedPos = posTagihanList.find(x => x.id === store.ui.bayarSelectedPosId) || posTagihanList[0] || null;
  const posStatus = selectedPos ? getStatusPosTagihan(siswa.id, selectedPos.id, selectedPos.nominal) : { terbayar: 0, sisa: 0 };

  // Check if year is locked
  const activeTa = getActiveTahunMulai();
  const isTaLocked = (store.state.settings.tahunAjaranTerkunci || []).includes(activeTa);

  el.innerHTML = `
    <!-- Sub-Tabs Pembayaran -->
    <div class="tabs" style="margin-bottom: 16px;">
      <button class="tab-btn ${jenis==='spp'?'active':''}" id="tab-spp">Pembayaran SPP Bulanan</button>
      <button class="tab-btn ${jenis==='ijazah'?'active':''}" id="tab-ijazah">Tabungan Ijazah</button>
      <button class="tab-btn ${jenis==='lainnya'?'active':''}" id="tab-lainnya">Tagihan Sekolah Lainnya</button>
    </div>

    ${isTaLocked ? `
      <div style="background:rgba(239,68,68,0.08); border:1.5px solid rgba(239,68,68,0.25); color:#DC2626; padding:12px 16px; border-radius:10px; margin-bottom:16px; display:flex; align-items:center; gap:10px;">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div>
          <strong>Tahun Ajaran ${activeTa}/${activeTa+1} Terkunci (Arsip Resmi)</strong>
          <div style="font-size:12px; margin-top:2px;">Data keuangan pada tahun ajaran ini telah dikunci untuk melindungi integritas audit. Buka kunci di menu Pengaturan jika ingin melakukan transaksi.</div>
        </div>
      </div>
    ` : ''}

    <div class="card">
      <div class="form-row" style="margin-bottom:10px;">
        <div class="form-group" style="margin-bottom:0;">
          <label>Filter Cepat Siswa (Nama / NIS / Kelas)</label>
          <div style="display:flex; gap:8px;">
            <input class="search-input" id="bayar-siswa-search" placeholder="Ketik nama atau NIS siswa..." value="${escapeAttr(bayarSearch)}" style="flex:1; min-width:0;">
            <select id="bayar-kelas-filter" style="width:140px;">
              <option value="">Semua Kelas</option>
              ${kelasList.map(k=>`<option value="${escapeAttr(k)}" ${bayarKelasFilter===k?'selected':''}>${escapeHtml(k)}</option>`).join('')}
            </select>
          </div>
          ${filteredSiswa.length === 0 ? `<div class="helper-text" style="color:var(--rust);">Tidak ada siswa yang cocok dengan pencarian "${escapeHtml(bayarSearch)}". Menampilkan semua siswa.</div>` : ''}
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Pilih Siswa (${listToUse.length} siswa)</label>
          <select id="bayar-siswa-select" style="width:100%;">
            ${listToUse.map(s=>`<option value="${s.id}" ${s.id===selectedId?'selected':''}>${escapeHtml(s.nama)} — ${escapeHtml(s.kelas)} ${s.nis ? `(${escapeHtml(s.nis)})` : ''}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; background:var(--paper-dim); padding:10px 14px; border-radius:var(--radius); border:1px solid var(--line); margin-top:12px;">
        <div style="font-size:12.5px;">
          Siswa Terpilih: <strong>${escapeHtml(siswa.nama)}</strong> <span class="kelas-chip">${escapeHtml(siswa.kelas)}</span>
          ${siswa.nis ? `<span style="color:var(--ink-soft); margin-left:6px;">NIS: ${escapeHtml(siswa.nis)}</span>` : ''}
        </div>
        <div style="font-size:12.5px;">
          ${jenis === 'spp'
            ? `Ketetapan SPP: <strong>${fmtRupiah(nominalSPP)}/bln</strong> • Tunggakan berjalan: <strong style="color:${tunggakanSiswa.totalKurang > 0 ? 'var(--rust)' : '#10B981'};">${tunggakanSiswa.totalKurang > 0 ? `${tunggakanSiswa.jumlahBulan} bln (${fmtRupiah(tunggakanSiswa.totalKurang)})` : 'Lunas'}</strong>`
            : (jenis === 'ijazah'
                ? `Total Ketetapan Ijazah: <strong>${fmtRupiah(nominalIjazah)}</strong>`
                : `Pos: <strong>${escapeHtml(selectedPos ? selectedPos.nama : '-')}</strong>`)}
        </div>
      </div>

      <div class="divider"></div>
      
      ${jenis==='spp' ? `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
          <label style="margin:0;">Pilih bulan yang dibayar (klik untuk pilih, hijau = sudah lunas)</label>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn btn-sm btn-secondary" id="btn-select-bulan-ini">Pilih Bulan Ini</button>
            ${tunggakanSiswa.jumlahBulan > 0 ? `<button type="button" class="btn btn-sm btn-outline" id="btn-select-tunggakan">Pilih Semua Tunggakan (${tunggakanSiswa.jumlahBulan})</button>` : ''}
            <button type="button" class="btn btn-sm btn-ghost" id="btn-reset-bulan">Reset Pilihan</button>
          </div>
        </div>
        <div class="month-grid" id="month-grid"></div>
        <div class="helper-text">Bisa pilih lebih dari satu bulan sekaligus. Pembayaran sebagian akan otomatis melunasi kekurangan bulan pertama terlebih dahulu.</div>
      ` : (jenis==='ijazah' ? `
        <div style="background:var(--paper-dim); padding:12px 14px; border-radius:8px; border:1px solid var(--line); margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Total Tagihan Ijazah:</span> <strong>${fmtRupiah(nominalIjazah)}</strong></div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#10B981;"><span>Sudah Terbayar:</span> <strong>${fmtRupiah(tagihanIjazah.terbayar)}</strong></div>
          <div class="divider" style="margin:8px 0;"></div>
          <div style="display:flex; justify-content:space-between; align-items:center; color:var(--rust); font-weight:600;">
            <span>Sisa Tagihan:</span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span>${fmtRupiah(tagihanIjazah.sisa)}</span>
              ${tagihanIjazah.sisa > 0 ? `<button type="button" class="btn btn-sm btn-outline" id="btn-fill-sisa-ijazah" style="padding:3px 10px; font-size:11.5px;">Lunasi Sisa</button>` : ''}
            </div>
          </div>
        </div>
      ` : `
        <!-- View for Tagihan Lainnya -->
        <div class="form-group">
          <label>Pilih Pos Tagihan Sekolah</label>
          <select id="bayar-select-pos" style="width:100%; font-size:14px; font-weight:600;">
            ${posTagihanList.map(pos => `<option value="${pos.id}" ${selectedPos && selectedPos.id === pos.id ? 'selected' : ''}>${escapeHtml(pos.nama)} — Ketetapan ${fmtRupiah(pos.nominal)}</option>`).join('')}
          </select>
        </div>

        ${selectedPos ? `
          <div style="background:var(--paper-dim); padding:12px 14px; border-radius:8px; border:1px solid var(--line); margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Total Ketetapan:</span> <strong>${fmtRupiah(selectedPos.nominal)}</strong></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#10B981;"><span>Sudah Terbayar:</span> <strong>${fmtRupiah(posStatus.terbayar)}</strong></div>
            <div class="divider" style="margin:8px 0;"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; color:var(--rust); font-weight:600;">
              <span>Sisa Kewajiban:</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <span>${fmtRupiah(posStatus.sisa)}</span>
                ${posStatus.sisa > 0 ? `<button type="button" class="btn btn-sm btn-outline" id="btn-fill-sisa-pos" style="padding:3px 10px; font-size:11.5px;">Lunasi Sisa</button>` : '<span class="badge lunas">Lunas 100%</span>'}
              </div>
            </div>
          </div>
        ` : '<div class="empty-state">Belum ada pos tagihan sekolah. Tambahkan di menu Pengaturan.</div>'}
      `)}

      <div class="divider"></div>
      <div class="form-row">
        <div class="form-group">
          <label>Total Nominal Dibayar</label>
          <input id="bayar-nominal" type="text" style="width:100%;" placeholder="0" ${isTaLocked ? 'disabled' : ''}>
          <div class="helper-text" id="nominal-hint"></div>
        </div>
        <div class="form-group">
          <label>Tanggal Bayar</label>
          <input id="bayar-tanggal" type="date" style="width:100%;" value="${(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}" ${isTaLocked ? 'disabled' : ''}>
        </div>
      </div>
      <div class="form-group">
        <label>Keterangan / Berita Transfer (opsional)</label>
        <input id="bayar-ket" style="width:100%;" placeholder="cth. dibayar tunai / transfer bank BRI" ${isTaLocked ? 'disabled' : ''}>
      </div>
      <button class="btn btn-primary" id="btn-simpan-bayar" ${isTaLocked ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
        Simpan Pembayaran & Cetak Kwitansi
      </button>
    </div>

    <div class="card">
      <h3>Riwayat Pembayaran — ${escapeHtml(siswa.nama)}</h3>
      <div class="card-sub">Transaksi terbaru untuk siswa ini</div>
      <div class="table-scroll">
        <table><thead><tr><th>Tanggal</th><th>Jenis / Pos Pembayaran</th><th class="num">Nominal</th><th>Ket.</th><th style="width:70px;"></th></tr></thead>
        <tbody id="bayar-riwayat-tbody"></tbody></table>
      </div>
    </div>
  `;

  if(jenis==='spp') renderMonthGrid(siswa, periode, nominalSPP);
  renderBayarRiwayat(siswa);

  document.getElementById('tab-spp')?.addEventListener('click', ()=>{ store.ui.bayarJenis='spp'; store.ui.bayarSelectedMonths=[]; renderBayar(); });
  document.getElementById('tab-ijazah')?.addEventListener('click', ()=>{ store.ui.bayarJenis='ijazah'; store.ui.bayarSelectedMonths=[]; renderBayar(); });
  document.getElementById('tab-lainnya')?.addEventListener('click', ()=>{ store.ui.bayarJenis='lainnya'; store.ui.bayarSelectedMonths=[]; renderBayar(); });

  document.getElementById('bayar-select-pos')?.addEventListener('change', e => {
    store.ui.bayarSelectedPosId = e.target.value;
    renderBayar();
  });

  const searchIn = document.getElementById('bayar-siswa-search');
  searchIn?.addEventListener('input', e => {
    store.ui.bayarSiswaSearch = e.target.value;
    store.ui.bayarSelectedMonths = [];
    renderBayar();
  });
  if (wasSearchFocused && searchIn) {
    searchIn.focus();
    if (selStart !== null) searchIn.setSelectionRange(selStart, selEnd);
  }

  document.getElementById('bayar-kelas-filter')?.addEventListener('change', e => {
    store.ui.bayarKelasFilter = e.target.value;
    store.ui.bayarSelectedMonths = [];
    renderBayar();
  });

  document.getElementById('bayar-siswa-select')?.addEventListener('change', e=>{
    store.ui.bayarSiswaId = e.target.value; store.ui.bayarSelectedMonths = []; renderBayar();
  });

  // Quick selection buttons for SPP
  document.getElementById('btn-select-bulan-ini')?.addEventListener('click', () => {
    const cur = currentPeriodeEntry();
    const total = siswaTotalBulan(siswa.id, cur.bulan, cur.tahun);
    if (total >= nominalSPP) {
      toast(`SPP bulan ${BULAN[cur.bulan-1]} ${cur.tahun} sudah lunas`, 'info');
      return;
    }
    store.ui.bayarSelectedMonths = [{ bulan: cur.bulan, tahun: cur.tahun }];
    renderMonthGrid(siswa, periode, nominalSPP);
    updateNominalHint(nominalSPP);
    const nomInput = document.getElementById('bayar-nominal');
    if (nomInput) {
      delete nomInput.dataset.touched;
      const suggested = getSuggestedSppNominal(siswa.id, store.ui.bayarSelectedMonths, nominalSPP);
      nomInput.value = suggested > 0 ? suggested.toLocaleString('id-ID') : '';
    }
  });

  document.getElementById('btn-select-tunggakan')?.addEventListener('click', () => {
    if (tunggakanSiswa.bulanBelum.length === 0) {
      toast('Tidak ada bulan tertunggak untuk siswa ini', 'info');
      return;
    }
    store.ui.bayarSelectedMonths = tunggakanSiswa.bulanBelum.map(m => ({ bulan: m.bulan, tahun: m.tahun }));
    renderMonthGrid(siswa, periode, nominalSPP);
    updateNominalHint(nominalSPP);
    const nomInput = document.getElementById('bayar-nominal');
    if (nomInput) {
      delete nomInput.dataset.touched;
      const suggested = getSuggestedSppNominal(siswa.id, store.ui.bayarSelectedMonths, nominalSPP);
      nomInput.value = suggested > 0 ? suggested.toLocaleString('id-ID') : '';
    }
  });

  document.getElementById('btn-reset-bulan')?.addEventListener('click', () => {
    store.ui.bayarSelectedMonths = [];
    renderMonthGrid(siswa, periode, nominalSPP);
    updateNominalHint(nominalSPP);
    const nomInput = document.getElementById('bayar-nominal');
    if (nomInput) {
      delete nomInput.dataset.touched;
      nomInput.value = '';
    }
  });

  document.getElementById('btn-fill-sisa-ijazah')?.addEventListener('click', () => {
    const nomInput = document.getElementById('bayar-nominal');
    if (nomInput && tagihanIjazah.sisa > 0) {
      nomInput.value = tagihanIjazah.sisa.toLocaleString('id-ID');
      nomInput.dataset.touched = '1';
    }
  });

  document.getElementById('btn-fill-sisa-pos')?.addEventListener('click', () => {
    const nomInput = document.getElementById('bayar-nominal');
    if (nomInput && posStatus.sisa > 0) {
      nomInput.value = posStatus.sisa.toLocaleString('id-ID');
      nomInput.dataset.touched = '1';
    }
  });

  document.getElementById('bayar-nominal')?.addEventListener('input', e=>{
    let val = e.target.value.replace(/[^0-9]/g, '');
    if(val) val = parseInt(val, 10).toLocaleString('id-ID');
    e.target.value = val;
    e.target.dataset.touched = '1';
    if(jenis==='spp') updateNominalHint(nominalSPP);
  });
  document.getElementById('bayar-nominal')?.addEventListener('focus', e=> e.target.select());
  document.getElementById('btn-simpan-bayar')?.addEventListener('click', ()=>simpanPembayaran(nominalSPP));
}

function renderMonthGrid(siswa, periode, nominal){
  const grid = document.getElementById('month-grid');
  if (!grid) return;
  grid.innerHTML = periode.map(p=>{
    const total = siswaTotalBulan(siswa.id, p.bulan, p.tahun);
    const isPaid = total >= nominal;
    const kurang = Math.max(0, nominal - total);
    const isSelected = store.ui.bayarSelectedMonths.some(m=>m.bulan===p.bulan && m.tahun===p.tahun);
    const cls = isPaid ? 'paid' : (isSelected ? 'selected' : '');
    return `<div class="month-pill ${cls}" data-b="${p.bulan}" data-t="${p.tahun}">
      ${BULAN[p.bulan-1]} '${String(p.tahun).slice(2)}
      <span class="chk">${isPaid ? 'Lunas' : (total > 0 ? `Kurang ${fmtRupiah(kurang)}` : '')}</span>
    </div>`;
  }).join('');
  grid.querySelectorAll('.month-pill:not(.paid)').forEach(pill=>{
    pill.addEventListener('click', ()=>{
      const b = +pill.dataset.b, t = +pill.dataset.t;
      const idx = store.ui.bayarSelectedMonths.findIndex(m=>m.bulan===b && m.tahun===t);
      if(idx>=0) store.ui.bayarSelectedMonths.splice(idx,1);
      else store.ui.bayarSelectedMonths.push({bulan:b, tahun:t});
      renderMonthGrid(siswa, periode, nominal);
      updateNominalHint(nominal);
      const nomInput = document.getElementById('bayar-nominal');
      if(nomInput && !nomInput.dataset.touched){
        const suggested = getSuggestedSppNominal(siswa.id, store.ui.bayarSelectedMonths, nominal);
        nomInput.value = suggested > 0 ? suggested.toLocaleString('id-ID') : '';
      }
    });
  });
}

function updateNominalHint(nominal){
  const hint = document.getElementById('nominal-hint');
  if (!hint) return;
  const n = store.ui.bayarSelectedMonths.length;
  const suggested = getSuggestedSppNominal(store.ui.bayarSiswaId, store.ui.bayarSelectedMonths, nominal);
  hint.textContent = n>0 ? `${n} bulan dipilih · saran pelunasan ${fmtRupiah(suggested)}` : 'Pilih bulan terlebih dahulu';
}

function renderBayarRiwayat(siswa){
  const rows = getPembayaranBySiswaId(siswa.id);
  const tbody = document.getElementById('bayar-riwayat-tbody');
  if (!tbody) return;
  if(rows.length===0){ tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Belum ada riwayat pembayaran.</td></tr>`; return; }
  tbody.innerHTML = rows.map(p=>{
    let jenisStr = 'SPP';
    if (p.jenis === 'ijazah') {
      jenisStr = 'Ijazah';
    } else if (!p.jenis || p.jenis === 'spp') {
      jenisStr = 'SPP ' + BULAN[p.bulan-1] + ' ' + p.tahun;
    } else {
      const pos = (store.state.posTagihan || []).find(x => x.id === p.jenis);
      jenisStr = pos ? pos.nama : (p.namaTagihan || p.jenis);
    }

    return `<tr>
      <td>${fmtDate(p.tanggal)}</td>
      <td><strong>${escapeHtml(jenisStr)}</strong></td>
      <td class="num">${fmtRupiah(p.nominal)}</td>
      <td>${escapeHtml(p.keterangan||'-')}</td>
      <td>
        <button class="btn btn-sm btn-ghost" data-cetak="${p.id}" title="Cetak ulang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18h12v4H6v-4zM4 9h16v7H4z"/></svg></button>
        <button class="btn btn-sm btn-ghost" data-del-bayar="${p.id}" title="Batalkan transaksi" style="color:var(--rust);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-cetak]').forEach(b=>b.addEventListener('click', ()=>{
    const p = store.state.pembayaran.find(x=>x.id===b.dataset.cetak);
    const jenis = p.jenis || 'spp';
    cetakKwitansi(siswa, [{bulan:p.bulan, tahun:p.tahun}], p.nominal, p.noKwitansi, p.tanggal, jenis);
  }));
  tbody.querySelectorAll('[data-del-bayar]').forEach(b=>b.addEventListener('click', ()=>{
    openConfirm('Batalkan transaksi pembayaran ini?', ()=>{
      cancelPembayaran(b.dataset.delBayar);
      renderBayar();
    });
  }));
}

function simpanPembayaran(nominalSPP){
  const activeTa = getActiveTahunMulai();
  const isTaLocked = (store.state.settings.tahunAjaranTerkunci || []).includes(activeTa);
  if (isTaLocked) {
    toast(`Tahun Ajaran ${activeTa}/${activeTa+1} terkunci (Arsip Resmi). Transaksi baru tidak dapat disimpan.`, 'error');
    return;
  }

  const siswa = store.state.siswa.find(s=>s.id===store.ui.bayarSiswaId);
  const inNominal = document.getElementById('bayar-nominal');
  const inTanggal = document.getElementById('bayar-tanggal');
  
  const nominal = parseInt(inNominal.value.replace(/[^0-9]/g, '')) || 0;
  const tanggal = inTanggal.value;
  const ket = document.getElementById('bayar-ket').value.trim();
  const months = store.ui.bayarSelectedMonths;
  const jenis = store.ui.bayarJenis;
  
  inNominal.classList.remove('error');
  inTanggal.classList.remove('error');

  if(jenis==='spp' && months.length===0){ toast('Pilih minimal satu bulan', 'warning'); return; }
  if(!nominal || nominal<=0){ 
    inNominal.classList.add('error');
    toast('Isi nominal pembayaran', 'warning'); 
    return; 
  }
  if(!tanggal){ 
    inTanggal.classList.add('error');
    toast('Isi tanggal bayar', 'warning'); 
    return; 
  }

  const noKwitansi = generateNoKwitansi(tanggal);

  if(jenis === 'spp'){
    savePembayaranSPP(siswa.id, nominal, tanggal, ket, months, noKwitansi);
    cetakKwitansi(siswa, months, nominal, noKwitansi, tanggal, 'spp');
  } else if (jenis === 'ijazah') {
    savePembayaranIjazah(siswa.id, nominal, tanggal, ket, noKwitansi);
    cetakKwitansi(siswa, [], nominal, noKwitansi, tanggal, 'ijazah');
  } else {
    // Pos tagihan lainnya
    const posList = store.state.posTagihan || [];
    const pos = posList.find(x => x.id === store.ui.bayarSelectedPosId) || posList[0];
    const posId = pos ? pos.id : 'tagihan-lain';
    const posNama = pos ? pos.nama : 'Administrasi Lainnya';
    savePembayaranPosTagihan(siswa.id, posId, posNama, nominal, tanggal, ket, noKwitansi);
    cetakKwitansi(siswa, [], nominal, noKwitansi, tanggal, posId);
  }

  store.ui.bayarSelectedMonths = [];
  renderBayar();
}
