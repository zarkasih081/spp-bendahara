import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { currentPeriodeEntry, siswaStatusBulan, siswaTunggakan, BULAN, emptyState, getPeriode, getActiveTahunMulai, siswaTotalBulan, toast } from '../../utils/helpers.js';
import { fmtRupiah, escapeHtml, escapeAttr, formatWaLink } from '../../utils/formatters.js';
import { triggerRender } from '../../utils/events.js';
import { getTodayDateStr, formatTimeDisplay, getStatistikAbsensi } from '../absensi/absensiService.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { renderStudentCardHtml, downloadStudentQrCardPng } from '../absensi/qrCardGenerator.js';

export function openStudentProfileModal(s) {
  if (!s) return;
  openModal(`
    <div class="modal-head">
      <h3>Profil & Keamanan Akun Siswa</h3>
      <button class="close-x" id="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-bottom:16px;">
        <div style="font-size:15px; font-weight:700; color:var(--ink);">${escapeHtml(s.nama)}</div>
        <div style="font-size:12.5px; color:var(--ink-soft); margin-top:2px;">NIS: <strong class="monospace">${escapeHtml(s.nis || '-')}</strong> • Kelas: <strong>${escapeHtml(s.kelas)}</strong></div>
      </div>
      <div class="form-group">
        <label>No. WhatsApp Orang Tua / Siswa</label>
        <input type="text" id="st-prof-nohp" value="${escapeAttr(s.noHp || '')}" placeholder="cth. 081234567890" style="width:100%;">
        <div class="helper-text">Digunakan untuk menerima bukti pembayaran dan notifikasi sekolah.</div>
      </div>
      <div class="form-group">
        <label>PIN / Kata Sandi Login Siswa Baru</label>
        <input type="password" id="st-prof-pin" value="${escapeAttr(s.pin || '')}" placeholder="Kosongkan jika tetap menggunakan NIS (${escapeAttr(s.nis || '')})" style="width:100%;">
        <div class="helper-text">Ubah PIN agar akun Anda tidak dapat dibuka oleh orang lain yang mengetahui NIS Anda.</div>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:500; font-size:12.5px;">
          <input type="checkbox" id="st-prof-show-pin" style="width:15px; height:15px;">
          <span>Tampilkan karakter PIN</span>
        </label>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="modal-cancel">Batal</button>
      <button class="btn btn-primary" id="btn-save-st-prof">Simpan Perubahan</button>
    </div>
  `);

  document.getElementById('st-prof-show-pin')?.addEventListener('change', e => {
    const pinIn = document.getElementById('st-prof-pin');
    if (pinIn) pinIn.type = e.target.checked ? 'text' : 'password';
  });

  document.getElementById('btn-save-st-prof')?.addEventListener('click', () => {
    const newNoHp = document.getElementById('st-prof-nohp').value.trim();
    const newPin = document.getElementById('st-prof-pin').value.trim();
    const target = store.state.siswa.find(x => x.id === s.id);
    if (target) {
      target.noHp = newNoHp;
      target.pin = newPin;
      saveData('Profil & PIN keamanan berhasil diperbarui');
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
  if(rows.length===0) return `<div class="empty-state" style="padding:24px;"><p>Semua siswa lunas sampai bulan berjalan. Kerja bagus, Bu/Pak Bendahara. 🎉</p></div>`;
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
        absenBadge = '<span class="badge lunas">✓ Hadir Tepat Waktu</span>';
      } else if (todayRecord.status === 'terlambat') {
        absenClass = 'terlambat';
        absenIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
        absenTitle = `Terlambat Masuk — Pukul ${formatTimeDisplay(todayRecord.jamMasuk)}`;
        absenSub = todayRecord.keterangan || 'Melewati batas toleransi jam masuk sekolah.';
        absenBadge = '<span class="badge parsial">! Terlambat</span>';
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

        <div class="sp-body">
          <div class="sp-student-name">${escapeHtml(s.nama)}</div>
          <div class="sp-student-meta-row">
            <span class="sp-pill">NIS: ${escapeHtml(s.nis || 'Belum Diatur')}</span>
            <span class="sp-pill">Kelas ${escapeHtml(s.kelas)}</span>
            <span class="sp-pill active-status">✓ Siswa Aktif</span>
            <span class="sp-pill" style="opacity:0.85;">TA ${escapeHtml(tahunAjaran)}</span>
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
          <h3>Kartu Pelajar & QR Digital</h3>
          <button class="close-x" id="modal-close">&times;</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; align-items:center; gap:16px; padding:20px 10px; background:var(--paper-dim);">
          <div style="transform:scale(1.05); transform-origin:center top; margin:10px 0;">
            ${cardHtml}
          </div>
          <div style="font-size:12.5px; color:var(--ink-soft); text-align:center; max-width:320px;">
            Arahkan kartu ke kamera pemindai gerbang sekolah atau perbesar kecerahan layar HP saat memindai.
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" id="modal-cancel">Tutup</button>
          <button class="btn btn-primary" id="btn-hero-dl-qr">Simpan Kartu PNG</button>
        </div>
      `);
      document.getElementById('btn-hero-dl-qr')?.addEventListener('click', async () => {
        await downloadStudentQrCardPng(s);
        toast('Kartu QR berhasil disimpan sebagai gambar PNG', 'success');
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
