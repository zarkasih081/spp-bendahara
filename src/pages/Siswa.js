import { store, saveData } from '../state/store.js';
import { currentPeriodeEntry, siswaStatusBulan, escapeHtml, escapeAttr, uid, toast } from '../utils/helpers.js';
 
import { openModal, closeModal, openConfirm } from '../components/Modal.js';
import * as XLSX from 'xlsx';

let selectedSiswaIds = new Set();

export function renderSiswa(){
  const el = document.getElementById('page-siswa');
  const kelasList = [...new Set(store.state.siswa.map(s=>s.kelas))].sort();

  let filtered = store.state.siswa.filter(s=>{
    const matchSearch = !store.ui.siswaSearch || s.nama.toLowerCase().includes(store.ui.siswaSearch.toLowerCase()) || (s.nis||'').includes(store.ui.siswaSearch);
    const matchKelas = !store.ui.siswaKelasFilter || s.kelas === store.ui.siswaKelasFilter;
    return matchSearch && matchKelas;
  }).sort((a,b)=> a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

  el.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <input class="search-input" id="siswa-search" placeholder="Cari nama / NIS..." value="${escapeAttr(store.ui.siswaSearch)}">
        <select id="siswa-kelas-filter">
          <option value="">Semua Kelas</option>
          ${kelasList.map(k=>`<option value="${escapeAttr(k)}" ${store.ui.siswaKelasFilter===k?'selected':''}>${escapeHtml(k)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right" style="gap:8px;">
        <button class="btn btn-danger" id="btn-bulk-delete" style="display:none; padding:8px 12px;" title="Hapus Terpilih"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin:0;"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
        <button class="btn btn-secondary" id="btn-bulk-promote" style="display:none;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="13 17 18 12 13 7"></polyline><line x1="6" y1="12" x2="18" y2="12"></line></svg> Naik Kelas</button>
        <div style="width:1px; background:var(--line); margin: 0 4px; display:none;" id="bulk-divider"></div>
        <button class="btn" id="btn-download-template" title="Download Format Excel Kosong"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>
        <button class="btn" id="btn-import"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Import Excel</button>
        <button class="btn btn-primary" id="btn-add-siswa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg> Tambah Siswa</button>
      </div>
    </div>
    <div class="card" style="padding:0;">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th style="width:40px; text-align:center;"><input type="checkbox" id="siswa-select-all"></th>
              <th>Nama</th><th>Kelas</th><th>NIS</th><th>No. WA</th><th class="num">SPP Bulan Ini</th><th style="width:90px;"></th>
            </tr>
          </thead>
          <tbody id="siswa-tbody"></tbody>
        </table>
      </div>
    </div>
    <div id="siswa-pagination"></div>
  `;
  const cur = currentPeriodeEntry();
  const tbody = document.getElementById('siswa-tbody');
  
  const ITEMS_PER_PAGE = 50;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  if(store.ui.pageSiswa > totalPages) store.ui.pageSiswa = totalPages;
  const paged = filtered.slice((store.ui.pageSiswa-1)*ITEMS_PER_PAGE, store.ui.pageSiswa*ITEMS_PER_PAGE);

  if(paged.length===0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Tidak ada siswa yang cocok.</td></tr>`;
  } else {
    tbody.innerHTML = paged.map(s=>{
      const st = siswaStatusBulan(s.id, cur.bulan, cur.tahun);
      const isChecked = selectedSiswaIds.has(s.id) ? 'checked' : '';
      return `<tr class="${isChecked ? 'selected-row' : ''}">
        <td style="text-align:center;"><input type="checkbox" class="siswa-select-cb" data-id="${s.id}" ${isChecked}></td>
        <td>${escapeHtml(s.nama)}</td>
        <td><span class="kelas-chip">${escapeHtml(s.kelas)}</span></td>
        <td>${escapeHtml(s.nis||'-')}</td>
        <td>${escapeHtml(s.noHp||'-')}</td>
        <td class="num"><span class="badge ${st}">${st==='lunas'?'Lunas':st==='parsial'?'Sebagian':'Belum'}</span></td>
        <td>
          <button class="btn btn-sm btn-ghost" data-edit-siswa="${s.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L18 10l-4-4L4 16v4z"/></svg></button>
          <button class="btn btn-sm btn-ghost" data-del-siswa="${s.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
        </td>
      </tr>`;
    }).join('');
  }

  const paginationEl = document.getElementById('siswa-pagination');
  if(totalPages > 1){
    paginationEl.innerHTML = `
      <div style="display:flex; justify-content:center; gap:8px; margin-top:14px; align-items:center;">
        <button class="btn btn-sm" id="btn-prev-siswa" ${store.ui.pageSiswa===1?'disabled':''}>Sebelumnya</button>
        <span style="font-size:12px; color:var(--ink-soft);">Halaman ${store.ui.pageSiswa} dari ${totalPages}</span>
        <button class="btn btn-sm" id="btn-next-siswa" ${store.ui.pageSiswa===totalPages?'disabled':''}>Selanjutnya</button>
      </div>`;
    const btnPrev = document.getElementById('btn-prev-siswa');
    if(btnPrev) btnPrev.addEventListener('click', ()=>{ store.ui.pageSiswa--; renderSiswa(); });
    const btnNext = document.getElementById('btn-next-siswa');
    if(btnNext) btnNext.addEventListener('click', ()=>{ store.ui.pageSiswa++; renderSiswa(); });
  }

  document.getElementById('siswa-search').addEventListener('input', e=>{ store.ui.siswaSearch = e.target.value; store.ui.pageSiswa=1; renderSiswa(); });
  document.getElementById('siswa-kelas-filter').addEventListener('change', e=>{ store.ui.siswaKelasFilter = e.target.value; store.ui.pageSiswa=1; renderSiswa(); });
  document.getElementById('btn-add-siswa').addEventListener('click', ()=>openSiswaModal());
  document.getElementById('btn-import').addEventListener('click', ()=>document.getElementById('import-file-input').click());
  tbody.querySelectorAll('[data-edit-siswa]').forEach(b=>b.addEventListener('click', ()=>openSiswaModal(b.dataset.editSiswa)));
  tbody.querySelectorAll('[data-del-siswa]').forEach(b=>b.addEventListener('click', ()=>deleteSiswa(b.dataset.delSiswa)));

  // Bulk Actions UI Update
  const btnBulkDelete = document.getElementById('btn-bulk-delete');
  const btnBulkPromote = document.getElementById('btn-bulk-promote');
  const bulkDivider = document.getElementById('bulk-divider');
  
  const updateBulkUI = () => {
    const hasSelection = selectedSiswaIds.size > 0;
    btnBulkDelete.style.display = hasSelection ? 'inline-flex' : 'none';
    btnBulkPromote.style.display = hasSelection ? 'inline-flex' : 'none';
    bulkDivider.style.display = hasSelection ? 'block' : 'none';
  };
  
  const selectAllCb = document.getElementById('siswa-select-all');
  if(selectAllCb) {
    selectAllCb.checked = paged.length > 0 && paged.every(s => selectedSiswaIds.has(s.id));
    selectAllCb.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      paged.forEach(s => {
        if(isChecked) selectedSiswaIds.add(s.id);
        else selectedSiswaIds.delete(s.id);
      });
      renderSiswa(); 
    });
  }

  tbody.querySelectorAll('.siswa-select-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedSiswaIds.add(id);
      else selectedSiswaIds.delete(id);
      updateBulkUI();
      const tr = e.target.closest('tr');
      if (e.target.checked) tr.classList.add('selected-row');
      else tr.classList.remove('selected-row');
      selectAllCb.checked = paged.length > 0 && paged.every(s => selectedSiswaIds.has(s.id));
    });
  });
  
  updateBulkUI();

  // Template Download
  document.getElementById('btn-download-template').addEventListener('click', () => {
    const ws = XLSX.utils.json_to_sheet([{ Nama: '', Kelas: '', NIS: '', WA: '', PIN: '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FormatSiswa");
    XLSX.writeFile(wb, "Template_Siswa_SPP.xlsx");
  });

  btnBulkDelete.addEventListener('click', () => {
    openConfirm(`Hapus ${selectedSiswaIds.size} siswa terpilih secara permanen? Data pembayaran mereka juga akan hilang.`, () => {
      store.state.siswa = store.state.siswa.filter(s => !selectedSiswaIds.has(s.id));
      store.state.pembayaran = store.state.pembayaran.filter(p => !selectedSiswaIds.has(p.siswaId));
      selectedSiswaIds.clear();
      saveData('Data siswa masal dihapus');
      renderSiswa();
    });
  });

  btnBulkPromote.addEventListener('click', () => {
    openModal(`
      <div class="modal-head"><h3>Naik Kelas Masal</h3><button class="close-x" id="modal-close">&times;</button></div>
      <div class="modal-body">
        <p style="margin-bottom:12px; font-size:14px; color:var(--ink-soft);">Anda akan memindahkan <b>${selectedSiswaIds.size}</b> siswa ke kelas baru.</p>
        <div class="form-group">
          <label>Kelas Tujuan</label>
          <input id="bulk-kelas-baru" style="width:100%;" placeholder="cth. 8A">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" id="modal-cancel">Batal</button>
        <button class="btn btn-primary" id="modal-save-promote">Pindahkan Kelas</button>
      </div>
    `);
    document.getElementById('modal-save-promote').addEventListener('click', () => {
      const kelasBaru = document.getElementById('bulk-kelas-baru').value.trim();
      if(!kelasBaru) { toast('Kelas tujuan wajib diisi', 'warning'); return; }
      
      store.state.siswa.forEach(s => {
        if(selectedSiswaIds.has(s.id)) s.kelas = kelasBaru;
      });
      selectedSiswaIds.clear();
      saveData('Siswa berhasil dinaikkan kelas');
      closeModal();
      renderSiswa();
    });
  });
}

function openSiswaModal(id){
  const editing = id ? store.state.siswa.find(s=>s.id===id) : null;
  openModal(`
    <div class="modal-head"><h3>${editing?'Edit Siswa':'Tambah Siswa'}</h3><button class="close-x" id="modal-close">&times;</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label>Nama Lengkap</label>
        <input id="f-nama" style="width:100%;" value="${editing?escapeAttr(editing.nama):''}" placeholder="Nama siswa">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Kelas</label>
          <input id="f-kelas" style="width:100%;" value="${editing?escapeAttr(editing.kelas):''}" placeholder="cth. 7A">
        </div>
        <div class="form-group">
          <label>NIS (opsional)</label>
          <input id="f-nis" style="width:100%;" value="${editing?escapeAttr(editing.nis||''):''}" placeholder="Nomor induk siswa">
        </div>
      </div>
      <div class="form-group">
        <label>No. HP / WA Orang Tua (opsional)</label>
        <input id="f-nohp" style="width:100%;" value="${editing?escapeAttr(editing.noHp||''):''}" placeholder="cth. 08123456789">
        <div class="helper-text">Digunakan untuk mengirim tagihan dan kwitansi via WhatsApp otomatis.</div>
      </div>
      <div class="form-group">
        <label>Kata Sandi (PIN) Akses Siswa</label>
        <input id="f-pin" style="width:100%;" value="${editing?escapeAttr(editing.pin||''):''}" placeholder="Masukkan PIN atau password">
        <div class="helper-text">Digunakan siswa untuk masuk bersama dengan NIS. Boleh dikosongkan.</div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="modal-cancel">Batal</button>
      <button class="btn btn-primary" id="modal-save">${editing?'Simpan Perubahan':'Tambah Siswa'}</button>
    </div>
  `);
  document.getElementById('modal-save').addEventListener('click', ()=>{
    const inNama = document.getElementById('f-nama');
    const inKelas = document.getElementById('f-kelas');
    const inNis = document.getElementById('f-nis');
    const nama = inNama.value.trim();
    const kelas = inKelas.value.trim();
    const nis = inNis.value.trim();
    const noHp = document.getElementById('f-nohp').value.trim();
    const pin = document.getElementById('f-pin').value.trim();
    
    // Clear previous errors
    [inNama, inKelas, inNis].forEach(el => el.classList.remove('error'));
    
    if(!nama || !kelas){ 
      if(!nama) inNama.classList.add('error');
      if(!kelas) inKelas.classList.add('error');
      toast('Nama dan kelas wajib diisi', 'warning'); 
      return; 
    }
    if(nis){
      const duplikat = store.state.siswa.find(s => s.nis === nis && (!editing || s.id !== editing.id));
      if(duplikat){ 
        inNis.classList.add('error');
        toast('Gagal: NIS sudah terdaftar untuk siswa lain', 'error'); 
        return; 
      }
    }
    if(editing){
      editing.nama = nama; editing.kelas = kelas; editing.nis = nis; editing.noHp = noHp; editing.pin = pin;
      saveData('Data siswa diperbarui');
    } else {
      store.state.siswa.push({ id: uid(), nama, kelas, nis, noHp, pin });
      saveData('Siswa baru ditambahkan');
    }
    closeModal(); renderSiswa();
  });
}

function deleteSiswa(id){
  const s = store.state.siswa.find(x=>x.id===id);
  if(!s) return;
  openConfirm(`Hapus data "${s.nama}"? Riwayat pembayarannya juga akan dihapus.`, ()=>{
    store.state.siswa = store.state.siswa.filter(x=>x.id!==id);
    store.state.pembayaran = store.state.pembayaran.filter(p=>p.siswaId!==id);
    saveData('Data siswa dihapus');
    renderSiswa();
  });
}

export function initSiswaEvents() {
  document.getElementById('import-file-input').addEventListener('change', function(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt){
      try{
        const wb = XLSX.read(evt.target.result, { type:'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval:'' });
        let added = 0, skipped = 0;
        rows.forEach(r=>{
          const nama = (r.Nama || r.nama || r.NAMA || '').toString().trim();
          const kelas = (r.Kelas || r.kelas || r.KELAS || '').toString().trim();
          const nis = (r.NIS || r.Nis || r.nis || '').toString().trim();
          const noHp = (r['No. HP'] || r.noHp || r.WA || r.Wa || '').toString().trim();
          if(!nama || !kelas){ skipped++; return; }
          store.state.siswa.push({ id: uid(), nama, kelas, nis, noHp });
          added++;
        });
        saveData(`Import selesai: ${added} siswa ditambahkan${skipped?`, ${skipped} baris dilewati`:''}`);
        renderSiswa();
      }catch(err){
        toast('Gagal membaca file. Pastikan format kolom: Nama, Kelas, NIS, WA', 'error');
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  });
}
