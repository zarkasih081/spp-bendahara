import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { currentPeriodeEntry, siswaStatusBulan, siswaTunggakan, BULAN, emptyState, getPeriode, getActiveTahunMulai, siswaTotalBulan, toast } from '../../utils/helpers.js';
import { fmtRupiah, escapeHtml, escapeAttr, formatWaLink } from '../../utils/formatters.js';
import { triggerRender } from '../../utils/events.js';
import { getTodayDateStr, formatTimeDisplay, getStatistikAbsensi } from '../absensi/absensiService.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { renderStudentCardHtml, downloadStudentQrCardPng, downloadStudentCardBackPng } from '../absensi/qrCardGenerator.js';
import { cetakSuratBebasAdministrasi } from '../pembayaran/cetakDokumenSiswa.js';
import { renderAvatarHtml, compressImageFile } from '../../utils/imageHelper.js';

export function openStudentProfileModal(s) {
  if (!s) return;
  let currentFoto = s.foto || '';

  openModal(`
    <div class="modal-head">
      <div>
        <h3 style="margin:0;">Lengkapi Profil & Biodata Siswa</h3>
        <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">Data ini digunakan untuk pencetakan kartu pelajar, rapor, & administrasi sekolah.</div>
      </div>
      <button class="close-x" id="modal-close">&times;</button>
    </div>
    <div class="modal-body" style="max-height:72vh; overflow-y:auto; padding-right:6px;">
      <!-- Identitas Utama Readonly -->
      <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div id="st-prof-avatar-preview" style="flex-shrink:0;">
            ${renderAvatarHtml({ ...s, foto: currentFoto }, 46)}
          </div>
          <div>
            <div style="font-size:15px; font-weight:700; color:var(--ink);">${escapeHtml(s.nama)}</div>
            <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">
              NIS: <strong class="monospace" style="color:var(--primary);">${escapeHtml(s.nis || '-')}</strong> • Kelas: <strong>${escapeHtml(s.kelas)}</strong>
            </div>
          </div>
        </div>
        <div>
          <span class="badge ${s.rfidUid ? 'lunas' : ''}" style="font-size:11px; display:inline-flex; align-items:center; gap:5px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 9h6M14 12h4M14 15h6"/></svg>
            ${s.rfidUid ? `RFID: ${escapeHtml(s.rfidUid)}` : 'Kartu RFID Belum Terdaftar'}
          </span>
        </div>
      </div>

      <!-- Tab Navigasi Form Profil -->
      <div class="tabs" style="margin-bottom:14px; padding:3px;">
        <button type="button" class="tab-btn active" id="tab-btn-bio" style="font-size:12.5px; padding:6px 12px; display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v2"/></svg>
          <span>Data Diri & Foto</span>
        </button>
        <button type="button" class="tab-btn" id="tab-btn-wali" style="font-size:12.5px; padding:6px 12px; display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Orang Tua & Alamat</span>
        </button>
        <button type="button" class="tab-btn" id="tab-btn-sec" style="font-size:12.5px; padding:6px 12px; display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Keamanan (PIN)</span>
        </button>
      </div>

      <!-- Section 1: Data Diri Siswa -->
      <div id="section-bio" class="st-prof-section">
        <!-- Photo Uploader Box -->
        <div style="display:flex; align-items:center; gap:16px; background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:16px;">
          <div id="st-prof-avatar-large" style="flex-shrink:0;">
            ${renderAvatarHtml({ ...s, foto: currentFoto }, 64)}
          </div>
          <div style="flex:1;">
            <div style="font-weight:700; font-size:13.5px; color:var(--ink);">Foto Profil Siswa</div>
            <div style="font-size:11.5px; color:var(--ink-soft); margin-top:1px;">Format JPG, PNG, atau WebP. Foto akan tampil di kartu pelajar digital dan presensi.</div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button type="button" class="btn btn-sm btn-secondary" id="btn-upload-st-photo" style="font-size:12px; padding:5px 10px; display:inline-flex; align-items:center; gap:5px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>Upload Foto</span>
              </button>
              <button type="button" class="btn btn-sm btn-ghost" id="btn-remove-st-photo" style="font-size:12px; padding:5px 8px; color:#DC2626; ${currentFoto ? '' : 'display:none;'}">
                Hapus
              </button>
              <input type="file" id="input-st-photo-file" accept="image/*" style="display:none;">
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>NISN (10 Digit Angka)</label>
            <input type="text" id="st-prof-nisn" class="monospace" maxlength="10" value="${escapeAttr(s.nisn || '')}" placeholder="Contoh: 0081234567" style="width:100%;">
            <div class="helper-text">Nomor Induk Siswa Nasional dari Kemdikbud/Kemenag.</div>
          </div>
          <div class="form-group">
            <label>NIK Siswa (16 Digit)</label>
            <input type="text" id="st-prof-nik" class="monospace" maxlength="16" value="${escapeAttr(s.nik || '')}" placeholder="Contoh: 320701..." style="width:100%;">
            <div class="helper-text">Nomor Induk Kependudukan sesuai Kartu Keluarga (KK).</div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Tempat Lahir</label>
            <input type="text" id="st-prof-tempat-lahir" value="${escapeAttr(s.tempatLahir || '')}" placeholder="Contoh: Ciamis" style="width:100%;">
          </div>
          <div class="form-group">
            <label>Tanggal Lahir</label>
            <input type="date" id="st-prof-tgl-lahir" value="${escapeAttr(s.tanggalLahir || '')}" style="width:100%;">
          </div>
        </div>

        <div class="form-group">
          <label>Jenis Kelamin</label>
          <select id="st-prof-jk" style="width:100%;">
            <option value="">-- Pilih Jenis Kelamin --</option>
            <option value="L" ${s.jenisKelamin === 'L' ? 'selected' : ''}>Laki-laki</option>
            <option value="P" ${s.jenisKelamin === 'P' ? 'selected' : ''}>Perempuan</option>
          </select>
        </div>
      </div>

      <!-- Section 2: Orang Tua / Wali & Kontak -->
      <div id="section-wali" class="st-prof-section" style="display:none;">
        <div class="form-group">
          <label>Nama Lengkap Orang Tua / Wali</label>
          <input type="text" id="st-prof-wali" value="${escapeAttr(s.namaWali || '')}" placeholder="Nama Ayah / Ibu / Wali Siswa" style="width:100%;">
          <div class="helper-text">Dicantumkan pada kartu administrasi dan surat keterangan sekolah.</div>
        </div>

        <div class="form-group">
          <label>No. WhatsApp Orang Tua / Siswa</label>
          <input type="tel" id="st-prof-nohp" value="${escapeAttr(s.noHp || '')}" placeholder="Contoh: 081234567890" style="width:100%;">
          <div class="helper-text">Untuk menerima pemberitahuan resmi kwitansi dan presensi sekolah.</div>
        </div>

        <div class="form-group">
          <label>Alamat Lengkap Tempat Tinggal</label>
          <textarea id="st-prof-alamat" rows="2" placeholder="Dusun / Jalan, RT/RW, Desa/Kelurahan, Kecamatan..." style="width:100%;">${escapeHtml(s.alamat || '')}</textarea>
        </div>
      </div>

      <!-- Section 3: Keamanan & PIN Login -->
      <div id="section-sec" class="st-prof-section" style="display:none;">
        <div class="form-group">
          <label>PIN / Kata Sandi Login Siswa</label>
          <input type="password" id="st-prof-pin" value="${escapeAttr(s.pin || '')}" placeholder="Kosongkan jika ingin tetap memakai NIS (${escapeAttr(s.nis || '')})" style="width:100%;">
          <div class="helper-text">Gunakan 4–6 digit angka/huruf rahasia agar akun Anda tidak dapat diakses orang lain.</div>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500; font-size:12.5px;">
            <input type="checkbox" id="st-prof-show-pin" style="width:15px; height:15px;">
            <span>Tampilkan karakter PIN</span>
          </label>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="modal-cancel">Batal</button>
      <button class="btn btn-primary" id="btn-save-st-prof" style="display:inline-flex; align-items:center; gap:6px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Simpan Profil Lengkap
      </button>
    </div>
  `);

  // Switch tabs
  const tabBio = document.getElementById('tab-btn-bio');
  const tabWali = document.getElementById('tab-btn-wali');
  const tabSec = document.getElementById('tab-btn-sec');
  const secBio = document.getElementById('section-bio');
  const secWali = document.getElementById('section-wali');
  const secSec = document.getElementById('section-sec');

  const switchTab = (activeTab, activeSec) => {
    [tabBio, tabWali, tabSec].forEach(t => t?.classList.remove('active'));
    [secBio, secWali, secSec].forEach(s => { if (s) s.style.display = 'none'; });
    activeTab?.classList.add('active');
    if (activeSec) activeSec.style.display = 'block';
  };

  tabBio?.addEventListener('click', () => switchTab(tabBio, secBio));
  tabWali?.addEventListener('click', () => switchTab(tabWali, secWali));
  tabSec?.addEventListener('click', () => switchTab(tabSec, secSec));

  // Photo handlers
  const btnUploadPhoto = document.getElementById('btn-upload-st-photo');
  const btnRemovePhoto = document.getElementById('btn-remove-st-photo');
  const inputPhotoFile = document.getElementById('input-st-photo-file');

  btnUploadPhoto?.addEventListener('click', () => inputPhotoFile?.click());

  inputPhotoFile?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      currentFoto = await compressImageFile(file, 280, 0.82);
      const prevLg = document.getElementById('st-prof-avatar-large');
      const prevSm = document.getElementById('st-prof-avatar-preview');
      if (prevLg) prevLg.innerHTML = renderAvatarHtml({ ...s, foto: currentFoto }, 64);
      if (prevSm) prevSm.innerHTML = renderAvatarHtml({ ...s, foto: currentFoto }, 46);
      if (btnRemovePhoto) btnRemovePhoto.style.display = 'inline-block';
      toast('Foto profil berhasil dimuat (klik Simpan untuk menyimpan)', 'info');
    } catch (err) {
      toast(err.message || 'Gagal memproses gambar foto', 'error');
    }
  });

  btnRemovePhoto?.addEventListener('click', () => {
    currentFoto = '';
    const prevLg = document.getElementById('st-prof-avatar-large');
    const prevSm = document.getElementById('st-prof-avatar-preview');
    if (prevLg) prevLg.innerHTML = renderAvatarHtml({ ...s, foto: '' }, 64);
    if (prevSm) prevSm.innerHTML = renderAvatarHtml({ ...s, foto: '' }, 46);
    if (btnRemovePhoto) btnRemovePhoto.style.display = 'none';
    if (inputPhotoFile) inputPhotoFile.value = '';
    toast('Foto dihapus (klik Simpan untuk menerapkan perubahan)', 'info');
  });

  document.getElementById('st-prof-show-pin')?.addEventListener('change', e => {
    const pinIn = document.getElementById('st-prof-pin');
    if (pinIn) pinIn.type = e.target.checked ? 'text' : 'password';
  });

  document.getElementById('btn-save-st-prof')?.addEventListener('click', () => {
    const target = store.state.siswa.find(x => x.id === s.id);
    if (target) {
      target.foto = currentFoto;
      target.nisn = document.getElementById('st-prof-nisn')?.value.trim() || '';
      target.nik = document.getElementById('st-prof-nik')?.value.trim() || '';
      target.tempatLahir = document.getElementById('st-prof-tempat-lahir')?.value.trim() || '';
      target.tanggalLahir = document.getElementById('st-prof-tgl-lahir')?.value || '';
      target.jenisKelamin = document.getElementById('st-prof-jk')?.value || '';
      target.namaWali = document.getElementById('st-prof-wali')?.value.trim() || '';
      target.noHp = document.getElementById('st-prof-nohp')?.value.trim() || '';
      target.alamat = document.getElementById('st-prof-alamat')?.value.trim() || '';
      target.pin = document.getElementById('st-prof-pin')?.value.trim() || '';

      saveData('Data profil siswa berhasil disimpan & diperbarui');
      toast('Profil siswa berhasil diperbarui', 'success');
      closeModal();
      triggerRender();
    }
  });
}

