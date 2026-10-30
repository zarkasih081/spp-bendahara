import { store } from '../../app/state.js';
import { defaultState, saveData } from '../../data/database.js';
import { hashPassword } from '../../data/authStorage.js';
import { triggerRender } from '../../utils/events.js';
import { BULAN, toast, downloadFile, getSchoolLogo } from '../../utils/helpers.js';
import { escapeHtml, escapeAttr, fmtRupiah } from '../../utils/formatters.js';
import { openConfirm, openModal, closeModal } from '../../components/Modal.js';
import { LOGO_BASE64 } from '../../utils/constants.js';
import { compressImageFile } from '../../utils/imageHelper.js';

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
  const pengeluaranCount = (store.state.pengeluaran || []).length;

  const posTagihanList = store.state.posTagihan || [];
  const lockedYears = s.tahunAjaranTerkunci || [];
  const currentTaMulai = s.tahunMulai || new Date().getFullYear();
  const availableYears = [currentTaMulai - 2, currentTaMulai - 1, currentTaMulai, currentTaMulai + 1];
  let currentLogo = s.logoSekolah || '';

  el.innerHTML = `
    <div class="card" style="max-width:580px;">
      <h3>Identitas Sekolah & Pimpinan</h3>
      <div class="card-sub">Digunakan pada kwitansi resmi, kartu pelajar digital, dan laporan kas</div>
      
      <!-- Logo Sekolah Uploader -->
      <div class="setting-logo-box">
        <div class="setting-logo-preview-wrap">
          <img id="set-logo-preview" src="${currentLogo || LOGO_BASE64}" alt="Logo Sekolah">
        </div>
        <div class="setting-logo-info">
          <div class="setting-logo-title">Logo Resmi Sekolah / Madrasah</div>
          <div class="setting-logo-sub">Tampil di Kuitansi, Kartu Pelajar Digital, BKK, dan Dokumen Resmi. Format disarankan: PNG transparan atau JPG.</div>
          <div class="setting-logo-actions">
            <button type="button" class="btn btn-sm btn-secondary" id="btn-upload-logo" style="font-size:12px; padding:6px 12px; display:inline-flex; align-items:center; gap:5px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              <span>Ganti Logo Sekolah</span>
            </button>
            <button type="button" class="btn btn-sm btn-ghost" id="btn-reset-logo" style="font-size:12px; padding:6px 10px; color:var(--rust); ${currentLogo ? '' : 'display:none;'}">
              Gunakan Logo Default
            </button>
            <input type="file" id="input-logo-file" accept="image/*" style="display:none;">
          </div>
        </div>
      </div>

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

    <!-- Pos Tagihan Sekolah Lainnya (Non-SPP) -->
    <div class="card" style="max-width:580px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
        <div>
          <h3 style="margin:0;">Pengaturan Pos Tagihan Sekolah (Non-SPP)</h3>
          <div class="card-sub" style="margin-top:2px;">Uang gedung, seragam, ujian, dan administrasi tambahan</div>
        </div>
        <button type="button" class="btn btn-sm btn-primary" id="btn-tambah-pos-tagihan" style="display:inline-flex; align-items:center; gap:5px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Tambah Pos Tagihan
        </button>
      </div>

      <div style="border:1px solid var(--line); border-radius:10px; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
          <thead>
            <tr style="background:var(--paper-dim); border-bottom:1px solid var(--line);">
              <th style="padding:8px 12px; text-align:left;">Nama Pos Tagihan</th>
              <th style="padding:8px 12px; text-align:right;">Ketetapan (Rp)</th>
              <th style="padding:8px 12px; text-align:center; width:70px;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${posTagihanList.length === 0 ? '<tr><td colspan="3" style="padding:16px; text-align:center; color:var(--ink-soft);">Belum ada pos tagihan khusus.</td></tr>' : posTagihanList.map(pos => `
              <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:8px 12px;">
                  <strong>${escapeHtml(pos.nama)}</strong>
                  <div style="font-size:11px; color:var(--ink-soft);">${pos.tipe === 'sekali' ? 'Sekali Bayar' : 'Per Semester'}</div>
                </td>
                <td style="padding:8px 12px; text-align:right; font-family:monospace; font-weight:700; color:var(--primary);">
                  ${fmtRupiah(pos.nominal)}
                </td>
                <td style="padding:8px 12px; text-align:center;">
                  <button type="button" class="btn btn-sm btn-ghost btn-del-pos" data-pos-id="${pos.id}" title="Hapus Pos Tagihan" style="color:var(--rust); padding:3px 6px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Kunci & Arsip Tahun Ajaran Lampau -->
    <div class="card" style="max-width:580px;">
      <div style="margin-bottom:12px;">
        <h3 style="margin:0;">Kunci & Arsip Tahun Ajaran Lampau</h3>
        <div class="card-sub" style="margin-top:2px;">Kunci tahun ajaran lampau agar tidak dapat ditambah atau diubah secara tidak sengaja (Read-Only)</div>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        ${availableYears.map(yr => {
          const isLocked = lockedYears.includes(yr);
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--paper-dim); border:1px solid var(--line); border-radius:10px; padding:10px 14px;">
              <div>
                <strong style="font-size:14px;">Tahun Ajaran ${yr}/${yr+1}</strong>
                <div style="font-size:11.5px; color:${isLocked ? '#DC2626' : '#059669'}; font-weight:600; margin-top:2px;">
                  ${isLocked ? 'Terkunci (Arsip Resmi / Read-Only)' : 'Aktif (Transaksi Dibuka)'}
                </div>
              </div>
              <button type="button" class="btn btn-sm ${isLocked ? 'btn-outline' : 'btn-secondary'} btn-toggle-lock-ta" data-year="${yr}" style="display:inline-flex; align-items:center; gap:6px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>${isLocked ? 'Buka Kunci' : 'Kunci Tahun Ini'}</span>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="card" style="max-width:580px;">
      <h3>Nominal SPP & Periode Standar</h3>
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

    <div class="card" style="max-width:580px;">
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
    <div class="card" style="max-width:580px;">
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

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(100px, 1fr)); gap:10px; margin-top:14px;">
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:18px; font-weight:800; color:var(--primary);">${siswaCount}</div>
          <div style="font-size:11px; color:var(--ink-soft);">Total Siswa</div>
        </div>
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:18px; font-weight:800; color:#10B981;">${bayarCount}</div>
          <div style="font-size:11px; color:var(--ink-soft);">Transaksi Kas</div>
        </div>
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:18px; font-weight:800; color:#DC2626;">${pengeluaranCount}</div>
          <div style="font-size:11px; color:var(--ink-soft);">Kas Keluar (BKK)</div>
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
        Semua data transaksi dan foto profil dikompresi otomatis agar ringan dan hemat kuota browser. Lakukan backup berkala setiap akhir bulan.
      </div>
    </div>

    <div class="divider"></div>
    <div class="card" style="max-width:580px;">
      <h3>Backup & Restore Data</h3>
      <div class="card-sub">Simpan seluruh data (Siswa, Riwayat, Presensi, Pengeluaran, Pengaturan) sebagai JSON atau pulihkan dari file.</div>
      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn btn-primary" id="btn-backup-data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg> Download Backup (JSON)</button>
        <button class="btn" id="btn-restore-data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21V9m0 0l-4 4m4-4l4 4M4 5h16"/></svg> Restore Backup</button>
        <input type="file" id="restore-file-input" accept=".json" style="display:none">
      </div>
    </div>

    <div class="divider"></div>
    <div class="card" style="max-width:580px; border-color: var(--rust-soft);">
      <h3 style="color:var(--rust);">Zona Berbahaya</h3>
      <div class="card-sub">Tindakan berikut tidak bisa dibatalkan</div>
      <button class="btn btn-danger" id="btn-reset-data"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg> Hapus Semua Data</button>
    </div>
  `;

  // Toggle Lock Year listeners
  el.querySelectorAll('.btn-toggle-lock-ta').forEach(btn => {
    btn.addEventListener('click', () => {
      const yr = parseInt(btn.dataset.year, 10);
      if (!s.tahunAjaranTerkunci) s.tahunAjaranTerkunci = [];
      const idx = s.tahunAjaranTerkunci.indexOf(yr);
      if (idx !== -1) {
        s.tahunAjaranTerkunci.splice(idx, 1);
        toast(`Kunci Tahun Ajaran ${yr}/${yr+1} dibuka`, 'info');
      } else {
        s.tahunAjaranTerkunci.push(yr);
        toast(`Tahun Ajaran ${yr}/${yr+1} berhasil dikunci (Arsip Resmi)`, 'success');
      }
      saveData();
      renderPengaturan();
    });
  });

  // Pos Tagihan delete listeners
  el.querySelectorAll('.btn-del-pos').forEach(btn => {
    btn.addEventListener('click', () => {
      const posId = btn.dataset.posId;
      openConfirm('Hapus pos tagihan ini?', () => {
        store.state.posTagihan = (store.state.posTagihan || []).filter(x => x.id !== posId);
        saveData('Pos tagihan berhasil dihapus');
        renderPengaturan();
      });
    });
  });

  // Pos Tagihan add button
  document.getElementById('btn-tambah-pos-tagihan')?.addEventListener('click', () => {
    openModal(`
      <div class="modal-head">
        <h3>Tambah Pos Tagihan Sekolah</h3>
        <button class="close-x" id="modal-close">&times;</button>
      </div>
      <div class="modal-body" style="padding:16px;">
        <div class="form-group">
          <label>Nama Pos Tagihan</label>
          <input type="text" id="pos-input-nama" placeholder="cth. Uang Gedung / Infaq Pembangunan" style="width:100%;">
        </div>
        <div class="form-group">
          <label>Nominal Ketetapan (Rp)</label>
          <input type="number" id="pos-input-nominal" placeholder="cth. 500000" style="width:100%; font-family:monospace; font-weight:700;">
        </div>
        <div class="form-group">
          <label>Tipe Tagihan</label>
          <select id="pos-input-tipe" style="width:100%;">
            <option value="sekali">Sekali Bayar (Selama Menjadi Siswa)</option>
            <option value="semester">Per Semester / Tahunan</option>
          </select>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" id="modal-cancel">Batal</button>
        <button class="btn btn-primary" id="btn-save-new-pos">Simpan Pos Tagihan</button>
      </div>
    `);

    document.getElementById('btn-save-new-pos')?.addEventListener('click', () => {
      const nama = document.getElementById('pos-input-nama')?.value.trim();
      const nominal = parseInt(document.getElementById('pos-input-nominal')?.value || '0', 10);
      const tipe = document.getElementById('pos-input-tipe')?.value;

      if (!nama) { toast('Nama pos tagihan wajib diisi', 'warning'); return; }
      if (!nominal || nominal <= 0) { toast('Nominal tagihan wajib diisi', 'warning'); return; }

      if (!store.state.posTagihan) store.state.posTagihan = [];
      const id = 'pos-' + Date.now();
      store.state.posTagihan.push({ id, nama, nominal, tipe });
      saveData('Pos tagihan berhasil ditambahkan');
      closeModal();
      renderPengaturan();
    });
  });

  // School Logo upload & reset listeners
  const inputLogoFile = document.getElementById('input-logo-file');
  document.getElementById('btn-upload-logo')?.addEventListener('click', () => inputLogoFile?.click());
  inputLogoFile?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      currentLogo = await compressImageFile(file, 280, 0.86);
      const imgPrev = document.getElementById('set-logo-preview');
      if (imgPrev) imgPrev.src = currentLogo;
      const btnReset = document.getElementById('btn-reset-logo');
      if (btnReset) btnReset.style.display = 'inline-block';
      toast('Logo sekolah berhasil dimuat (klik Simpan Pengaturan)', 'info');
    } catch (err) {
      toast(err.message || 'Gagal memproses gambar logo', 'error');
    }
  });

  document.getElementById('btn-reset-logo')?.addEventListener('click', () => {
    currentLogo = '';
    const imgPrev = document.getElementById('set-logo-preview');
    if (imgPrev) imgPrev.src = LOGO_BASE64;
    const btnReset = document.getElementById('btn-reset-logo');
    if (btnReset) btnReset.style.display = 'none';
    if (inputLogoFile) inputLogoFile.value = '';
    toast('Logo direset ke bawaan resmi', 'info');
  });

  document.getElementById('btn-save-settings').addEventListener('click', async ()=>{
    s.logoSekolah = currentLogo;
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
    openConfirm('Hapus SEMUA data siswa, pembayaran, dan pengeluaran? Tindakan ini tidak bisa dibatalkan.', ()=>{
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
           if (!Array.isArray(parsed.pengeluaran)) parsed.pengeluaran = [];
           if (!Array.isArray(parsed.posTagihan)) parsed.posTagihan = d.posTagihan;
           if (!Array.isArray(parsed.settings.tahunAjaranTerkunci)) parsed.settings.tahunAjaranTerkunci = [];
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
