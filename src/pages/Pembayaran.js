import { store, saveData } from '../state/store.js';
import { getPeriodeBerjalan, emptyState, siswaTotalBulan, uid, toast, fmtDate, fmtRupiah, escapeHtml, BULAN, formatWaLink } from '../utils/helpers.js';
import { triggerRender } from '../utils/events.js';
import { LOGO_BASE64 } from '../utils/constants.js';
import { openConfirm, openModal } from '../components/Modal.js';

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
  const selectedId = store.ui.bayarSiswaId || sorted[0].id;
  store.ui.bayarSiswaId = selectedId;
  const siswa = store.state.siswa.find(s=>s.id===selectedId);
  const periode = getPeriodeBerjalan();
  const nominal = store.state.settings.nominalSPP;

  el.innerHTML = `
    <div class="card">
      <div class="form-row">
        <div class="form-group">
          <label>Pilih Siswa</label>
          <select id="bayar-siswa-select" style="width:100%;">
            ${sorted.map(s=>`<option value="${s.id}" ${s.id===selectedId?'selected':''}>${escapeHtml(s.nama)} — ${escapeHtml(s.kelas)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Nominal SPP per Bulan</label>
          <input value="${fmtRupiah(nominal)}" disabled style="width:100%;">
        </div>
      </div>
      <div class="divider"></div>
      <label>Pilih bulan yang dibayar (klik untuk pilih, hijau = sudah lunas)</label>
      <div class="month-grid" id="month-grid"></div>
      <div class="helper-text">Bisa pilih lebih dari satu bulan sekaligus. Klasifikasi tunggakan mengikuti Tahun Ajaran ${store.state.settings.tahunAjaran}.</div>
      <div class="divider"></div>
      <div class="form-row">
        <div class="form-group">
          <label>Total Nominal Dibayar</label>
          <input id="bayar-nominal" type="text" style="width:100%;" placeholder="0">
          <div class="helper-text" id="nominal-hint"></div>
        </div>
        <div class="form-group">
          <label>Tanggal Bayar</label>
          <input id="bayar-tanggal" type="date" style="width:100%;" value="${new Date().toISOString().slice(0,10)}">
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
        <table><thead><tr><th>Tanggal</th><th>Bulan</th><th class="num">Nominal</th><th>Ket.</th><th style="width:70px;"></th></tr></thead>
        <tbody id="bayar-riwayat-tbody"></tbody></table>
      </div>
    </div>
  `;

  renderMonthGrid(siswa, periode, nominal);
  renderBayarRiwayat(siswa);

  document.getElementById('bayar-siswa-select').addEventListener('change', e=>{
    store.ui.bayarSiswaId = e.target.value; store.ui.bayarSelectedMonths = []; renderBayar();
  });
  document.getElementById('bayar-nominal').addEventListener('input', e=>{
    let val = e.target.value.replace(/[^0-9]/g, '');
    if(val) val = parseInt(val, 10).toLocaleString('id-ID');
    e.target.value = val;
    e.target.dataset.touched = '1';
    updateNominalHint(nominal);
  });
  document.getElementById('bayar-nominal').addEventListener('focus', e=> e.target.select());
  document.getElementById('btn-simpan-bayar').addEventListener('click', ()=>simpanPembayaran(nominal));
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
  const rows = store.state.pembayaran.filter(p=>p.siswaId===siswa.id).sort((a,b)=> new Date(b.tanggal)-new Date(a.tanggal));
  const tbody = document.getElementById('bayar-riwayat-tbody');
  if(rows.length===0){ tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Belum ada riwayat pembayaran.</td></tr>`; return; }
  tbody.innerHTML = rows.map(p=>`<tr>
    <td>${fmtDate(p.tanggal)}</td>
    <td>${BULAN[p.bulan-1]} ${p.tahun}</td>
    <td class="num">${fmtRupiah(p.nominal)}</td>
    <td>${escapeHtml(p.keterangan||'-')}</td>
    <td>
      <button class="btn btn-sm btn-ghost" data-cetak="${p.id}" title="Cetak ulang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18h12v4H6v-4zM4 9h16v7H4z"/></svg></button>
      <button class="btn btn-sm btn-ghost" data-del-bayar="${p.id}" title="Batalkan transaksi" style="color:var(--rust);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
    </td>
  </tr>`).join('');
  tbody.querySelectorAll('[data-cetak]').forEach(b=>b.addEventListener('click', ()=>{
    const p = store.state.pembayaran.find(x=>x.id===b.dataset.cetak);
    cetakKwitansi(siswa, [{bulan:p.bulan, tahun:p.tahun}], p.nominal, p.noKwitansi, p.tanggal);
  }));
  tbody.querySelectorAll('[data-del-bayar]').forEach(b=>b.addEventListener('click', ()=>{
    openConfirm('Batalkan transaksi pembayaran ini?', ()=>{
      store.state.pembayaran = store.state.pembayaran.filter(x=>x.id!==b.dataset.delBayar);
      saveData('Pembayaran dibatalkan');
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
  
  inNominal.classList.remove('error');
  inTanggal.classList.remove('error');

  if(months.length===0){ toast('Pilih minimal satu bulan', 'warning'); return; }
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

  store.state.settings.kwitansiCounter = (store.state.settings.kwitansiCounter||0) + 1;
  const noKwitansi = 'KW-' + new Date(tanggal).getFullYear() + '-' + String(store.state.settings.kwitansiCounter).padStart(4,'0');

  const per = Math.floor(nominal / months.length);
  const remainder = nominal - per*months.length;
  months.forEach((m,i)=>{
    store.state.pembayaran.push({
      id: uid(), siswaId: siswa.id, bulan: m.bulan, tahun: m.tahun,
      tanggal, nominal: per + (i===0?remainder:0), keterangan: ket, noKwitansi
    });
  });

  saveData('Pembayaran tersimpan');
  store.ui.bayarSelectedMonths = [];
  cetakKwitansi(siswa, months, nominal, noKwitansi, tanggal);
  renderBayar();
}

function cetakKwitansi(siswa, months, nominal, noKwitansi, tanggal){
  const s = store.state.settings;
  const bulanText = months.map(m=>`${BULAN[m.bulan-1]} ${m.tahun}`).join(', ');
  const area = document.getElementById('kwitansi-print-area');
  area.innerHTML = `
    <div class="receipt">
      <div class="receipt-head">
        <img src="${LOGO_BASE64}" class="seal" alt="Logo">
        <div class="sekolah">${escapeHtml(s.namaSekolah)}</div>
        <div class="ta">Tahun Ajaran ${escapeHtml(s.tahunAjaran)}</div>
      </div>
      <div class="receipt-title">KUITANSI PEMBAYARAN SPP</div>
      <div class="receipt-row"><span class="k">No. Kuitansi</span><span class="v">${noKwitansi}</span></div>
      <div class="receipt-row"><span class="k">Tanggal</span><span class="v">${fmtDate(tanggal)}</span></div>
      <div class="receipt-row"><span class="k">Nama Siswa</span><span class="v">${escapeHtml(siswa.nama)}</span></div>
      <div class="receipt-row"><span class="k">Kelas</span><span class="v">${escapeHtml(siswa.kelas)}</span></div>
      <div class="receipt-row"><span class="k">NIS</span><span class="v">${escapeHtml(siswa.nis||'-')}</span></div>
      <div class="receipt-row"><span class="k">Pembayaran</span><span class="v">SPP Bulan ${bulanText}</span></div>
      <div class="receipt-amt">
        <div class="lbl">Jumlah Dibayar</div>
        <div class="amt">${fmtRupiah(nominal)}</div>
      </div>
      <div class="receipt-sign">
        <div>Diterima oleh,</div>
        <div class="line">${escapeHtml(s.bendahara || 'Bendahara Sekolah')}</div>
      </div>
      <div class="receipt-foot">Kuitansi digital ini merupakan bukti pembayaran yang sah untuk keperluan arsip.</div>
    </div>
  `;
  openKwitansiModal(noKwitansi, siswa, bulanText, nominal, tanggal);
}

function openKwitansiModal(noKwitansi, siswa, bulanText, nominal, tanggal){
  const hasWa = !!siswa.noHp;
  openModal(`
    <div class="modal-head"><h3>Kuitansi ${noKwitansi}</h3><button class="close-x" id="modal-close">&times;</button></div>
    <div class="modal-body" id="kwitansi-preview-slot" style="background:var(--paper-dim); padding:24px 8px;"></div>
    <div class="modal-foot" style="flex-wrap:wrap;">
      <button class="btn" id="modal-cancel">Tutup</button>
      <div style="flex:1"></div>
      ${hasWa ? `<button class="btn" id="btn-wa-kwitansi" style="background:#25D366; color:white; border-color:#25D366;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Kirim via WA</button>` : ''}
      <button class="btn btn-primary" id="btn-cetak-kwitansi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18h12v4H6v-4zM4 9h16v7H4z"/></svg> Cetak / PDF</button>
    </div>
    <div style="padding:0 20px 14px; text-align:right; font-size:11.5px; color:var(--ink-soft);">Tips: Pastikan setelan Margin adalah "None" saat mencetak.</div>
  `, 'wide');
  document.getElementById('kwitansi-preview-slot').innerHTML = document.getElementById('kwitansi-print-area').innerHTML;
  document.getElementById('btn-cetak-kwitansi').addEventListener('click', ()=>{ window.print(); });
  
  if(hasWa){
    document.getElementById('btn-wa-kwitansi').addEventListener('click', ()=>{
      const teks = `*KUITANSI PEMBAYARAN SPP*
*${store.state.settings.namaSekolah.toUpperCase()}*
------------------------------------------------------

Kepada Yth. Bapak/Ibu Wali Murid dari *${siswa.nama}*,

Dengan hormat,
Melalui pesan ini kami menginformasikan bahwa kami telah menerima pembayaran SPP dengan rincian sebagai berikut:

📋 *Data Siswa*
Nama  : ${siswa.nama}
Kelas : ${siswa.kelas}
NIS   : ${siswa.nis || '-'}

📝 *Rincian Pembayaran*
No. Kuitansi : ${noKwitansi}
Tanggal      : ${fmtDate(tanggal)}
Pembayaran   : SPP Bulan ${bulanText}
Total Bayar  : *${fmtRupiah(nominal)}*

------------------------------------------------------
Kuitansi digital ini diterbitkan secara otomatis oleh sistem dan merupakan bukti pembayaran yang sah. Mohon simpan pesan ini sebagai referensi.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,
*Bendahara ${store.state.settings.namaSekolah}*`;
      
      const url = formatWaLink(siswa.noHp, teks);
      window.open(url, '_blank');
    });
  }
}
