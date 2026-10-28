import { store } from '../../app/state.js';
import { getPeriode, emptyState, siswaTotalBulan, toast, BULAN } from '../../utils/helpers.js';
import { fmtDate, fmtRupiah, escapeHtml } from '../../utils/formatters.js';
import { triggerRender } from '../../utils/events.js';
import { openConfirm } from '../../components/Modal.js';
import { getPembayaranBySiswaId, savePembayaranSPP, savePembayaranIjazah, generateNoKwitansi, cancelPembayaran, getSisaTagihanIjazah } from './pembayaranService.js';
import { cetakKwitansi } from './kwitansi.js';

export function renderBayar(){
  const el = document.getElementById('page-bayar');
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
  const sorted = [...store.state.siswa].sort((a,b)=> a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  const existingSiswa = store.state.siswa.find(s => s.id === store.ui.bayarSiswaId);
  const siswa = existingSiswa || sorted[0];
  const selectedId = siswa.id;
  store.ui.bayarSiswaId = selectedId;
  
  store.ui.bayarJenis = store.ui.bayarJenis || 'spp';
  const jenis = store.ui.bayarJenis;
  const periode = getPeriode();
  const nominalSPP = store.state.settings.nominalSPP;
  const nominalIjazah = store.state.settings.nominalIjazah || 500000;
  
  const tagihanIjazah = getSisaTagihanIjazah(siswa.id, nominalIjazah);

  el.innerHTML = `
    <div class="tabs" style="margin-bottom: 16px;">
      <button class="tab-btn ${jenis==='spp'?'active':''}" id="tab-spp">Pembayaran SPP</button>
      <button class="tab-btn ${jenis==='ijazah'?'active':''}" id="tab-ijazah">Pembayaran Ijazah</button>
    </div>
    <div class="card">
      <div class="form-row">
        <div class="form-group">
          <label>Pilih Siswa</label>
          <select id="bayar-siswa-select" style="width:100%;">
            ${sorted.map(s=>`<option value="${s.id}" ${s.id===selectedId?'selected':''}>${escapeHtml(s.nama)} — ${escapeHtml(s.kelas)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>${jenis==='spp' ? 'Nominal SPP per Bulan' : 'Tagihan Ijazah (Total)'}</label>
          <input value="${jenis==='spp' ? fmtRupiah(nominalSPP) : fmtRupiah(nominalIjazah)}" disabled style="width:100%;">
        </div>
      </div>
      <div class="divider"></div>
      
      ${jenis==='spp' ? `
        <label>Pilih bulan yang dibayar (klik untuk pilih, hijau = sudah lunas)</label>
        <div class="month-grid" id="month-grid"></div>
        <div class="helper-text">Bisa pilih lebih dari satu bulan sekaligus. Klasifikasi tunggakan mengikuti Tahun Ajaran ${store.state.settings.tahunAjaran}.</div>
      ` : `
        <div style="background:var(--paper-dim); padding:12px; border-radius:6px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Total Tagihan Ijazah:</span> <strong>${fmtRupiah(nominalIjazah)}</strong></div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#10B981;"><span>Sudah Terbayar:</span> <strong>${fmtRupiah(tagihanIjazah.terbayar)}</strong></div>
          <div class="divider" style="margin:8px 0;"></div>
          <div style="display:flex; justify-content:space-between; color:var(--rust); font-weight:600;"><span>Sisa Tagihan:</span> <span>${fmtRupiah(tagihanIjazah.sisa)}</span></div>
        </div>
      `}

      <div class="divider"></div>
      <div class="form-row">
        <div class="form-group">
          <label>Total Nominal Dibayar</label>
          <input id="bayar-nominal" type="text" style="width:100%;" placeholder="0">
          <div class="helper-text" id="nominal-hint">${jenis==='ijazah' ? 'Masukkan nominal cicilan/pelunasan Ijazah' : ''}</div>
        </div>
        <div class="form-group">
          <label>Tanggal Bayar</label>
          <input id="bayar-tanggal" type="date" style="width:100%;" value="${(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}">
        </div>
      </div>
      <div class="form-group">
        <label>Keterangan (opsional)</label>
        <input id="bayar-ket" style="width:100%;" placeholder="cth. dibayar tunai / transfer">
      </div>
      <button class="btn btn-primary" id="btn-simpan-bayar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg> Simpan Pembayaran & Cetak Kwitansi</button>
    </div>

    <div class="card">
      <h3>Riwayat Pembayaran — ${escapeHtml(siswa.nama)}</h3>
      <div class="card-sub">Transaksi terbaru untuk siswa ini</div>
      <div class="table-scroll">
        <table><thead><tr><th>Tanggal</th><th>Jenis / Bulan</th><th class="num">Nominal</th><th>Ket.</th><th style="width:70px;"></th></tr></thead>
        <tbody id="bayar-riwayat-tbody"></tbody></table>
      </div>
    </div>
  `;

  if(jenis==='spp') renderMonthGrid(siswa, periode, nominalSPP);
  renderBayarRiwayat(siswa);

  document.getElementById('tab-spp').addEventListener('click', ()=>{ store.ui.bayarJenis='spp'; store.ui.bayarSelectedMonths=[]; renderBayar(); });
  document.getElementById('tab-ijazah').addEventListener('click', ()=>{ store.ui.bayarJenis='ijazah'; store.ui.bayarSelectedMonths=[]; renderBayar(); });

  document.getElementById('bayar-siswa-select').addEventListener('change', e=>{
    store.ui.bayarSiswaId = e.target.value; store.ui.bayarSelectedMonths = []; renderBayar();
  });
  document.getElementById('bayar-nominal').addEventListener('input', e=>{
    let val = e.target.value.replace(/[^0-9]/g, '');
    if(val) val = parseInt(val, 10).toLocaleString('id-ID');
    e.target.value = val;
    e.target.dataset.touched = '1';
    if(jenis==='spp') updateNominalHint(nominalSPP);
  });
  document.getElementById('bayar-nominal').addEventListener('focus', e=> e.target.select());
  document.getElementById('btn-simpan-bayar').addEventListener('click', ()=>simpanPembayaran(nominalSPP));
}

function renderMonthGrid(siswa, periode, nominal){
  const grid = document.getElementById('month-grid');
  grid.innerHTML = periode.map(p=>{
    const total = siswaTotalBulan(siswa.id, p.bulan, p.tahun);
    const isPaid = total >= nominal;
    const isSelected = store.ui.bayarSelectedMonths.some(m=>m.bulan===p.bulan && m.tahun===p.tahun);
    const cls = isPaid ? 'paid' : (isSelected ? 'selected' : '');
    return `<div class="month-pill ${cls}" data-b="${p.bulan}" data-t="${p.tahun}">
      ${BULAN[p.bulan-1]} '${String(p.tahun).slice(2)}
      <span class="chk">${isPaid?'✓ Lunas':(total>0?'Sebagian':'')}</span>
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
        nomInput.value = (store.ui.bayarSelectedMonths.length * nominal).toLocaleString('id-ID');
      }
    });
  });
}

