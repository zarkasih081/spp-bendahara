import { store } from '../../app/state.js';
import { defaultState, saveData } from '../../data/database.js';
import { hashPassword } from '../../data/authStorage.js';
import { triggerRender } from '../../utils/events.js';
import { BULAN, toast, downloadFile } from '../../utils/helpers.js';
import { escapeAttr } from '../../utils/formatters.js';
import { openConfirm } from '../../components/Modal.js';

export function renderPengaturan(){
  const el = document.getElementById('page-pengaturan');
  const s = store.state.settings;

  // Calculate storage usage
  let totalBytes = 0;
  try {
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        totalBytes += (localStorage[key].length + key.length) * 2;
      }
    }
  } catch (e) {
    totalBytes = 0;
  }
  const totalKb = (totalBytes / 1024).toFixed(1);
  const maxKb = 5120; // Standard ~5 MB browser quota
  const percentUsed = Math.min(100, Math.max(1, Math.round((totalBytes / (maxKb * 1024)) * 100)));
  const fotoCount = (store.state.siswa || []).filter(item => !!item.foto).length;
  const siswaCount = (store.state.siswa || []).length;
  const bayarCount = (store.state.pembayaran || []).length;
  const absensiCount = (store.state.absensi || []).length;

  el.innerHTML = `
    <div class="card" style="max-width:560px;">
      <h3>Identitas Sekolah & Pimpinan</h3>
      <div class="card-sub">Digunakan pada kwitansi resmi, kartu pelajar digital, dan laporan kas</div>
      <div class="form-group"><label>Nama Sekolah / Madrasah</label><input id="set-nama" style="width:100%;" value="${escapeAttr(s.namaSekolah)}"></div>
      <div class="form-group"><label>Alamat Sekolah</label><input id="set-alamat" style="width:100%;" value="${escapeAttr(s.alamatSekolah || '')}" placeholder="cth. Jl. Raya Bunter, Sukadana, Ciamis"></div>
      <div class="form-row">
        <div class="form-group"><label>Kepala Madrasah</label><input id="set-kepala" style="width:100%;" value="${escapeAttr(s.kepalaMadrasah || '')}" placeholder="Nama & Gelar Kepala Madrasah"></div>
        <div class="form-group"><label>NIP / NUPTK</label><input id="set-nip-kepala" class="monospace" style="width:100%;" value="${escapeAttr(s.nipKepalaMadrasah || '')}" placeholder="NIP / strip (-)"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Nama Bendahara</label><input id="set-bendahara" style="width:100%;" value="${escapeAttr(s.bendahara)}" placeholder="Tercetak di kwitansi"></div>
        <div class="form-group"><label>Tahun Ajaran</label><input id="set-ta" style="width:100%;" value="${escapeAttr(s.tahunAjaran)}" placeholder="cth. 2025/2026"></div>
      </div>
      <div class="form-group">
        <label>No. WhatsApp Bendahara (opsional)</label>
        <input id="set-nohp-bendahara" style="width:100%;" value="${escapeAttr(s.noHpBendahara || '')}" placeholder="cth. 081234567890">
        <div class="helper-text">Digunakan untuk tombol konsultasi & konfirmasi WhatsApp pada portal siswa.</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nama Bank Sekolah</label>
          <input id="set-bank-nama" style="width:100%;" value="${escapeAttr(s.namaBank || 'Bank BRI / BSI')}" placeholder="cth. Bank BRI / BSI / Mandiri">
        </div>
        <div class="form-group">
          <label>No. Rekening Resmi</label>
          <input id="set-bank-rek" class="monospace" style="width:100%;" value="${escapeAttr(s.noRekening || '0123-01-000000-50-0')}" placeholder="cth. 0123-01-000000-50-0">
        </div>
      </div>
      <div class="form-group">
        <label>Atas Nama Rekening</label>
        <input id="set-bank-an" style="width:100%;" value="${escapeAttr(s.atasNamaRekening || 'Bendahara Madrasah')}" placeholder="cth. MTs Yasta Bunter / Bendahara SPP">
        <div class="helper-text">Ditampilkan di portal akun siswa sebagai panduan transfer pembayaran resmi.</div>
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
    </div>
    <div class="card" style="max-width:560px;">
      <h3>Jadwal Absensi & Scanner QR</h3>
      <div class="card-sub">Waktu batas keterlambatan dan suara scanner kartu QR</div>
      <div class="form-row">
        <div class="form-group">
          <label>Jam Batas Masuk (Tepat Waktu)</label>
          <input id="set-jam-masuk" type="time" style="width:100%;" value="${s.jamMasuk || '07:15'}">
          <div class="helper-text">Scan setelah jam ini akan otomatis berstatus "Terlambat".</div>
        </div>
        <div class="form-group">
          <label>Jam Pulang Sekolah</label>
          <input id="set-jam-pulang" type="time" style="width:100%;" value="${s.jamPulang || '14:00'}">
          <div class="helper-text">Waktu standar kepulangan siswa.</div>
        </div>
      </div>
      <div class="form-group" style="margin-top:10px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="set-beep-audio" ${s.beepAudio !== false ? 'checked' : ''}>
          <span>Aktifkan Suara Beep / Chime saat Scan Kartu Berhasil</span>
        </label>
      </div>
    </div>
    <button class="btn btn-primary" id="btn-save-settings">Simpan Pengaturan</button>

    <div class="divider"></div>
    <div class="card" style="max-width:560px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <h3 style="margin:0;">Status Kapasitas Penyimpanan (LocalStorage)</h3>
          <div class="card-sub" style="margin-top:2px;">Kapasitas penyimpanan offline data aplikasi di browser</div>
        </div>
        <span class="badge ${percentUsed > 80 ? 'menunggak' : (percentUsed > 50 ? 'parsial' : 'lunas')}">
          ${percentUsed < 70 ? 'Kapasitas Aman' : (percentUsed < 85 ? 'Perhatian' : 'Hampir Penuh')}
        </span>
      </div>

      <div style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
          <span style="font-weight:600; color:var(--ink);">Pemakaian Kuota Browser:</span>
          <span class="monospace" style="font-weight:700;">${totalKb} KB / ~${maxKb} KB (${percentUsed}%)</span>
        </div>
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; height:10px; overflow:hidden;">
          <div style="background:${percentUsed > 80 ? '#EF4444' : (percentUsed > 50 ? '#F59E0B' : '#10B981')}; height:100%; width:${percentUsed}%; transition:width 0.4s ease;"></div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:10px; margin-top:14px;">
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:18px; font-weight:800; color:var(--primary);">${siswaCount}</div>
          <div style="font-size:11px; color:var(--ink-soft);">Total Siswa</div>
        </div>
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:18px; font-weight:800; color:#10B981;">${bayarCount}</div>
          <div style="font-size:11px; color:var(--ink-soft);">Transaksi Kas</div>
        </div>
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:18px; font-weight:800; color:#6366F1;">${absensiCount}</div>
          <div style="font-size:11px; color:var(--ink-soft);">Log Presensi</div>
        </div>
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:18px; font-weight:800; color:#F59E0B;">${fotoCount}</div>
          <div style="font-size:11px; color:var(--ink-soft);">Foto Profil</div>
        </div>
      </div>

      <div class="helper-text" style="margin-top:12px;">
        Semua foto profil dikompresi otomatis (max ~25 KB/foto) agar tetap ringan dan hemat kuota browser. Lakukan backup berkala setiap akhir bulan.
      </div>
    </div>

    <div class="divider"></div>
    <div class="card" style="max-width:560px;">
      <h3>Backup & Restore Data</h3>
      <div class="card-sub">Simpan seluruh data (Siswa, Riwayat, Presensi, Pengaturan) sebagai JSON atau pulihkan dari file.</div>
      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn btn-primary" id="btn-backup-data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg> Download Backup (JSON)</button>
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
    s.alamatSekolah = document.getElementById('set-alamat')?.value.trim() || s.alamatSekolah || '';
    s.kepalaMadrasah = document.getElementById('set-kepala')?.value.trim() || s.kepalaMadrasah || '';
    s.nipKepalaMadrasah = document.getElementById('set-nip-kepala')?.value.trim() || s.nipKepalaMadrasah || '';
    s.bendahara = document.getElementById('set-bendahara').value.trim();
    s.noHpBendahara = document.getElementById('set-nohp-bendahara').value.trim();
    s.namaBank = document.getElementById('set-bank-nama')?.value.trim() || s.namaBank || 'Bank BRI / BSI';
    s.noRekening = document.getElementById('set-bank-rek')?.value.trim() || s.noRekening || '';
    s.atasNamaRekening = document.getElementById('set-bank-an')?.value.trim() || s.atasNamaRekening || '';
    s.tahunAjaran = document.getElementById('set-ta').value.trim() || s.tahunAjaran;
    
    const newPass = document.getElementById('set-admin-pass').value.trim();
    if(newPass) {
      s.adminPassword = await hashPassword(newPass);
    }
    s.nominalSPP = parseInt(document.getElementById('set-nominal').value || '0',10) || s.nominalSPP;
    s.nominalIjazah = parseInt(document.getElementById('set-nominal-ijazah').value || '0',10) || s.nominalIjazah;
    s.bulanMulai = +document.getElementById('set-bulan-mulai').value;
    s.tahunMulai = parseInt(document.getElementById('set-tahun-mulai').value,10) || s.tahunMulai;
    store.ui.activeTahunMulai = s.tahunMulai;
    s.jamMasuk = document.getElementById('set-jam-masuk').value || s.jamMasuk || '07:15';
    s.jamPulang = document.getElementById('set-jam-pulang').value || s.jamPulang || '14:00';
    s.beepAudio = document.getElementById('set-beep-audio').checked;
    saveData('Pengaturan disimpan');
    triggerRender();
  });
  document.getElementById('btn-reset-data').addEventListener('click', ()=>{
    openConfirm('Hapus SEMUA data siswa dan pembayaran? Tindakan ini tidak bisa dibatalkan.', ()=>{
      store.state = defaultState();
      store.ui.activeTahunMulai = store.state.settings.tahunMulai;
      store.ui.bayarSiswaId = null;
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
           if (!Array.isArray(parsed.absensi)) parsed.absensi = [];
           parsed.siswa.forEach(s => {
             if (!s.noHp && s.telepon) { s.noHp = s.telepon; delete s.telepon; }
           });
           store.state = parsed;
           store.ui.activeTahunMulai = parsed.settings.tahunMulai;
           store.ui.bayarSiswaId = null;
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
