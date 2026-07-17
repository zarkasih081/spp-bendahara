import { store, defaultState, saveData, hashPassword } from '../state/store.js';
import { triggerRender } from '../utils/events.js';
import { escapeAttr, BULAN, toast, downloadFile } from '../utils/helpers.js';
import { openConfirm } from '../components/Modal.js';

export function renderPengaturan(){
  const el = document.getElementById('page-pengaturan');
  const s = store.state.settings;
  el.innerHTML = `
    <div class="card" style="max-width:560px;">
      <h3>Identitas Sekolah</h3>
      <div class="card-sub">Digunakan pada kwitansi dan laporan</div>
      <div class="form-group"><label>Nama Sekolah</label><input id="set-nama" style="width:100%;" value="${escapeAttr(s.namaSekolah)}"></div>
      <div class="form-row">
        <div class="form-group"><label>Nama Bendahara</label><input id="set-bendahara" style="width:100%;" value="${escapeAttr(s.bendahara)}" placeholder="Tercetak di kwitansi"></div>
        <div class="form-group"><label>Tahun Ajaran</label><input id="set-ta" style="width:100%;" value="${escapeAttr(s.tahunAjaran)}" placeholder="cth. 2025/2026"></div>
      </div>
      <div class="form-group" style="margin-top: 14px;">
        <label>Kata Sandi (PIN) Bendahara Baru</label>
        <input id="set-admin-pass" type="password" style="width:100%;" placeholder="Kosongkan jika tidak diubah">
        <div class="helper-text">Digunakan untuk login sebagai Bendahara.</div>
      </div>
    </div>
    <div class="card" style="max-width:560px;">
      <h3>Nominal & Periode</h3>
      <div class="card-sub">Nominal SPP dan Ijazah berlaku sama untuk semua siswa</div>
      <div class="form-row">
        <div class="form-group"><label>Nominal SPP per Bulan (Rp)</label><input id="set-nominal" type="number" style="width:100%;" value="${s.nominalSPP}"></div>
        <div class="form-group"><label>Nominal Ijazah (Rp)</label><input id="set-nominal-ijazah" type="number" style="width:100%;" value="${s.nominalIjazah || 500000}"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Bulan Awal Tahun Ajaran</label>
          <select id="set-bulan-mulai" style="width:100%;">${BULAN.map((b,i)=>`<option value="${i+1}" ${s.bulanMulai===i+1?'selected':''}>${b}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Tahun Awal</label><input id="set-tahun-mulai" type="number" style="width:100%;" value="${s.tahunMulai}"></div>
      </div>
      <div class="helper-text">Periode ini menentukan 12 bulan yang dihitung sebagai satu tahun ajaran untuk perhitungan tunggakan.</div>
    </div>
    <button class="btn btn-primary" id="btn-save-settings">Simpan Pengaturan</button>

    <div class="divider"></div>
    <div class="card" style="max-width:560px;">
      <h3>Backup & Restore Data</h3>
      <div class="card-sub">Simpan seluruh data (Siswa, Riwayat, Pengaturan) sebagai JSON atau pulihkan dari file.</div>
      <div style="display:flex; gap:10px; margin-top:14px;">
        <button class="btn btn-primary" id="btn-backup-data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg> Download Backup</button>
        <button class="btn" id="btn-restore-data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21V9m0 0l-4 4m4-4l4 4M4 5h16"/></svg> Restore Backup</button>
        <input type="file" id="restore-file-input" accept=".json" style="display:none">
      </div>
    </div>

    <div class="divider"></div>
    <div class="card" style="max-width:560px; border-color: var(--rust-soft);">
      <h3 style="color:var(--rust);">Zona Berbahaya</h3>
      <div class="card-sub">Tindakan berikut tidak bisa dibatalkan</div>
      <button class="btn btn-danger" id="btn-reset-data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg> Hapus Semua Data</button>
    </div>
  `;
  document.getElementById('btn-save-settings').addEventListener('click', async ()=>{
    s.namaSekolah = document.getElementById('set-nama').value.trim() || s.namaSekolah;
    s.bendahara = document.getElementById('set-bendahara').value.trim();
    s.tahunAjaran = document.getElementById('set-ta').value.trim() || s.tahunAjaran;
    
    const newPass = document.getElementById('set-admin-pass').value.trim();
    if(newPass) {
      s.adminPassword = await hashPassword(newPass);
    }
    s.nominalSPP = parseInt(document.getElementById('set-nominal').value || '0',10) || s.nominalSPP;
    s.nominalIjazah = parseInt(document.getElementById('set-nominal-ijazah').value || '0',10) || s.nominalIjazah;
    s.bulanMulai = +document.getElementById('set-bulan-mulai').value;
    s.tahunMulai = parseInt(document.getElementById('set-tahun-mulai').value,10) || s.tahunMulai;
    saveData('Pengaturan disimpan');
  });
  document.getElementById('btn-reset-data').addEventListener('click', ()=>{
    openConfirm('Hapus SEMUA data siswa dan pembayaran? Tindakan ini tidak bisa dibatalkan.', ()=>{
      store.state = defaultState();
      store.isDataCorrupt = false;
      saveData('Semua data telah dihapus');
      triggerRender();
    });
  });

  document.getElementById('btn-backup-data').addEventListener('click', ()=>{
    const dataStr = JSON.stringify(store.state, null, 2);
    downloadFile(`backup-spp-bendahara-${new Date().toISOString().slice(0,10)}.json`, dataStr, 'application/json');
  });
  
  const restoreInput = document.getElementById('restore-file-input');
  document.getElementById('btn-restore-data').addEventListener('click', ()=>restoreInput.click());
  restoreInput.addEventListener('change', function(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt){
      try {
        const parsed = JSON.parse(evt.target.result);
        if(parsed && typeof parsed.settings === 'object' && Array.isArray(parsed.siswa) && Array.isArray(parsed.pembayaran)) {
           const d = defaultState();
           parsed.settings = Object.assign({}, d.settings, parsed.settings);
           store.state = parsed;
           store.isDataCorrupt = false;
           saveData('Data berhasil dipulihkan dari backup');
           triggerRender();
        } else {
           toast('Format file backup tidak valid.', 'error');
        }
      } catch(err) {
        toast('Gagal membaca file JSON.', 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });
}