function updateNominalHint(nominal){
  const hint = document.getElementById('nominal-hint');
  const n = store.ui.bayarSelectedMonths.length;
  const suggested = n * nominal;
  hint.textContent = n>0 ? `${n} bulan dipilih · saran nominal ${fmtRupiah(suggested)}` : 'Pilih bulan terlebih dahulu';
}

function renderBayarRiwayat(siswa){
  const rows = getPembayaranBySiswaId(siswa.id);
  const tbody = document.getElementById('bayar-riwayat-tbody');
  if(rows.length===0){ tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Belum ada riwayat pembayaran.</td></tr>`; return; }
  tbody.innerHTML = rows.map(p=>`<tr>
    <td>${fmtDate(p.tanggal)}</td>
    <td>${(!p.jenis || p.jenis==='spp') ? 'SPP ' + BULAN[p.bulan-1] + ' ' + p.tahun : 'Ijazah'}</td>
    <td class="num">${fmtRupiah(p.nominal)}</td>
    <td>${escapeHtml(p.keterangan||'-')}</td>
    <td>
      <button class="btn btn-sm btn-ghost" data-cetak="${p.id}" title="Cetak ulang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18h12v4H6v-4zM4 9h16v7H4z"/></svg></button>
      <button class="btn btn-sm btn-ghost" data-del-bayar="${p.id}" title="Batalkan transaksi" style="color:var(--rust);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
    </td>
  </tr>`).join('');
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
  } else {
    savePembayaranIjazah(siswa.id, nominal, tanggal, ket, noKwitansi);
  }

  store.ui.bayarSelectedMonths = [];
  cetakKwitansi(siswa, months, nominal, noKwitansi, tanggal, jenis);
  renderBayar();
}
