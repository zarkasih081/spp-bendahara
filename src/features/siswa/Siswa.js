import { store } from '../../app/state.js';
import { currentPeriodeEntry, siswaStatusBulan, toast } from '../../utils/helpers.js';
import { escapeHtml, escapeAttr } from '../../utils/formatters.js';
import { triggerRender } from '../../utils/events.js';
import { openModal, closeModal, openConfirm } from '../../components/Modal.js';
import { handleImportExcel, downloadSiswaTemplate, exportSiswaExcel } from './siswaImport.js';
import { getSiswaById, addSiswa, updateSiswa, deleteSiswa, bulkDeleteSiswa, promoteSiswa, validateSiswa } from './siswaService.js';
import { renderStudentCardHtml } from '../absensi/qrCardGenerator.js';
import { renderAvatarHtml, compressImageFile } from '../../utils/imageHelper.js';

let selectedSiswaIds = new Set();

export function renderSiswa(){
  const el = document.getElementById('page-siswa');
  const wasSearchFocused = document.activeElement?.id === 'siswa-search';
  const selStart = wasSearchFocused ? document.activeElement.selectionStart : null;
  const selEnd = wasSearchFocused ? document.activeElement.selectionEnd : null;
  const kelasList = [...new Set(store.state.siswa.map(s=>s.kelas))].sort();

  const q = (store.ui.siswaSearch || '').toLowerCase().trim();
  let filtered = store.state.siswa.filter(s=>{
    const matchSearch = !q || 
      (s.nama || '').toLowerCase().includes(q) || 
      (s.nis || '').toLowerCase().includes(q) ||
      (s.nisn || '').toLowerCase().includes(q) ||
      (s.rfidUid || '').toLowerCase().includes(q);
    const matchKelas = !store.ui.siswaKelasFilter || s.kelas === store.ui.siswaKelasFilter;
    return matchSearch && matchKelas;
  }).sort((a,b)=> a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

  el.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <input class="search-input" id="siswa-search" placeholder="Cari nama / NIS / NISN / RFID..." value="${escapeAttr(store.ui.siswaSearch)}">
        <select id="siswa-kelas-filter">
          <option value="">Semua Kelas</option>
          ${kelasList.map(k=>`<option value="${escapeAttr(k)}" ${store.ui.siswaKelasFilter===k?'selected':''}>${escapeHtml(k)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right" style="gap:8px;">
        <button class="btn btn-danger" id="btn-bulk-delete" style="display:none; padding:8px 12px;" title="Hapus Terpilih"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin:0;"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
        <button class="btn btn-secondary" id="btn-bulk-promote" style="display:none;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="13 17 18 12 13 7"></polyline><line x1="6" y1="12" x2="18" y2="12"></line></svg> Naik Kelas</button>
        <button class="btn btn-secondary" id="btn-bulk-print-qr" style="display:none;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> Cetak Kartu</button>
        <div style="width:1px; background:var(--line); margin: 0 4px; display:none;" id="bulk-divider"></div>
        <button class="btn" id="btn-download-template" title="Download Format Excel Kosong"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>
        <button class="btn" id="btn-import"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Import Excel</button>
        <button class="btn btn-secondary" id="btn-export-excel" title="Download Database Siswa Lengkap (.xlsx)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Export Excel</button>
        <button class="btn btn-primary" id="btn-add-siswa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg> Tambah Siswa</button>
      </div>
    </div>
    <div class="card" style="padding:0;">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th style="width:40px; text-align:center;"><input type="checkbox" id="siswa-select-all"></th>
              <th>Nama</th><th>Kelas</th><th>NIS</th><th>No. WA</th><th class="num">SPP Bulan Ini</th><th style="width:130px; text-align:right;">Aksi</th>
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
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            ${renderAvatarHtml(s, 32)}
            <span style="font-weight:600; color:var(--ink);">${escapeHtml(s.nama)}</span>
          </div>
        </td>
        <td><span class="kelas-chip">${escapeHtml(s.kelas)}</span></td>
        <td>${escapeHtml(s.nis||'-')}</td>
        <td>${escapeHtml(s.noHp||'-')}</td>
        <td class="num"><span class="badge ${st}">${st==='lunas'?'Lunas':st==='parsial'?'Sebagian':'Belum'}</span></td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn btn-sm btn-ghost" data-bayar-siswa="${s.id}" title="Input Pembayaran SPP"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:14px;height:14px;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></button>
          <button class="btn btn-sm btn-ghost" data-qr-siswa="${s.id}" title="Kartu QR Siswa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:14px;height:14px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button>
          <button class="btn btn-sm btn-ghost" data-edit-siswa="${s.id}" title="Ubah Siswa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L18 10l-4-4L4 16v4z"/></svg></button>
          <button class="btn btn-sm btn-ghost" data-del-siswa="${s.id}" title="Hapus Siswa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
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

  const searchInputEl = document.getElementById('siswa-search');
  searchInputEl.addEventListener('input', e=>{ store.ui.siswaSearch = e.target.value; store.ui.pageSiswa=1; renderSiswa(); });
  if (wasSearchFocused && searchInputEl) {
    searchInputEl.focus();
    if (selStart !== null) searchInputEl.setSelectionRange(selStart, selEnd);
  }
  document.getElementById('siswa-kelas-filter').addEventListener('change', e=>{ store.ui.siswaKelasFilter = e.target.value; store.ui.pageSiswa=1; renderSiswa(); });
  document.getElementById('btn-add-siswa').addEventListener('click', ()=>openSiswaModal());
  document.getElementById('btn-import').addEventListener('click', ()=>document.getElementById('import-file-input').click());
  tbody.querySelectorAll('[data-bayar-siswa]').forEach(b=>b.addEventListener('click', ()=>{
    store.ui.bayarSiswaId = b.dataset.bayarSiswa;
    store.ui.bayarSelectedMonths = [];
    store.ui.page = 'bayar';
    triggerRender();
  }));
  tbody.querySelectorAll('[data-edit-siswa]').forEach(b=>b.addEventListener('click', ()=>openSiswaModal(b.dataset.editSiswa)));
  
  tbody.querySelectorAll('[data-qr-siswa]').forEach(b=>b.addEventListener('click', async ()=>{
    const s = getSiswaById(b.dataset.qrSiswa);
    if (!s) return;
    const cardHtml = await renderStudentCardHtml(s);
    openModal(`
      <div class="modal-head">
        <div>
          <h3 style="margin:0;">Kartu Identitas Siswa & QR</h3>
          <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">Format kartu standar madrasah (2 Sisi)</div>
        </div>
        <button class="close-x" id="modal-close">&times;</button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:20px 10px; background:var(--paper-dim);">
        <div style="transform:scale(1.02); transform-origin:center top;">
          ${cardHtml}
        </div>
        <button class="btn btn-sm btn-outline" id="btn-modal-flip" style="display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          <span id="btn-modal-flip-text">Balik ke Sisi Belakang (Tata Tertib)</span>
        </button>
      </div>
      <div class="modal-foot">
        <button class="btn" id="modal-cancel">Tutup</button>
        <button class="btn btn-primary" id="btn-print-single-modal">Cetak Kartu (2 Sisi)</button>
      </div>
    `);

    let isBack = false;
    document.getElementById('btn-modal-flip')?.addEventListener('click', () => {
      const cardEl = document.getElementById(`id-card-${s.id}`);
      const textEl = document.getElementById('btn-modal-flip-text');
      if (!cardEl) return;
      isBack = !isBack;
      cardEl.classList.toggle('show-back', isBack);
      if (textEl) {
        textEl.textContent = isBack ? 'Balik ke Sisi Depan (Identitas & QR)' : 'Balik ke Sisi Belakang (Tata Tertib)';
      }
    });

    document.getElementById('btn-print-single-modal')?.addEventListener('click', async () => {
      closeModal();
      const frontCard = await renderStudentCardHtml(s);
      const backCard = await renderStudentCardHtml(s, { side: 'back' });
      const printArea = document.getElementById('kwitansi-print-area');
      if (printArea) {
        printArea.innerHTML = `
          <div class="print-cards-container single">
            <div class="print-card-duo">
              <div class="duo-front">
                <div class="duo-label">TAMPAK DEPAN</div>
                ${frontCard}
              </div>
              <div class="duo-fold-line" title="Garis Lipat Tengah">
                <span>Garis Lipat</span>
              </div>
              <div class="duo-back">
                <div class="duo-label">TAMPAK BELAKANG</div>
                ${backCard}
              </div>
            </div>
          </div>
        `;
        setTimeout(() => window.print(), 100);
      }
    });
  }));
  
  tbody.querySelectorAll('[data-del-siswa]').forEach(b=>b.addEventListener('click', ()=>{
    const id = b.dataset.delSiswa;
    const s = getSiswaById(id);
    if(s) {
      openConfirm(`Hapus data "${s.nama}"? Riwayat pembayarannya juga akan dihapus.`, ()=>{
        deleteSiswa(id);
        selectedSiswaIds.delete(id);
        renderSiswa();
      });
    }
  }));

  // Bulk Actions UI Update
  const btnBulkDelete = document.getElementById('btn-bulk-delete');
  const btnBulkPromote = document.getElementById('btn-bulk-promote');
  const btnBulkPrintQr = document.getElementById('btn-bulk-print-qr');
  const bulkDivider = document.getElementById('bulk-divider');
  
  const updateBulkUI = () => {
    const hasSelection = selectedSiswaIds.size > 0;
    btnBulkDelete.style.display = hasSelection ? 'inline-flex' : 'none';
    btnBulkPromote.style.display = hasSelection ? 'inline-flex' : 'none';
    if (btnBulkPrintQr) btnBulkPrintQr.style.display = hasSelection ? 'inline-flex' : 'none';
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

  // Template & Export Excel
  document.getElementById('btn-download-template')?.addEventListener('click', () => {
    downloadSiswaTemplate();
  });

  document.getElementById('btn-export-excel')?.addEventListener('click', () => {
    exportSiswaExcel();
  });

  btnBulkDelete.addEventListener('click', () => {
    openConfirm(`Hapus ${selectedSiswaIds.size} siswa terpilih secara permanen? Data pembayaran mereka juga akan hilang.`, () => {
      bulkDeleteSiswa(Array.from(selectedSiswaIds));
      selectedSiswaIds.clear();
      renderSiswa();
    });
  });

  btnBulkPrintQr?.addEventListener('click', async () => {
    const selectedList = store.state.siswa.filter(s => selectedSiswaIds.has(s.id));
    if (selectedList.length === 0) return;
    const printArea = document.getElementById('kwitansi-print-area');
    if (!printArea) return;
    toast(`Menyiapkan cetak ${selectedList.length} kartu siswa...`, 'info');
    const cardsHtml = await Promise.all(selectedList.map(s => renderStudentCardHtml(s)));
    printArea.innerHTML = `<div class="print-cards-container sheet">${cardsHtml.map(c => `<div class="print-card-cut-item">${c}</div>`).join('')}</div>`;
    setTimeout(() => window.print(), 150);
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
      
      promoteSiswa(Array.from(selectedSiswaIds), kelasBaru);
      selectedSiswaIds.clear();
      closeModal();
      renderSiswa();
    });
  });
}

function openSiswaModal(id){
  const editing = id ? getSiswaById(id) : null;
  let currentFoto = editing?.foto || '';

  openModal(`
    <div class="modal-head"><h3>${editing?'Edit Siswa':'Tambah Siswa'}</h3><button class="close-x" id="modal-close">&times;</button></div>
    <div class="modal-body">
      <!-- Photo Uploader -->
      <div style="display:flex; align-items:center; gap:16px; background:var(--paper-dim); border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:14px;">
        <div id="f-avatar-preview" style="flex-shrink:0;">
          ${renderAvatarHtml({ nama: editing?.nama || 'Siswa Baru', foto: currentFoto }, 60)}
        </div>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:13.5px; color:var(--ink);">Foto Profil / Pasfoto Siswa</div>
          <div style="font-size:11.5px; color:var(--ink-soft); margin-top:1px;">Format JPG, PNG, atau WebP. Tampil di kartu pelajar digital dan presensi.</div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button type="button" class="btn btn-sm btn-secondary" id="btn-f-upload-photo" style="font-size:12px; padding:5px 10px; display:inline-flex; align-items:center; gap:5px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span>Upload Foto</span>
            </button>
            <button type="button" class="btn btn-sm btn-ghost" id="btn-f-remove-photo" style="font-size:12px; padding:5px 8px; color:#DC2626; ${currentFoto ? '' : 'display:none;'}">
              Hapus
            </button>
            <input type="file" id="f-photo-file" accept="image/*" style="display:none;">
          </div>
        </div>
      </div>

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
      <div class="form-row">
        <div class="form-group">
          <label>NISN (10 Digit)</label>
          <input id="f-nisn" class="monospace" maxlength="10" style="width:100%;" value="${editing?escapeAttr(editing.nisn||''):''}" placeholder="cth. 0081234567">
        </div>
        <div class="form-group">
          <label>NIK (16 Digit)</label>
          <input id="f-nik" class="monospace" maxlength="16" style="width:100%;" value="${editing?escapeAttr(editing.nik||''):''}" placeholder="cth. 320701...">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tempat Lahir</label>
          <input id="f-tempat-lahir" style="width:100%;" value="${editing?escapeAttr(editing.tempatLahir||''):''}" placeholder="cth. Ciamis">
        </div>
        <div class="form-group">
          <label>Tanggal Lahir</label>
          <input id="f-tgl-lahir" type="date" style="width:100%;" value="${editing?escapeAttr(editing.tanggalLahir||''):''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Jenis Kelamin</label>
          <select id="f-jk" style="width:100%;">
            <option value="">-- Pilih --</option>
            <option value="L" ${editing && editing.jenisKelamin==='L'?'selected':''}>Laki-laki</option>
            <option value="P" ${editing && editing.jenisKelamin==='P'?'selected':''}>Perempuan</option>
          </select>
        </div>
        <div class="form-group">
          <label>Nama Orang Tua / Wali</label>
          <input id="f-wali" style="width:100%;" value="${editing?escapeAttr(editing.namaWali||''):''}" placeholder="Nama Ayah/Ibu/Wali">
        </div>
      </div>
      <div class="form-group">
        <label>Alamat Lengkap</label>
        <input id="f-alamat" style="width:100%;" value="${editing?escapeAttr(editing.alamat||''):''}" placeholder="Dusun, RT/RW, Desa, Kecamatan">
      </div>
      <div class="form-group">
        <label>No. HP / WA Orang Tua (opsional)</label>
        <input id="f-nohp" style="width:100%;" value="${editing?escapeAttr(editing.noHp||''):''}" placeholder="cth. 08123456789">
        <div class="helper-text">Digunakan untuk mengirim tagihan dan kwitansi via WhatsApp otomatis.</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Kata Sandi (PIN) Akses Siswa</label>
          <input id="f-pin" style="width:100%;" value="${editing?escapeAttr(editing.pin||''):''}" placeholder="Masukkan PIN atau password">
          <div class="helper-text">Digunakan siswa untuk masuk bersama NIS.</div>
        </div>
        <div class="form-group">
          <label>UID Kartu RFID 125KHz (opsional)</label>
          <input id="f-rfid" class="monospace" style="width:100%;" value="${editing?escapeAttr(editing.rfidUid||''):''}" placeholder="Tap kartu RFID di sini..." autocomplete="off">
          <div class="helper-text">Klik kotak ini lalu tempelkan kartu ke RFID Reader.</div>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="modal-cancel">Batal</button>
      <button class="btn btn-primary" id="modal-save">${editing?'Simpan Perubahan':'Tambah Siswa'}</button>
    </div>
  `);

  // Photo handlers for Bendahara
  const btnUploadPhoto = document.getElementById('btn-f-upload-photo');
  const btnRemovePhoto = document.getElementById('btn-f-remove-photo');
  const inputPhotoFile = document.getElementById('f-photo-file');

  btnUploadPhoto?.addEventListener('click', () => inputPhotoFile?.click());

  inputPhotoFile?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      currentFoto = await compressImageFile(file, 280, 0.82);
      const prev = document.getElementById('f-avatar-preview');
      const inNama = document.getElementById('f-nama');
      if (prev) {
        prev.innerHTML = renderAvatarHtml({ nama: inNama?.value || 'Siswa', foto: currentFoto }, 60);
      }
      if (btnRemovePhoto) btnRemovePhoto.style.display = 'inline-block';
      toast('Foto berhasil dimuat', 'info');
    } catch (err) {
      toast(err.message || 'Gagal memproses gambar foto', 'error');
    }
  });

  btnRemovePhoto?.addEventListener('click', () => {
    currentFoto = '';
    const prev = document.getElementById('f-avatar-preview');
    const inNama = document.getElementById('f-nama');
    if (prev) prev.innerHTML = renderAvatarHtml({ nama: inNama?.value || 'Siswa', foto: '' }, 60);
    if (btnRemovePhoto) btnRemovePhoto.style.display = 'none';
    if (inputPhotoFile) inputPhotoFile.value = '';
    toast('Foto dihapus', 'info');
  });

  document.getElementById('f-rfid')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      toast('UID Kartu RFID terbaca: ' + e.target.value.trim(), 'info');
    }
  });
  document.getElementById('modal-save').addEventListener('click', ()=>{
    const inNama = document.getElementById('f-nama');
    const inKelas = document.getElementById('f-kelas');
    const inNis = document.getElementById('f-nis');
    const inRfid = document.getElementById('f-rfid');
    const nama = inNama.value.trim();
    const kelas = inKelas.value.trim();
    const nis = inNis.value.trim();
    const nisn = document.getElementById('f-nisn')?.value.trim() || '';
    const nik = document.getElementById('f-nik')?.value.trim() || '';
    const tempatLahir = document.getElementById('f-tempat-lahir')?.value.trim() || '';
    const tanggalLahir = document.getElementById('f-tgl-lahir')?.value || '';
    const jenisKelamin = document.getElementById('f-jk')?.value || '';
    const namaWali = document.getElementById('f-wali')?.value.trim() || '';
    const alamat = document.getElementById('f-alamat')?.value.trim() || '';
    const noHp = document.getElementById('f-nohp').value.trim();
    const pin = document.getElementById('f-pin').value.trim();
    const rfidUid = inRfid ? inRfid.value.trim() : '';
    
    // Clear previous errors
    [inNama, inKelas, inNis, inRfid].filter(Boolean).forEach(el => el.classList.remove('error'));
    
    const validation = validateSiswa(nama, kelas, nis, editing ? editing.id : null, rfidUid);
    if (!validation.valid) {
      if(validation.error.includes('Nama')) { inNama.classList.add('error'); inKelas.classList.add('error'); }
      if(validation.error.includes('NIS')) inNis.classList.add('error');
      if(validation.error.includes('RFID') && inRfid) inRfid.classList.add('error');
      toast(validation.error, 'warning');
      return;
    }

    const payload = { nama, kelas, nis, nisn, nik, tempatLahir, tanggalLahir, jenisKelamin, namaWali, alamat, noHp, pin, rfidUid, foto: currentFoto };

    if(editing){
      updateSiswa(editing.id, payload);
    } else {
      addSiswa(payload);
    }
    closeModal(); renderSiswa();
  });
}

export function initSiswaEvents() {
  document.getElementById('import-file-input').addEventListener('change', function(e){
    const file = e.target.files[0];
    handleImportExcel(file, () => {
      renderSiswa();
      e.target.value = '';
    });
  });
}