function iconMoney(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`; }
function iconUserCheck(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/><path d="M16 11l2 2 4-4"/></svg>`; }
function iconAlertTri(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>`; }
function iconWallet(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01M2 10h20"/></svg>`; }
function iconEmptyUsers(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`; }

function renderTopTunggakan(){
  const rows = store.state.siswa.map(s=>({ s, t: siswaTunggakan(s.id) }))
    .filter(r=>r.t.totalKurang>0)
    .sort((a,b)=>b.t.totalKurang-a.t.totalKurang)
    .slice(0,6);
  if(rows.length===0) return `<div class="empty-state" style="padding:24px;"><p>Semua siswa lunas sampai bulan berjalan.</p></div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Nama</th><th>Kelas</th><th class="num">Bulan Tertunggak</th><th class="num">Kekurangan</th><th style="width:120px; text-align:right;">Aksi</th></tr></thead><tbody>
    ${rows.map(r=>`<tr>
      <td><strong>${escapeHtml(r.s.nama)}</strong></td>
      <td><span class="kelas-chip">${escapeHtml(r.s.kelas)}</span></td>
      <td class="num">${r.t.jumlahBulan}</td>
      <td class="num">${fmtRupiah(r.t.totalKurang)}</td>
      <td style="text-align:right; white-space:nowrap;">
        ${r.s.noHp ? `<button class="btn btn-sm btn-ghost" style="color:#25D366;" data-dash-wa="${r.s.id}" title="Kirim Pengingat WA"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button>` : ''}
        <button class="btn btn-sm btn-secondary" data-dash-bayar="${r.s.id}" title="Catat Pembayaran SPP">Bayar</button>
      </td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

export async function renderDashboard(){
  const el = document.getElementById('page-dashboard');
  const user = store.ui.currentUser;

  // VIEW FOR SISWA
  if (user && user.role === 'siswa') {
    const s = store.state.siswa.find(x => x.id === user.id);
    if (!s) {
      el.innerHTML = `<div class="empty-state">Data siswa tidak ditemukan.</div>`;
      return;
    }
    const tunggakan = siswaTunggakan(s.id);
    const periode = getPeriode();
    const nominal = store.state.settings.nominalSPP;
    const tahunAjaran = store.state.settings.tahunAjaran || '';
    
    const lunasCount = periode.filter(p => siswaTotalBulan(s.id, p.bulan, p.tahun) >= nominal).length;
    const progressPercent = Math.round((lunasCount / 12) * 100);
    
    const nominalIjazah = store.state.settings.nominalIjazah || 500000;
    const ijazahTerbayar = store.state.pembayaran.filter(p => p.siswaId === s.id && p.jenis === 'ijazah').reduce((sum, p) => sum + p.nominal, 0);
    const ijazahPercent = Math.min(100, Math.round((ijazahTerbayar / nominalIjazah) * 100));

    const totalTerbayarSpp = store.state.pembayaran.filter(p => p.siswaId === s.id && (!p.jenis || p.jenis === 'spp')).reduce((sum, p) => sum + p.nominal, 0);

    const isProfileComplete = Boolean(s.nisn && s.namaWali && s.alamat);
    const isSemuaLunas = progressPercent >= 100 && ijazahPercent >= 100;

    const today = getTodayDateStr();
    const todayRecord = (store.state.absensi || []).find(a => a.siswaId === s.id && a.tanggal === today);
    let absenClass = 'belum';
    let absenIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    let absenTitle = 'Belum Ada Scan Presensi Hari Ini';
    let absenSub = 'Silakan lakukan scan kartu di pintu masuk gerbang sekolah.';
    let absenBadge = '<span class="badge" style="background:#f1f5f9; color:#475569;">Belum Hadir</span>';

    if (todayRecord) {
      if (todayRecord.status === 'hadir') {
        absenClass = 'hadir';
        absenIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
        absenTitle = `Hadir Tepat Waktu — Pukul ${formatTimeDisplay(todayRecord.jamMasuk)}`;
        absenSub = todayRecord.jamPulang ? `Telah scan pulang pukul ${formatTimeDisplay(todayRecord.jamPulang)}` : 'Presensi masuk tercatat di sistem sekolah.';
        absenBadge = '<span class="badge lunas">Hadir Tepat Waktu</span>';
      } else if (todayRecord.status === 'terlambat') {
        absenClass = 'terlambat';
        absenIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
        absenTitle = `Terlambat Masuk — Pukul ${formatTimeDisplay(todayRecord.jamMasuk)}`;
        absenSub = todayRecord.keterangan || 'Melewati batas toleransi jam masuk sekolah.';
        absenBadge = '<span class="badge parsial">Terlambat</span>';
      } else if (todayRecord.status === 'izin') {
        absenClass = 'belum';
        absenTitle = 'Izin Tidak Masuk';
        absenSub = todayRecord.keterangan || 'Izin telah disetujui sekolah.';
        absenBadge = '<span class="badge" style="background:var(--blue-soft);color:var(--blue);">Izin</span>';
      } else if (todayRecord.status === 'sakit') {
        absenClass = 'belum';
        absenTitle = 'Sakit';
        absenSub = todayRecord.keterangan || 'Keterangan sakit tercatat.';
        absenBadge = '<span class="badge" style="background:var(--gold-soft);color:var(--gold);">Sakit</span>';
      } else {
        absenClass = 'terlambat';
        absenTitle = 'Alpa (Tanpa Keterangan)';
        absenSub = 'Belum ada konfirmasi kehadiran dari orang tua.';
        absenBadge = '<span class="badge nunggak">Alpa</span>';
      }
    }

    el.innerHTML = `
      <!-- Holographic Digital Student Passport -->
      <div class="student-pass-card">
        <div class="sp-header">
          <div class="sp-school-wrap">
            <span style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#94A3B8;">${escapeHtml(store.state.settings.namaSekolah || 'MTs Yasta Bunter')}</span>
            <span style="font-size:10px; color:rgba(255,255,255,0.4);">•</span>
            <span style="font-size:10.5px; font-weight:600; color:#38BDF8; letter-spacing:0.05em;">KARTU SPP & PRESENSI DIGITAL</span>
          </div>
          <div class="sp-chip-emv">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#FCD34D" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 9h6M14 12h4M14 15h6"/></svg>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
          </div>
        </div>

        <div class="sp-body" style="display:flex; align-items:center; gap:16px;">
          <div style="flex-shrink:0;">
            ${renderAvatarHtml(s, 60, 'sp-card-avatar')}
          </div>
          <div style="flex:1; min-width:0;">
            <div class="sp-student-name">${escapeHtml(s.nama)}</div>
            <div class="sp-student-meta-row">
              <span class="sp-pill">NIS: ${escapeHtml(s.nis || 'Belum Diatur')}</span>
              ${s.nisn ? `<span class="sp-pill monospace">NISN: ${escapeHtml(s.nisn)}</span>` : ''}
              <span class="sp-pill">Kelas ${escapeHtml(s.kelas)}</span>
              <span class="sp-pill ${s.rfidUid ? 'active-status' : ''}" style="display:inline-flex; align-items:center; gap:4px;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 9h6M14 12h4M14 15h6"/></svg>
                <span>${s.rfidUid ? `RFID: ${escapeHtml(s.rfidUid)}` : 'QR Ready'}</span>
              </span>
              <span class="sp-pill active-status">Siswa Aktif</span>
              <span class="sp-pill" style="opacity:0.85;">TA ${escapeHtml(tahunAjaran)}</span>
            </div>
          </div>
        </div>

        <div class="sp-footer">
          <div>
            <div class="sp-fee-label">Biaya SPP Bulanan</div>
            <div class="sp-fee-amount">${fmtRupiah(nominal)}</div>
          </div>
          <div>
            <button type="button" class="btn-sp-open-qr" id="btn-hero-show-qr">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              <span>Buka Kartu Pelajar & QR</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Banner Kelengkapan Data Profil Siswa -->
      ${!isProfileComplete ? `
        <div class="card" style="background:rgba(245,158,11,0.07); border:1.5px solid rgba(245,158,11,0.3); border-radius:12px; margin-bottom:16px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:36px; height:36px; border-radius:50%; background:rgba(245,158,11,0.18); display:flex; align-items:center; justify-content:center; color:#D97706; flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            </div>
            <div>
              <div style="font-weight:700; font-size:13.5px; color:#B45309;">Lengkapi Data Profil & Orang Tua</div>
              <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">
                ${!s.nisn ? 'NISN' : ''}${!s.namaWali ? (!s.nisn ? ', Nama Orang Tua' : 'Nama Orang Tua') : ''}${!s.alamat ? ', Alamat Lengkap' : ''} belum diisi. Lengkapi untuk penerbitan berkas resmi.
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-primary" id="btn-banner-complete-profile" style="background:#D97706; border-color:#D97706;">
            Lengkapi Profil &rarr;
          </button>
        </div>
      ` : ''}

      <!-- Banner Bebas Administrasi 100% Lunas -->
      ${isSemuaLunas ? `
        <div class="card" style="background:linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.08)); border:1.5px solid #10B981; border-radius:12px; margin-bottom:16px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:38px; height:38px; border-radius:50%; background:#10B981; display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; box-shadow:0 3px 10px rgba(16,185,129,0.3);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px;"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style="font-weight:800; font-size:14.5px; color:#065F46;">Alhamdulillah! Semua Kewajiban Administrasi Lunas (100%)</div>
              <div style="font-size:12px; color:#047857; margin-top:2px;">Anda telah menyelesaikan SPP 12 Bulan & Administrasi Ijazah. Surat Keterangan Bebas Keuangan dapat dicetak.</div>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-primary" id="btn-cetak-surat-bebas" style="background:#059669; border-color:#059669; display:inline-flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>Cetak Surat Keterangan Lunas</span>
          </button>
        </div>
      ` : ''}

      <!-- Realtime Attendance Banner -->
      <div class="student-attendance-banner ${absenClass}" id="widget-kehadiran-siswa" title="Klik untuk membuka log presensi detail">
        <div class="sab-left">
          <div class="sab-icon-box ${absenClass}">
            ${absenIcon}
          </div>
          <div>
            <div class="sab-eyebrow">Status Presensi Hari Ini • ${new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'short' })}</div>
            <div class="sab-title">${absenTitle}</div>
            <div style="font-size:12.5px; color:var(--ink-soft); margin-top:2px;">${absenSub}</div>
            ${todayRecord && (todayRecord.jamDuha || todayRecord.jamDzuhur) ? `
              <div style="display:flex; gap:8px; margin-top:6px; flex-wrap:wrap;">
                ${todayRecord.jamDuha ? `<span class="badge" style="background:#FEF3C7; color:#92400E; font-size:11px;">Sholat Dhuha: ${formatTimeDisplay(todayRecord.jamDuha)}</span>` : ''}
                ${todayRecord.jamDzuhur ? `<span class="badge" style="background:#DBEAFE; color:#1E40AF; font-size:11px;">Sholat Dzuhur: ${formatTimeDisplay(todayRecord.jamDzuhur)}</span>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          ${absenBadge}
          <span style="color:var(--primary); font-size:13px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
            Detail &rarr;
          </span>
        </div>
      </div>

      <!-- Quick Action Shortcuts Hub -->
      <div class="student-actions-grid">
        <div class="action-tile-btn" id="shortcut-absensi">
          <div class="at-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </div>
          <div>
            <div class="at-label">Kartu QR Presensi</div>
            <div class="at-desc">Tunjukkan saat tiba di gerbang</div>
          </div>
        </div>

        <div class="action-tile-btn" id="shortcut-riwayat">
          <div class="at-icon purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
          </div>
          <div>
            <div class="at-label">Riwayat & Kwitansi</div>
            <div class="at-desc">Cek tagihan & bukti bayar</div>
          </div>
        </div>

        <a href="${formatWaLink(store.state.settings.noHpBendahara, `Halo Bendahara ${store.state.settings.namaSekolah}, saya ${s.nama} (${s.kelas}) ingin berkonsultasi mengenai administrasi SPP.`) || '#'}" ${store.state.settings.noHpBendahara ? 'target="_blank"' : ''} class="action-tile-btn" id="shortcut-wa-bendahara">
          <div class="at-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          </div>
          <div>
            <div class="at-label">Chat WhatsApp</div>
            <div class="at-desc">Hubungi bendahara sekolah</div>
          </div>
        </a>

        <div class="action-tile-btn" id="shortcut-profil-pin">
          <div class="at-icon" style="background:rgba(245,158,11,0.12); color:#D97706;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div class="at-label">Profil & Ubah PIN</div>
            <div class="at-desc">${s.pin ? 'PIN kustom aktif' : 'Masih memakai PIN standar'}</div>
          </div>
        </div>
      </div>

      <!-- SPP & Ijazah Progress Cards -->
      <div class="card" style="margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <div>
            <h3 style="margin:0; font-size:16px;">Progres Pelunasan SPP</h3>
            <div class="card-sub" style="margin-top:2px;">Target pembayaran 12 bulan (Tahun Ajaran ${getActiveTahunMulai()}/${getActiveTahunMulai()+1})</div>
          </div>
          <span class="badge ${progressPercent >= 100 ? 'lunas' : progressPercent > 0 ? 'parsial' : 'nunggak'}">
            ${progressPercent >= 100 ? 'Lunas 100%' : `${lunasCount} / 12 Bulan`}
          </span>
        </div>
        <div class="progress-container">
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progressPercent}%; background: linear-gradient(90deg, #4338CA, #10B981);"></div>
          </div>
          <div class="progress-text">
            <span>Total Terbayar: <strong>${fmtRupiah(totalTerbayarSpp)}</strong></span>
            <span><strong>${progressPercent}%</strong></span>
          </div>
        </div>
      </div>
      
      <div class="card" style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <div>
            <h3 style="margin:0; font-size:16px;">Tabungan / Administrasi Ijazah</h3>
            <div class="card-sub" style="margin-top:2px;">Total Ketetapan: <strong>${fmtRupiah(nominalIjazah)}</strong></div>
          </div>
          <span class="badge ${ijazahPercent >= 100 ? 'lunas' : 'parsial'}">
            ${ijazahPercent >= 100 ? 'Lunas' : `Sisa ${fmtRupiah(Math.max(0, nominalIjazah - ijazahTerbayar))}`}
          </span>
        </div>
        <div class="progress-container">
          <div class="progress-track">
            <div class="progress-fill" style="width: ${ijazahPercent}%; background: #10B981;"></div>
          </div>
          <div class="progress-text">
            <span>Terbayar: <strong>${fmtRupiah(ijazahTerbayar)}</strong></span>
            <span><strong>${ijazahPercent}%</strong></span>
          </div>
        </div>
      </div>
      
      <!-- Financial Summary Cards (4 Balanced Columns) -->
      ${(() => {
        const curBulanEntry = currentPeriodeEntry();
        const stBulanIni = siswaStatusBulan(s.id, curBulanEntry.bulan, curBulanEntry.tahun);
        const sisaIjazah = Math.max(0, nominalIjazah - ijazahTerbayar);
        return `
          <div class="stat-row">
            <div class="stat-card ${stBulanIni === 'lunas' ? 'emerald' : stBulanIni === 'parsial' ? 'amber' : 'rust'}">
              <div class="stat-icon">${iconMoney()}</div>
              <div class="label">SPP ${BULAN[curBulanEntry.bulan-1]} ${curBulanEntry.tahun}</div>
              <div class="value">${stBulanIni === 'lunas' ? 'Lunas' : stBulanIni === 'parsial' ? 'Sebagian' : 'Belum Bayar'}</div>
              <div class="foot">Status bulan berjalan</div>
            </div>
            <div class="stat-card ${tunggakan.jumlahBulan > 0 ? 'rust' : 'gold'}">
              <div class="stat-icon">${iconAlertTri()}</div>
              <div class="label">Bulan Menunggak</div>
              <div class="value">${tunggakan.jumlahBulan === 0 ? 'Nihil (Lunas)' : tunggakan.jumlahBulan + ' Bulan'}</div>
              <div class="foot">Perhitungan hingga bulan ini</div>
            </div>
            <div class="stat-card ${tunggakan.totalKurang > 0 ? 'rust' : 'gold'}">
              <div class="stat-icon">${iconWallet()}</div>
              <div class="label">Kekurangan SPP</div>
              <div class="value">${fmtRupiah(tunggakan.totalKurang)}</div>
              <div class="foot">Total tagihan SPP jatuh tempo</div>
            </div>
            <div class="stat-card ${sisaIjazah === 0 ? 'emerald' : 'blue'}">
              <div class="stat-icon">${iconUserCheck()}</div>
              <div class="label">Sisa Tagihan Ijazah</div>
              <div class="value">${sisaIjazah === 0 ? 'Lunas' : fmtRupiah(sisaIjazah)}</div>
              <div class="foot">Terbayar ${ijazahPercent}% dari ketetapan</div>
            </div>
          </div>
        `;
      })()}
    `;

    // Events
    document.getElementById('widget-kehadiran-siswa')?.addEventListener('click', () => {
      store.ui.page = 'absensi';
      triggerRender();
    });

    document.getElementById('shortcut-absensi')?.addEventListener('click', () => {
      store.ui.page = 'absensi';
      triggerRender();
    });

    document.getElementById('shortcut-riwayat')?.addEventListener('click', () => {
      store.ui.page = 'riwayat';
      triggerRender();
    });

    document.getElementById('shortcut-profil-pin')?.addEventListener('click', () => {
      openStudentProfileModal(s);
    });

    document.getElementById('btn-banner-complete-profile')?.addEventListener('click', () => {
      openStudentProfileModal(s);
    });

    document.getElementById('btn-cetak-surat-bebas')?.addEventListener('click', () => {
      cetakSuratBebasAdministrasi(s);
    });

    document.getElementById('shortcut-wa-bendahara')?.addEventListener('click', (e) => {
      if (!store.state.settings.noHpBendahara) {
        e.preventDefault();
        toast('Nomor WhatsApp Bendahara belum diatur oleh sekolah.', 'info');
      }
    });

    document.getElementById('btn-hero-show-qr')?.addEventListener('click', async () => {
      const cardHtml = await renderStudentCardHtml(s);
      openModal(`
        <div class="modal-head">
          <div>
            <h3 style="margin:0;">Kartu Pelajar & QR Digital (2 Sisi)</h3>
            <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">Dilengkapi QR presensi, identitas madrasah, & tata tertib resmi</div>
          </div>
          <button class="close-x" id="modal-close">&times;</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; align-items:center; gap:14px; padding:20px 10px; background:var(--paper-dim);">
          <div style="transform:scale(1.05); transform-origin:center top; margin:10px 0;">
            ${cardHtml}
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
            <button class="btn btn-sm btn-outline" id="btn-flip-card-view" style="display:inline-flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
              <span id="btn-flip-label">Balik ke Sisi Belakang (Tata Tertib)</span>
            </button>
          </div>
          <div style="font-size:12px; color:var(--ink-soft); text-align:center; max-width:320px;">
            Arahkan kartu ke pemindai gerbang sekolah atau simpan gambar PNG untuk dicetak menjadi kartu fisik.
          </div>
        </div>
        <div class="modal-foot" style="flex-wrap:wrap; gap:8px;">
          <button class="btn" id="modal-cancel">Tutup</button>
          <button class="btn btn-outline" id="btn-hero-dl-back">Unduh Sisi Belakang PNG</button>
          <button class="btn btn-primary" id="btn-hero-dl-qr">Unduh Sisi Depan PNG</button>
        </div>
      `);

      let isShowingBack = false;
      document.getElementById('btn-flip-card-view')?.addEventListener('click', () => {
        const cardEl = document.getElementById(`id-card-${s.id}`);
        const labelEl = document.getElementById('btn-flip-label');
        if (!cardEl) return;
        isShowingBack = !isShowingBack;
        cardEl.classList.toggle('show-back', isShowingBack);
        if (labelEl) {
          labelEl.textContent = isShowingBack ? 'Balik ke Sisi Depan (Identitas & QR)' : 'Balik ke Sisi Belakang (Tata Tertib)';
        }
      });

      document.getElementById('btn-hero-dl-qr')?.addEventListener('click', async () => {
        await downloadStudentQrCardPng(s);
        toast('Kartu depan (QR) berhasil disimpan sebagai PNG', 'success');
      });

      document.getElementById('btn-hero-dl-back')?.addEventListener('click', async () => {
        await downloadStudentCardBackPng(s);
        toast('Kartu belakang berhasil disimpan sebagai PNG', 'success');
      });
    });

    return;
  }

  // VIEW FOR BENDAHARA
  const cur = currentPeriodeEntry();
  const totalSiswa = store.state.siswa.length;
  
  const totalSPPMasukBulanIni = store.state.pembayaran
    .filter(p=>(!p.jenis || p.jenis==='spp') && p.bulan===cur.bulan && p.tahun===cur.tahun)
    .reduce((a,p)=>a+p.nominal,0);
    
  const totalIjazahMasuk = store.state.pembayaran
    .filter(p=>p.jenis==='ijazah')
    .reduce((a,p)=>a+p.nominal,0);

  let lunasCount = 0, parsialCount = 0, nunggakCount = 0;
  store.state.siswa.forEach(s=>{
    const st = siswaStatusBulan(s.id, cur.bulan, cur.tahun);
    if(st==='lunas') lunasCount++; else if(st==='parsial') parsialCount++; else nunggakCount++;
  });

  let totalPiutang = 0;
  store.state.siswa.forEach(s=>{ totalPiutang += siswaTunggakan(s.id).totalKurang; });

  const now = new Date();
  const months = [];
  for(let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({ bulan: d.getMonth()+1, tahun: d.getFullYear() });
  }
  const totals = months.map(m => store.state.pembayaran.filter(p=>(!p.jenis || p.jenis==='spp') && p.bulan===m.bulan && p.tahun===m.tahun).reduce((a,p)=>a+p.nominal,0));
  const maxTotal = Math.max(...totals, 1);
  const absenStatsToday = getStatistikAbsensi(getTodayDateStr());

  if(totalSiswa===0){
    el.innerHTML = emptyState(iconEmptyUsers(), 'Belum ada data siswa', 'Tambahkan data siswa terlebih dahulu di menu Data Siswa untuk mulai mencatat pembayaran SPP.', 'Tambah Data Siswa', () => {
      store.ui.page = 'siswa';
      triggerRender();
    });
    return;
  }

  el.innerHTML = `
    <!-- Quick Actions Bar for Bendahara -->
    <div style="display:flex; gap:10px; margin-bottom:22px; flex-wrap:wrap;">
      <button class="btn btn-primary" id="btn-quick-bayar" style="display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:12px; font-weight:600; box-shadow:0 4px 12px rgba(51,53,148,0.25);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>
        <span>Input Pembayaran SPP</span>
      </button>
      <button class="btn" id="btn-quick-absensi" style="display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:12px; font-weight:600; background:var(--paper); border:1px solid var(--line); color:var(--ink);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
        <span>Buka Scanner Presensi</span>
      </button>
      <button class="btn" id="btn-quick-siswa" style="display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:12px; font-weight:600; background:var(--paper); border:1px solid var(--line); color:var(--ink);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2"/><circle cx="17" cy="8.5" r="2.6"/><path d="M15.5 13.5c2.9.3 5 2.6 5 6.2"/></svg>
        <span>Daftar Siswa (${totalSiswa})</span>
      </button>
    </div>

    <div class="stat-row">
      <div class="stat-card gold">
        <div class="stat-icon">${iconMoney()}</div>
        <div class="label">SPP Masuk Bulan ${BULAN[cur.bulan-1]}</div>
        <div class="value">${fmtRupiah(totalSPPMasukBulanIni)}</div>
        <div class="foot">Bulan berjalan (${cur.tahun})</div>
      </div>
      <div class="stat-card emerald">
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="label">Total Ijazah Masuk</div>
        <div class="value">${fmtRupiah(totalIjazahMasuk)}</div>
        <div class="foot">Akumulasi seluruhnya</div>
      </div>
      <div class="stat-card rust">
        <div class="stat-icon">${iconAlertTri()}</div>
        <div class="label">Belum / Kurang Bayar</div>
        <div class="value">${nunggakCount+parsialCount} Siswa</div>
        <div class="foot">${nunggakCount} belum bayar · ${parsialCount} sebagian</div>
      </div>
      <div class="stat-card rust">
        <div class="stat-icon">${iconWallet()}</div>
        <div class="label">Total Piutang Berjalan</div>
        <div class="value">${fmtRupiah(totalPiutang)}</div>
        <div class="foot">Akumulasi tunggakan SPP</div>
      </div>
    </div>

    <!-- Ringkasan Kehadiran Hari Ini -->
    <div class="card" style="margin-bottom:24px; padding:16px 20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
        <div>
          <h3 style="margin:0; font-size:15.5px;">Ringkasan Presensi Siswa Hari Ini</h3>
          <div class="card-sub">${new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-dash-rekap-absen">Kelola Rekap Presensi &rarr;</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:10px; padding:10px 14px;">
          <div style="font-size:11px; color:var(--ink-soft); text-transform:uppercase; font-weight:600;">Hadir Tepat Waktu</div>
          <div style="font-size:20px; font-weight:800; color:#10B981; font-family:'IBM Plex Mono',monospace; margin-top:2px;">${absenStatsToday.hadir} <span style="font-size:12px; font-weight:500; color:var(--ink-soft);">Siswa</span></div>
        </div>
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:10px; padding:10px 14px;">
          <div style="font-size:11px; color:var(--ink-soft); text-transform:uppercase; font-weight:600;">Terlambat</div>
          <div style="font-size:20px; font-weight:800; color:#D97706; font-family:'IBM Plex Mono',monospace; margin-top:2px;">${absenStatsToday.terlambat} <span style="font-size:12px; font-weight:500; color:var(--ink-soft);">Siswa</span></div>
        </div>
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:10px; padding:10px 14px;">
          <div style="font-size:11px; color:var(--ink-soft); text-transform:uppercase; font-weight:600;">Izin / Sakit</div>
          <div style="font-size:20px; font-weight:800; color:#3B82F6; font-family:'IBM Plex Mono',monospace; margin-top:2px;">${absenStatsToday.izin + absenStatsToday.sakit} <span style="font-size:12px; font-weight:500; color:var(--ink-soft);">Siswa</span></div>
        </div>
        <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:10px; padding:10px 14px;">
          <div style="font-size:11px; color:var(--ink-soft); text-transform:uppercase; font-weight:600;">Belum Hadir / Alpa</div>
          <div style="font-size:20px; font-weight:800; color:var(--ink); font-family:'IBM Plex Mono',monospace; margin-top:2px;">${absenStatsToday.belumHadir + absenStatsToday.alpa} <span style="font-size:12px; font-weight:500; color:var(--ink-soft);">Siswa</span></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div>
          <h3 style="margin:0;">Tren Pemasukan 6 Bulan Terakhir</h3>
          <div class="card-sub">Total SPP diterima per bulan</div>
        </div>
        ${totals.some(t => t > 0) ? `<span style="font-size:12px; font-weight:600; color:var(--ink-soft);">Tertinggi: ${fmtRupiah(maxTotal)}</span>` : ''}
      </div>
      ${totals.every(t => t === 0) ? `
        <div style="text-align:center; padding:32px 16px; background:var(--paper-dim); border-radius:12px; border:1px dashed var(--line); color:var(--ink-soft);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;margin-bottom:8px;opacity:0.6;"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>
          <div style="font-size:14px; font-weight:600; color:var(--ink); margin-bottom:4px;">Belum Ada Riwayat Pemasukan 6 Bulan Ini</div>
          <div style="font-size:12.5px; margin-bottom:14px;">Catat setoran pembayaran SPP siswa pertama Anda untuk melihat grafik pertumbuhan pemasukan.</div>
          <button class="btn btn-primary" id="btn-chart-bayar" style="font-size:12.5px; padding:6px 16px; border-radius:8px;">+ Catat Pembayaran Sekarang</button>
        </div>
      ` : `
        <div class="chart-wrap">
          ${months.map((m,i)=>`
            <div class="bar-col">
              <span class="amt">${totals[i]>0? fmtRupiah(totals[i]).replace('Rp',''):''}</span>
              <div class="bar" style="height:${Math.max(6, totals[i]/maxTotal*100)}%"></div>
              <span class="lbl">${BULAN[m.bulan-1].slice(0,3)}</span>
            </div>`).join('')}
        </div>
      `}
    </div>

    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div>
          <h3 style="margin:0;">Perlu Ditindaklanjuti</h3>
          <div class="card-sub">Siswa dengan tunggakan terbesar tahun ajaran ${store.state.settings.tahunAjaran || ''}</div>
        </div>
        <button class="btn btn-sm" id="btn-semua-riwayat" style="background:transparent; border:none; color:var(--primary); font-weight:600; cursor:pointer;">
          Lihat Semua Siswa &rarr;
        </button>
      </div>
      ${renderTopTunggakan()}
    </div>
  `;

  // Quick action listeners
  document.getElementById('btn-quick-bayar')?.addEventListener('click', () => {
    store.ui.page = 'bayar';
    triggerRender();
  });
  document.getElementById('btn-chart-bayar')?.addEventListener('click', () => {
    store.ui.page = 'bayar';
    triggerRender();
  });
  document.getElementById('btn-quick-absensi')?.addEventListener('click', () => {
    store.ui.page = 'absensi';
    triggerRender();
  });
  document.getElementById('btn-quick-siswa')?.addEventListener('click', () => {
    store.ui.page = 'siswa';
    triggerRender();
  });
  document.getElementById('btn-semua-riwayat')?.addEventListener('click', () => {
    store.ui.page = 'riwayat';
    triggerRender();
  });
  document.getElementById('btn-dash-rekap-absen')?.addEventListener('click', () => {
    store.ui.absensiTab = 'rekap';
    store.ui.page = 'absensi';
    triggerRender();
  });
  el.querySelectorAll('[data-dash-bayar]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.ui.bayarSiswaId = btn.dataset.dashBayar;
      store.ui.bayarJenis = 'spp';
      store.ui.bayarSelectedMonths = [];
      store.ui.page = 'bayar';
      triggerRender();
    });
  });
  el.querySelectorAll('[data-dash-wa]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.dashWa;
      const s = store.state.siswa.find(x => x.id === id);
      if (!s) return;
      const t = siswaTunggakan(id);
      const bulanTeks = t.bulanBelum.map(m => `- ${BULAN[m.bulan-1]} ${m.tahun} (Kurang: ${fmtRupiah(m.kurang)})`).join('\n');
      const teks = `Halo Bapak/Ibu,\n\nKami menginformasikan bahwa terdapat tunggakan pembayaran SPP atas nama *${s.nama}* (Kelas ${s.kelas}).\n\nRincian Tunggakan:\n${bulanTeks}\n\n*Total Tunggakan: ${fmtRupiah(t.totalKurang)}*\n\nMohon untuk segera melakukan pembayaran. Jika sudah membayar, abaikan pesan ini.\n\nTerima kasih,\nBendahara ${store.state.settings.namaSekolah}`;
      window.open(formatWaLink(s.noHp, teks), '_blank');
    });
  });
}
