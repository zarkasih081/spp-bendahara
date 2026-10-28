import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { escapeHtml, escapeAttr } from '../../utils/formatters.js';
import { toast, BULAN } from '../../utils/helpers.js';
import { openModal, closeModal, openConfirm } from '../../components/Modal.js';
import { triggerRender } from '../../utils/events.js';
import {
  getTodayDateStr,
  getCurrentTimeStr,
  formatTimeDisplay,
  catatAbsenByKode,
  manualAddOrUpdateAbsensi,
  deleteAbsensi,
  getStatistikAbsensi,
  getRiwayatAbsensiSiswa,
  exportAbsensiExcel,
  formatWaLinkAbsensi,
  playScanSound
} from './absensiService.js';
import { renderStudentCardHtml, generateQrDataUrl } from './qrCardGenerator.js';
import { Html5Qrcode } from 'html5-qrcode';

let activeHtml5QrCode = null;
let isScannerRunning = false;
let currentCameraId = null;
let clockTimer = null;
let isCameraMirrored = false;
let currentZoomLevel = 1.0;
let currentScanMode = 'qr'; // 'qr' or 'barcode'
let isTorchActive = false;
let isScannerPaused = false;

function applyCameraTransform() {
  const video = document.querySelector('#qr-reader video');
  if (!video) return;
  const transforms = [];
  if (isCameraMirrored) transforms.push('scaleX(-1)');
  if (currentZoomLevel > 1.0) transforms.push(`scale(${currentZoomLevel})`);
  video.style.transform = transforms.join(' ') || 'none';
  video.style.transformOrigin = 'center center';
  video.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
}

function updateScanModeUi() {
  const brackets = document.getElementById('camera-brackets');
  const hudTag = document.querySelector('.target-hud-tag span:last-child');
  const btnModeQr = document.getElementById('btn-mode-qr');
  const btnModeBarcode = document.getElementById('btn-mode-barcode');
  const txtFsMode = document.getElementById('txt-fs-mode');

  if (brackets) {
    brackets.classList.toggle('mode-barcode', currentScanMode === 'barcode');
  }
  if (hudTag) {
    hudTag.textContent = currentScanMode === 'barcode' ? 'FOCUS: 1D BARCODE' : 'FOCUS AREA • SMART SCANNER';
  }
  if (btnModeQr) btnModeQr.classList.toggle('active', currentScanMode === 'qr');
  if (btnModeBarcode) btnModeBarcode.classList.toggle('active', currentScanMode === 'barcode');
  if (txtFsMode) txtFsMode.textContent = currentScanMode === 'barcode' ? 'Barcode' : 'QR Code';
}

function updateMirrorUi() {
  applyCameraTransform();
  const btnMirror = document.getElementById('btn-toggle-mirror');
  const btnFsMirror = document.getElementById('btn-fs-mirror');
  if (btnMirror) btnMirror.classList.toggle('active', isCameraMirrored);
  if (btnFsMirror) btnFsMirror.classList.toggle('active', isCameraMirrored);
}

function updateZoomUi() {
  applyCameraTransform();
  ['1x', '15x', '2x'].forEach(z => {
    const el = document.getElementById(`btn-zoom-${z}`);
    if (el) el.classList.remove('active');
  });
  const zKey = currentZoomLevel === 1.0 ? '1x' : (currentZoomLevel === 1.5 ? '15x' : '2x');
  const activeBtn = document.getElementById(`btn-zoom-${zKey}`);
  if (activeBtn) activeBtn.classList.add('active');

  const txtFsZoom = document.getElementById('txt-fs-zoom');
  if (txtFsZoom) txtFsZoom.textContent = `${currentZoomLevel}x`;
}

async function toggleTorch() {
  isTorchActive = !isTorchActive;
  const btnTorch = document.getElementById('btn-toggle-torch');
  const btnFsTorch = document.getElementById('btn-fs-torch');
  if (btnTorch) btnTorch.classList.toggle('active', isTorchActive);
  if (btnFsTorch) btnFsTorch.classList.toggle('active', isTorchActive);

  try {
    const video = document.querySelector('#qr-reader video');
    if (video && video.srcObject) {
      const track = video.srcObject.getVideoTracks()[0];
      if (track) {
        await track.applyConstraints({ advanced: [{ torch: isTorchActive }] });
      }
    }
  } catch (err) {}
  toast(isTorchActive ? 'Senter kamera aktif ⚡' : 'Senter kamera nonaktif', 'info');
}

function toggleScannerPause() {
  if (!activeHtml5QrCode || !isScannerRunning) {
    toast('Aktifkan kamera terlebih dahulu', 'warning');
    return;
  }
  isScannerPaused = !isScannerPaused;
  const btnPause = document.getElementById('btn-pause-scanner');
  const btnFsPause = document.getElementById('btn-fs-pause');
  const badge = document.getElementById('scanner-status-badge');

  if (isScannerPaused) {
    if (activeHtml5QrCode.pause) activeHtml5QrCode.pause();
    if (btnPause) {
      btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Lanjutkan</span>`;
      btnPause.classList.add('active');
    }
    if (btnFsPause) {
      btnFsPause.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Lanjut</span>`;
    }
    if (badge) badge.innerHTML = `<span class="dot-radar off"></span><span>Dijeda</span>`;
    toast('Pemindaian dijeda ⏸', 'info');
  } else {
    if (activeHtml5QrCode.resume) activeHtml5QrCode.resume();
    if (btnPause) {
      btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg><span>Jeda</span>`;
      btnPause.classList.remove('active');
    }
    if (btnFsPause) {
      btnFsPause.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg><span>Jeda</span>`;
    }
    if (badge) badge.innerHTML = `<span class="dot-radar"></span><span>Live</span>`;
    toast('Pemindaian dilanjutkan ▶', 'info');
  }
}

async function scanImageFile(file) {
  if (!file) return;
  try {
    toast('Menganalisis berkas foto/gambar...', 'info');
    let scanner = activeHtml5QrCode;
    let tempScanner = false;
    if (!scanner) {
      scanner = new Html5Qrcode('qr-reader');
      tempScanner = true;
    }
    const decodedText = await scanner.scanFile(file, true);
    if (tempScanner) {
      scanner.clear();
    }
    onQrDetected(decodedText);
  } catch (err) {
    toast('Tidak ada kode QR atau Barcode terbaca dari gambar ini. Pastikan foto jelas dan terang.', 'warning');
  }
}

const onKeyDownFs = (e) => {
  if (store.ui.page !== 'absensi' || store.ui.absensiTab !== 'scan') return;
  if (e.key === 'Escape') {
    toggleCameraFullscreen(false);
  } else if ((e.key === 'f' || e.key === 'F') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault();
    toggleCameraFullscreen();
  }
};

const onFsChange = () => {
  if (!document.fullscreenElement) {
    const wrapper = document.getElementById('qr-camera-wrapper');
    if (wrapper && wrapper.classList.contains('camera-fullscreen-active')) {
      wrapper.classList.remove('camera-fullscreen-active');
      document.body.classList.remove('camera-fs-body-lock');
    }
  }
};

export function stopScanner() {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
  window.removeEventListener('keydown', onKeyDownFs);
  document.removeEventListener('fullscreenchange', onFsChange);
  const wrapper = document.getElementById('qr-camera-wrapper');
  if (wrapper) wrapper.classList.remove('camera-fullscreen-active');
  document.body.classList.remove('camera-fs-body-lock');
  document.body.classList.remove('kiosk-mode-active');
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  if (activeHtml5QrCode && isScannerRunning) {
    activeHtml5QrCode.stop().then(() => {
      isScannerRunning = false;
      isScannerPaused = false;
      const scanBox = document.getElementById('qr-reader');
      if (scanBox) scanBox.innerHTML = '';
    }).catch(err => {
      console.warn('Error stopping scanner:', err);
    });
  }
}

// Clean up scanner and clock when navigating away
window.addEventListener('beforeunload', () => {
  stopScanner();
  if (clockTimer) clearInterval(clockTimer);
});

export async function renderAbsensi() {
  const el = document.getElementById('page-absensi');
  const user = store.ui.currentUser;

  // Clear clock if not on scan tab
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }

  // Cleanup scanner if leaving scan tab
  if (store.ui.absensiTab !== 'scan') {
    stopScanner();
  }

  // 1. SISWA / ORANG TUA VIEW
  if (user && user.role === 'siswa') {
    await renderSiswaAbsensiView(el, user);
    return;
  }

  // 2. BENDAHARA / ADMIN VIEW
  await renderBendaharaAbsensiView(el);
}

// ==========================================
// ORANG TUA / SISWA VIEW
// ==========================================
async function renderSiswaAbsensiView(el, user) {
  const siswa = store.state.siswa.find(s => s.id === user.id);
  if (!siswa) {
    el.innerHTML = `<div class="empty-state">Data siswa tidak ditemukan.</div>`;
    return;
  }

  const today = getTodayDateStr();
  const todayRecord = (store.state.absensi || []).find(a => a.siswaId === siswa.id && a.tanggal === today);

  const now = new Date();
  const currentBulan = now.getMonth() + 1;
  const currentTahun = now.getFullYear();

  const riwayat = getRiwayatAbsensiSiswa(siswa.id, currentBulan, currentTahun);
  const totalHadir = riwayat.filter(r => r.status === 'hadir').length;
  const totalTerlambat = riwayat.filter(r => r.status === 'terlambat').length;
  const totalIzin = riwayat.filter(r => r.status === 'izin').length;
  const totalSakit = riwayat.filter(r => r.status === 'sakit').length;
  const totalAlpa = riwayat.filter(r => r.status === 'alpa').length;
  const totalMasuk = totalHadir + totalTerlambat;

  const cardHtml = await renderStudentCardHtml(siswa);

  let statusBadgeToday = '';
  let statusDescToday = '';

  if (!todayRecord) {
    statusBadgeToday = `<span class="badge" style="background:#f1f5f9; color:#475569; font-size:13px; padding:6px 14px;">Belum Hadir</span>`;
    statusDescToday = 'Ananda belum melakukan scan absensi masuk hari ini.';
  } else if (todayRecord.status === 'hadir') {
    statusBadgeToday = `<span class="badge lunas" style="font-size:13px; padding:6px 14px;">✓ Hadir Tepat Waktu</span>`;
    statusDescToday = `Masuk pukul <strong>${formatTimeDisplay(todayRecord.jamMasuk)}</strong>${todayRecord.jamPulang ? ` • Pulang: <strong>${formatTimeDisplay(todayRecord.jamPulang)}</strong>` : ' • Belum scan pulang'}`;
  } else if (todayRecord.status === 'terlambat') {
    statusBadgeToday = `<span class="badge parsial" style="font-size:13px; padding:6px 14px;">! Terlambat</span>`;
    statusDescToday = `Masuk pukul <strong>${formatTimeDisplay(todayRecord.jamMasuk)}</strong> (${todayRecord.keterangan || 'Melewati batas jam masuk'})${todayRecord.jamPulang ? ` • Pulang: <strong>${formatTimeDisplay(todayRecord.jamPulang)}</strong>` : ''}`;
  } else if (todayRecord.status === 'izin') {
    statusBadgeToday = `<span class="badge" style="background:var(--blue-soft); color:var(--blue); font-size:13px; padding:6px 14px;">Izin</span>`;
    statusDescToday = `Keterangan: ${escapeHtml(todayRecord.keterangan || 'Izin tidak masuk')}`;
  } else if (todayRecord.status === 'sakit') {
    statusBadgeToday = `<span class="badge" style="background:var(--gold-soft); color:var(--gold); font-size:13px; padding:6px 14px;">Sakit</span>`;
    statusDescToday = `Keterangan: ${escapeHtml(todayRecord.keterangan || 'Sakit')}`;
  } else {
    statusBadgeToday = `<span class="badge nunggak" style="font-size:13px; padding:6px 14px;">Alpa</span>`;
    statusDescToday = 'Tidak ada keterangan kehadiran.';
  }

  // Monthly Calendar Heatmap
  const calendarHtml = generateAttendanceCalendarHtml(currentTahun, currentBulan, riwayat);

  el.innerHTML = `
    <!-- Card Status Hari Ini -->
    <div class="card status-overview-card" style="margin-bottom:18px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
        <div>
          <div class="card-eyebrow">Status Kehadiran Hari Ini</div>
          <h2 style="margin:2px 0 6px 0; font-size:18px;">${new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</h2>
          <div style="font-size:13.5px; color:var(--ink-soft);">${statusDescToday}</div>
        </div>
        <div>
          ${statusBadgeToday}
        </div>
      </div>
    </div>

    <!-- Kartu QR Digital Siswa -->
    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
        <div>
          <h3 style="margin:0; font-size:16px;">Kartu Pelajar & QR Absensi</h3>
          <div class="card-sub" style="margin-top:2px; font-size:12px;">Tunjukkan kartu QR ini ke alat pemindai absensi sekolah</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-secondary" id="btn-zoom-qr-modal" title="Buka QR ukuran besar dengan kontras tinggi">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            Perbesar QR
          </button>
          <button class="btn btn-primary" id="btn-download-kartu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Simpan QR
          </button>
          <button class="btn" id="btn-print-kartu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Cetak Kartu
          </button>
        </div>
      </div>

      <div style="display:flex; justify-content:center; padding:8px 0;">
        ${cardHtml}
      </div>
    </div>

    <!-- Ringkasan Statistik Bulan Ini -->
    <div class="stat-row" style="margin-bottom:18px;">
      <div class="stat-card gold">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <div class="label">Total Hadir (${BULAN[currentBulan-1]})</div>
        <div class="value">${totalMasuk} Hari</div>
        <div class="foot">${totalHadir} tepat waktu • ${totalTerlambat} terlambat</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <div class="label">Izin / Sakit</div>
        <div class="value">${totalIzin + totalSakit} Hari</div>
        <div class="foot">${totalIzin} izin • ${totalSakit} sakit • ${totalAlpa} alpa</div>
      </div>
    </div>

    <!-- Kalender Visual Kehadiran Siswa -->
    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
        <h3 style="margin:0; font-size:15px;">Kalender Kehadiran (${BULAN[currentBulan-1]} ${currentTahun})</h3>
        <div class="cal-legend">
          <span class="legend-item"><span class="legend-dot dot-hadir"></span> Hadir</span>
          <span class="legend-item"><span class="legend-dot dot-terlambat"></span> Terlambat</span>
          <span class="legend-item"><span class="legend-dot dot-izin"></span> Izin/Sakit</span>
          <span class="legend-item"><span class="legend-dot dot-alpa"></span> Alpa</span>
        </div>
      </div>
      ${calendarHtml}
    </div>

    <!-- Riwayat Absensi Bulan Berjalan -->
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:15px;">Log Absensi Rinci (${BULAN[currentBulan-1]} ${currentTahun})</h3>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jam Masuk</th>
              <th>Jam Pulang</th>
              <th>Status</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${riwayat.length === 0 ? `
              <tr><td colspan="5" class="empty-state" style="padding:20px; text-align:center;">Belum ada catatan absensi bulan ini.</td></tr>
            ` : riwayat.map(r => {
              let badge = '';
              if (r.status === 'hadir') badge = '<span class="badge lunas">Tepat Waktu</span>';
              else if (r.status === 'terlambat') badge = '<span class="badge parsial">Terlambat</span>';
              else if (r.status === 'izin') badge = '<span class="badge" style="background:var(--blue-soft); color:var(--blue);">Izin</span>';
              else if (r.status === 'sakit') badge = '<span class="badge" style="background:var(--gold-soft); color:var(--gold);">Sakit</span>';
              else badge = '<span class="badge nunggak">Alpa</span>';

              return `
                <tr>
                  <td>${new Date(r.tanggal).toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}</td>
                  <td class="monospace">${formatTimeDisplay(r.jamMasuk)}</td>
                  <td class="monospace">${formatTimeDisplay(r.jamPulang)}</td>
                  <td>${badge}</td>
                  <td style="color:var(--ink-soft);">${escapeHtml(r.keterangan || '-')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Quick Floating Action QR Button for Mobile Screen -->
    <button class="mobile-floating-qr-btn" id="btn-floating-qr" title="Buka Kartu QR Saya">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      <span>Kartu QR</span>
    </button>
  `;

  // Attach button events for Siswa
  document.getElementById('btn-print-kartu')?.addEventListener('click', () => {
    printSingleCard(siswa);
  });

  document.getElementById('btn-zoom-qr-modal')?.addEventListener('click', async () => {
    const qrUrl = await generateQrDataUrl(siswa.nis || siswa.id);
    openModal(`
      <div class="modal-head">
        <h3>QR Presensi Cepat</h3>
        <button class="close-x" id="modal-close">&times;</button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; align-items:center; gap:14px; padding:24px 16px; background:#FFFFFF; border-radius:12px;">
        <div style="font-size:18px; font-weight:800; color:#1E1B4B; text-align:center;">${escapeHtml(siswa.nama)}</div>
        <div style="font-family:'IBM Plex Mono', monospace; font-size:13px; color:#4338CA; font-weight:700; background:#EEF2FF; padding:4px 14px; border-radius:16px;">
          NIS: ${escapeHtml(siswa.nis || '-')} • KELAS ${escapeHtml(siswa.kelas || '-')}
        </div>
        <div style="padding:14px; background:#FFFFFF; border:3px solid #1E1B4B; border-radius:18px; box-shadow:0 12px 30px rgba(0,0,0,0.12);">
          <img src="${qrUrl}" alt="QR" style="width:230px; height:230px; display:block;" />
        </div>
        <div style="font-size:12px; color:#64748B; text-align:center; max-width:280px;">
          Tingkatkan kecerahan layar HP saat memindai ke kamera scanner gerbang sekolah.
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" id="modal-cancel" style="width:100%;">Tutup</button>
      </div>
    `);
  });

  document.getElementById('btn-download-kartu')?.addEventListener('click', async () => {
    const qrUrl = await generateQrDataUrl(siswa.nis || siswa.id);
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `QR_Absen_${siswa.nama.replace(/\s+/g, '_')}_${siswa.nis || ''}.png`;
    a.click();
    toast('QR Code berhasil didownload', 'success');
  });

  // Mobile Floating QR Modal Trigger
  document.getElementById('btn-floating-qr')?.addEventListener('click', () => {
    openModal(`
      <div class="modal-head">
        <h3>Kartu QR Ananda</h3>
        <button class="close-x" id="modal-close">&times;</button>
      </div>
      <div class="modal-body" style="display:flex; justify-content:center; padding:16px 8px; background:var(--paper-dim);">
        ${cardHtml}
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" id="modal-cancel" style="width:100%;">Tutup</button>
      </div>
    `);
  });
}

// Generate visual attendance heatmap calendar
function generateAttendanceCalendarHtml(year, month, riwayat) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayIndex = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday = 0
  const daysOfWeek = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  let cells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(`<div class="cal-day empty"></div>`);
  }

  const todayStr = getTodayDateStr();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const rec = riwayat.find(r => r.tanggal === dayStr);
    const isToday = dayStr === todayStr;

    let dotClass = '';
    let dayStatusTooltip = '';

    if (rec) {
      if (rec.status === 'hadir') { dotClass = 'dot-hadir'; dayStatusTooltip = `Hadir: ${formatTimeDisplay(rec.jamMasuk)}`; }
      else if (rec.status === 'terlambat') { dotClass = 'dot-terlambat'; dayStatusTooltip = `Terlambat: ${formatTimeDisplay(rec.jamMasuk)}`; }
      else if (rec.status === 'izin' || rec.status === 'sakit') { dotClass = 'dot-izin'; dayStatusTooltip = rec.status.toUpperCase(); }
      else if (rec.status === 'alpa') { dotClass = 'dot-alpa'; dayStatusTooltip = 'Alpa'; }
    }

    cells.push(`
      <div class="cal-day ${isToday ? 'today' : ''} ${dotClass ? 'has-record' : ''}" title="${day} ${BULAN[month-1]}: ${dayStatusTooltip || 'Tidak ada jadwal'}">
        <span class="day-number">${day}</span>
        ${dotClass ? `<span class="cal-dot ${dotClass}"></span>` : ''}
      </div>
    `);
  }

  return `
    <div class="attendance-calendar">
      <div class="cal-weekdays">
        ${daysOfWeek.map(d => `<span>${d}</span>`).join('')}
      </div>
      <div class="cal-grid">
        ${cells.join('')}
      </div>
    </div>
  `;
}

// ==========================================
// BENDAHARA / ADMIN VIEW
// ==========================================
async function renderBendaharaAbsensiView(el) {
  const currentTab = store.ui.absensiTab || 'scan';
  const today = getTodayDateStr();
  const selectedDate = store.ui.absensiTanggal || today;
  const kelasList = [...new Set(store.state.siswa.map(s => s.kelas))].sort();

  el.innerHTML = `
    <!-- Top Action Bar with Tabs & Kiosk Mode Toggle -->
    <div class="absensi-header-nav" style="margin-bottom:18px;">
      <div class="tabs-container" style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn ${currentTab === 'scan' ? 'btn-primary' : 'btn-ghost'}" id="tab-scan" style="display:inline-flex; align-items:center; gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
          Scanner QR Absensi
        </button>
        <button class="btn ${currentTab === 'rekap' ? 'btn-primary' : 'btn-ghost'}" id="tab-rekap" style="display:inline-flex; align-items:center; gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Rekapitulasi Kehadiran
        </button>
        <button class="btn ${currentTab === 'kartu' ? 'btn-primary' : 'btn-ghost'}" id="tab-kartu" style="display:inline-flex; align-items:center; gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="12" y2="12"/></svg>
          Cetak Kartu Siswa QR
        </button>
      </div>

      ${currentTab === 'scan' ? `
        <button class="btn btn-secondary btn-kiosk-toggle" id="btn-toggle-kiosk" title="Aktifkan Mode Layar Penuh Gerbang">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          <span class="txt-kiosk">Mode Kiosk Gerbang</span>
        </button>
      ` : ''}
    </div>

    <div id="absensi-content"></div>
  `;

  // Tab switching
  document.getElementById('tab-scan')?.addEventListener('click', () => {
    store.ui.absensiTab = 'scan';
    renderAbsensi();
  });
  document.getElementById('tab-rekap')?.addEventListener('click', () => {
    stopScanner();
    store.ui.absensiTab = 'rekap';
    renderAbsensi();
  });
  document.getElementById('tab-kartu')?.addEventListener('click', () => {
    stopScanner();
    store.ui.absensiTab = 'kartu';
    renderAbsensi();
  });

  // Kiosk mode toggle
  document.getElementById('btn-toggle-kiosk')?.addEventListener('click', () => {
    toggleKioskMode();
  });

  const contentEl = document.getElementById('absensi-content');

  if (currentTab === 'scan') {
    await renderScanTab(contentEl);
  } else if (currentTab === 'rekap') {
    renderRekapTab(contentEl, selectedDate, kelasList);
  } else if (currentTab === 'kartu') {
    await renderKartuTab(contentEl, kelasList);
  }
}

function toggleKioskMode() {
  const isKiosk = document.body.classList.toggle('kiosk-mode-active');
  const btnKiosk = document.getElementById('btn-toggle-kiosk');
  if (btnKiosk) {
    btnKiosk.innerHTML = isKiosk ? `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
      <span>Keluar Kiosk</span>
    ` : `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      <span>Mode Kiosk Gerbang</span>
    `;
  }
  toast(isKiosk ? 'Mode Kiosk Layar Penuh Aktif' : 'Keluar dari Mode Kiosk', 'info');
}

// ------------------------------------------
// TAB 1: SCANNER QR
// ------------------------------------------
async function renderScanTab(container) {
  const jamMasuk = store.state.settings.jamMasuk || '07:15';
  const jamPulang = store.state.settings.jamPulang || '14:00';
  const today = getTodayDateStr();

  // Get today's stats
  const stats = getStatistikAbsensi(today);

  // Get today's recent scans (latest 10)
  const todayScans = (store.state.absensi || [])
    .filter(a => a.tanggal === today)
    .sort((a, b) => (b.waktuScanPulang || b.waktuScanMasuk || 0) - (a.waktuScanPulang || a.waktuScanMasuk || 0))
    .slice(0, 10);

  container.innerHTML = `
    <!-- Top Live Stats & Digital Clock Header -->
    <div class="kiosk-live-header" style="margin-bottom:18px;">
      <div class="kiosk-clock-box">
        <div class="clock-date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </div>
        <div class="clock-time" id="kiosk-live-clock">00:00:00 <span class="clock-tz">WIB</span></div>
        <div class="clock-shift">
          <span class="shift-pill">Batas Masuk ≤ <strong>${jamMasuk}</strong></span>
          <span class="shift-pill pulang">Jadwal Pulang ≥ <strong>${jamPulang}</strong></span>
        </div>
      </div>
      <div class="kiosk-counters">
        <div class="k-stat gold" title="Siswa Masuk Tepat Waktu">
          <span class="k-val">${stats.hadir}</span>
          <span class="k-lbl">✓ Tepat Waktu</span>
        </div>
        <div class="k-stat warning" title="Siswa Masuk Terlambat">
          <span class="k-val">${stats.terlambat}</span>
          <span class="k-lbl">! Terlambat</span>
        </div>
        <div class="k-stat blue" title="Siswa Izin / Sakit Hari Ini">
          <span class="k-val">${stats.izin + stats.sakit}</span>
          <span class="k-lbl">Izin / Sakit</span>
        </div>
        <div class="k-stat gray" title="Siswa Belum Melakukan Absensi">
          <span class="k-val">${stats.belumHadir}</span>
          <span class="k-lbl">Belum Hadir</span>
        </div>
      </div>
    </div>

    <div class="scanner-kiosk-layout">
      <!-- Scanner Camera Column -->
      <div class="card scanner-box-card" style="padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h3 style="margin:0; font-size:16px;">Pemindai Kamera QR</h3>
              <span class="scanner-live-badge" id="scanner-status-badge">
                <span class="dot-radar"></span>
                <span>Siap</span>
              </span>
            </div>
            <div class="card-sub" style="font-size:12px; margin-top:2px;">Arahkan kartu QR siswa ke kamera gerbang sekolah</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-sm btn-outline btn-fs-trigger" id="btn-camera-fullscreen" title="Buka Layar Penuh (Shortcut: F)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
              <span>Layar Penuh</span>
              <kbd class="key-hint">F</kbd>
            </button>
          </div>
        </div>

        <!-- Futuristic Camera Viewport Box with Brackets & Laser -->
        <div class="qr-camera-wrapper" id="qr-camera-wrapper">
          <!-- Fullscreen Floating Header (Visible in fullscreen mode) -->
          <div class="camera-fs-header" id="camera-fs-header">
            <div class="camera-fs-brand">
              <div class="fs-logo-glow">
                <span class="fs-pulse-dot"></span>
              </div>
              <div>
                <div class="fs-brand-title">EduPass <span class="fs-badge-ai">GATE SENSOR</span></div>
                <div class="fs-brand-sub" id="fs-clock-sub">Memuat jam...</div>
              </div>
            </div>
            <div class="camera-fs-stats" id="camera-fs-stats">
              <span class="fs-stat-pill green" title="Hadir Tepat Waktu">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <strong id="fs-stat-hadir">${stats.hadir}</strong> Hadir
              </span>
              <span class="fs-stat-pill yellow" title="Terlambat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <strong id="fs-stat-terlambat">${stats.terlambat}</strong> Terlambat
              </span>
              <span class="fs-stat-pill gray" title="Belum Absen">
                <strong id="fs-stat-belum">${stats.belumHadir}</strong> Belum
              </span>
            </div>
            <div class="camera-fs-actions">
              <!-- Mode Scan Toggle -->
              <button class="btn-fs-icon" id="btn-fs-scan-mode" title="Ubah Bentuk Bidik (QR Persegi / Barcode Lebar)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                <span id="txt-fs-mode">QR</span>
              </button>
              <!-- Mirror Video Toggle -->
              <button class="btn-fs-icon" id="btn-fs-mirror" title="Cermin / Balik Video Kamera">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
                <span>Mirror</span>
              </button>
              <!-- Zoom Cycle -->
              <button class="btn-fs-icon" id="btn-fs-zoom" title="Atur Perbesaran Zoom (1x, 1.5x, 2x)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                <span id="txt-fs-zoom">1x</span>
              </button>
              <!-- Torch / Flashlight -->
              <button class="btn-fs-icon" id="btn-fs-torch" title="Senter Lampu Kamera">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>Flash</span>
              </button>
              <!-- Camera Switch -->
              <button class="btn-fs-icon" id="btn-fs-camera-switch" title="Ganti / Balik Kamera (Depan/Belakang)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
                <span>Kamera</span>
              </button>
              <!-- Audio Beep -->
              <button class="btn-fs-icon" id="btn-fs-audio-toggle" title="Toggle Suara Beep">
                <svg id="fs-audio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <span id="fs-audio-text">Beep ON</span>
              </button>
              <!-- Keluar Fullscreen -->
              <button class="btn-fs-icon btn-fs-exit" id="btn-fs-exit" title="Keluar Layar Penuh (Esc)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>Keluar (Esc)</span>
              </button>
            </div>
          </div>

          <!-- Quick Fullscreen Button in Normal mode (Top-right corner) -->
          <button id="btn-quick-fullscreen" class="quick-fs-btn" title="Layar Penuh (Shortcut: F)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>

          <!-- The QR Reader Video Element Container -->
          <div id="qr-reader" style="width:100%; border-radius:12px; overflow:hidden; background:#070A11; min-height:280px; position:relative;">
            <div class="qr-placeholder" id="qr-placeholder">
              <div class="qr-placeholder-glow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:48px;height:48px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              </div>
              <div class="placeholder-title">Sensor Kamera Siap Digunakan</div>
              <div class="placeholder-sub">Klik tombol di bawah untuk mengaktifkan pemindai langsung</div>
              <button class="btn btn-primary" id="btn-placeholder-start" style="margin-top:14px; padding:8px 22px; font-weight:600; font-size:13px; border-radius:30px; display:inline-flex; align-items:center; gap:8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Aktifkan Kamera Sekarang
              </button>
            </div>
          </div>

          <!-- Futuristic Target Brackets [ + ] Viewfinder Reticle -->
          <div class="camera-target-brackets" id="camera-brackets">
            <span class="bracket top-left"><span class="bracket-tick"></span></span>
            <span class="bracket top-right"><span class="bracket-tick"></span></span>
            <span class="bracket bottom-left"><span class="bracket-tick"></span></span>
            <span class="bracket bottom-right"><span class="bracket-tick"></span></span>
            
            <div class="target-radar-ring"></div>
            <div class="target-crosshair">
              <span class="cross-line h"></span>
              <span class="cross-line v"></span>
              <span class="center-dot"></span>
            </div>

            <div class="target-hud-tag">
              <span class="hud-pulse-radar"></span>
              <span>FOCUS AREA • SMART SCANNER</span>
            </div>

            <div class="fs-scan-guide">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
              <span>Arahkan Kartu Pelajar / Barcode ke Sini</span>
            </div>
          </div>

          <div class="scanner-laser" id="scanner-laser" style="display:none;"></div>

          <!-- Fullscreen Floating Scan Result Toast / HUD -->
          <div class="camera-fs-toast" id="camera-fs-toast" style="display:none;"></div>
        </div>

        <!-- Camera Device Selector & Main Start/Stop -->
        <div style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; align-items:center;">
          <select id="camera-select" style="flex:1; min-width:160px; font-size:12.5px; padding:7px 12px; border-radius:var(--radius);">
            <option value="">Memuat daftar kamera...</option>
          </select>
          <button class="btn btn-primary" id="btn-toggle-camera" style="padding:8px 16px; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Mulai Kamera
          </button>
          <button class="btn btn-outline" id="btn-expand-camera" title="Layar Penuh" style="padding:8px 12px; font-size:13px; display:inline-flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            <span>Fullscreen</span>
          </button>
        </div>

        <!-- Fleksibilitas Toolbar Kamera (Zoom, Mirror, Mode Barcode, Scan File, Senter) -->
        <div class="camera-flex-toolbar">
          <div class="flex-tool-row">
            <!-- Mode Bidik -->
            <div class="flex-tool-group">
              <span class="tool-label">Mode:</span>
              <div class="btn-group-pill">
                <button class="btn-pill-opt active" id="btn-mode-qr" title="Bidik Persegi untuk Kartu QR Code">⏹ QR</button>
                <button class="btn-pill-opt" id="btn-mode-barcode" title="Bidik Lebar Memanjang untuk Barcode Garis 1D">▰ Barcode</button>
              </div>
            </div>

            <!-- Zoom Presets -->
            <div class="flex-tool-group">
              <span class="tool-label">Zoom:</span>
              <div class="btn-group-pill">
                <button class="btn-pill-opt active" id="btn-zoom-1x" title="Zoom Normal 1x">1x</button>
                <button class="btn-pill-opt" id="btn-zoom-15x" title="Zoom 1.5x">1.5x</button>
                <button class="btn-pill-opt" id="btn-zoom-2x" title="Zoom 2x">2x</button>
              </div>
            </div>
          </div>

          <div class="flex-tool-row secondary" style="margin-top:8px;">
            <button class="btn-flex-action" id="btn-toggle-mirror" title="Cermin / Balik Video Kamera Secara Horizontal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
              <span>Mirror</span>
            </button>
            <button class="btn-flex-action" id="btn-toggle-torch" title="Senter Lampu Kamera (jika didukung perangkat)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>Senter</span>
            </button>
            <button class="btn-flex-action" id="btn-pause-scanner" title="Jeda Sementara Pemindaian">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
              <span>Jeda</span>
            </button>
            <label class="btn-flex-action" id="label-upload-qr" title="Scan dari File Foto / Gambar Galeri">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Scan Foto</span>
              <input type="file" id="input-qr-file" accept="image/*" style="display:none;">
            </label>
          </div>
        </div>

        <!-- Scanner Info and Manual / USB Barcode Input -->
        <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--line);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:12px; font-weight:600; color:var(--ink-soft); display:flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="11" y1="8" x2="11" y2="16"/><line x1="15" y1="8" x2="15" y2="16"/><line x1="17" y1="8" x2="17" y2="16"/></svg>
              Scan Barcode USB / Input Manual NIS:
            </div>
            <span style="font-size:11px; color:var(--ink-soft); background:var(--paper-dim); padding:2px 8px; border-radius:10px;">Tekan Enter</span>
          </div>
          <div style="display:flex; gap:8px;">
            <input type="text" id="manual-scan-input" placeholder="Scan kartu barcode / ketik NIS..." style="flex:1; font-family:'IBM Plex Mono',monospace; font-size:13px; padding:8px 12px;" autocomplete="off">
            <button class="btn btn-secondary" id="btn-manual-scan" style="padding:8px 16px; font-weight:600;">Catat</button>
          </div>
          <div class="helper-text" style="margin-top:6px; font-size:11.5px; color:var(--ink-soft);">
            Kompatibel dengan barcode scanner USB / wireless bluetooth tanpa kamera.
          </div>
        </div>
      </div>

      <!-- Live Scan Feedback & Recent Scans Column -->
      <div class="scanner-activity-column">
        <!-- Instant Notification Popup Result Card -->
        <div id="scan-feedback-container" style="min-height:95px; margin-bottom:16px;">
          <div class="scan-idle-state-box">
            <div class="idle-radar-pulse">
              <span class="idle-dot"></span>
            </div>
            <div>
              <div style="font-weight:700; font-size:14px; color:var(--ink);">Menunggu Kartu Siswa</div>
              <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">Arahkan kartu QR ke kamera atau scan kode barcode dengan USB reader</div>
            </div>
          </div>
        </div>

        <!-- Live Feed: 10 Scan Terakhir Hari Ini -->
        <div class="card" style="padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <h3 style="margin:0; font-size:15px;">Aktivitas Terkini (Hari Ini)</h3>
              <span class="live-pulse-badge">Live</span>
            </div>
            <span style="font-size:12px; color:var(--ink-soft); font-family:'IBM Plex Mono',monospace;">${todayScans.length} siswa terakhir</span>
          </div>

          <div class="table-scroll">
            <table style="font-size:13px;">
              <thead>
                <tr>
                  <th style="width:95px;">Waktu</th>
                  <th>Nama Siswa</th>
                  <th>Kelas</th>
                  <th>Status</th>
                  <th style="width:70px; text-align:center;">WA</th>
                </tr>
              </thead>
              <tbody id="live-feed-tbody">
                ${todayScans.length === 0 ? `
                  <tr><td colspan="5" style="text-align:center; padding:24px; color:var(--ink-soft);">Belum ada siswa yang absen hari ini.</td></tr>
                ` : todayScans.map(s => {
                  const siswa = store.state.siswa.find(x => x.id === s.siswaId);
                  const nama = siswa ? escapeHtml(siswa.nama) : 'Siswa Terhapus';
                  const initials = nama.substring(0, 2).toUpperCase();
                  const kelas = siswa ? escapeHtml(siswa.kelas) : '-';
                  let statusHtml = '';
                  if (s.status === 'hadir') statusHtml = '<span class="badge lunas">Tepat Waktu</span>';
                  else if (s.status === 'terlambat') statusHtml = '<span class="badge parsial">Terlambat</span>';
                  else if (s.status === 'izin') statusHtml = '<span class="badge" style="background:var(--blue-soft);color:var(--blue);">Izin</span>';
                  else if (s.status === 'sakit') statusHtml = '<span class="badge" style="background:var(--gold-soft);color:var(--gold);">Sakit</span>';
                  else statusHtml = '<span class="badge nunggak">Alpa</span>';

                  const waktu = s.jamPulang ? `Pulang ${formatTimeDisplay(s.jamPulang)}` : `Masuk ${formatTimeDisplay(s.jamMasuk)}`;
                  const waUrl = siswa ? formatWaLinkAbsensi(siswa, s) : null;

                  return `
                    <tr>
                      <td class="monospace" style="color:var(--ink-soft); font-size:12px;">${waktu}</td>
                      <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span class="mini-avatar">${initials}</span>
                          <strong>${nama}</strong>
                        </div>
                      </td>
                      <td><span class="kelas-chip">${kelas}</span></td>
                      <td>${statusHtml}</td>
                      <td style="text-align:center;">
                        ${waUrl ? `
                          <a href="${waUrl}" target="_blank" class="btn btn-sm btn-wa-notify" title="Kirim Konfirmasi WA ke Orang Tua">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                            <span>WA</span>
                          </a>
                        ` : '<span style="color:var(--line);">-</span>'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  // Start digital clock timer
  startLiveClock();

  // Attach camera and manual scan logic
  setupScannerController();
}

function getTodayAttendanceStats() {
  return getStatistikAbsensi(getTodayDateStr());
}

let fsToastTimer = null;
let availableCamerasList = [];

export function toggleCameraFullscreen(forceState) {
  const wrapper = document.getElementById('qr-camera-wrapper');
  if (!wrapper) return;

  const isCurrentlyFs = wrapper.classList.contains('camera-fullscreen-active');
  const shouldBeFs = forceState !== undefined ? forceState : !isCurrentlyFs;

  if (shouldBeFs) {
    wrapper.classList.add('camera-fullscreen-active');
    document.body.classList.add('camera-fs-body-lock');

    // Sync stats in Fullscreen HUD
    const stats = getTodayAttendanceStats();
    const fsHadir = document.getElementById('fs-stat-hadir');
    const fsTerlambat = document.getElementById('fs-stat-terlambat');
    const fsBelum = document.getElementById('fs-stat-belum');
    if (fsHadir) fsHadir.textContent = stats.hadir;
    if (fsTerlambat) fsTerlambat.textContent = stats.terlambat;
    if (fsBelum) fsBelum.textContent = stats.belumHadir;

    // Optional Native Fullscreen
    if (wrapper.requestFullscreen && !document.fullscreenElement) {
      wrapper.requestFullscreen().catch(() => {});
    }

    // Auto-start camera if not already active
    if (!isScannerRunning) {
      const cameraSelect = document.getElementById('camera-select');
      startCamera(cameraSelect?.value || '');
    }

    toast('Mode Layar Penuh Kamera Aktif (Tekan Esc untuk keluar)', 'info');
  } else {
    wrapper.classList.remove('camera-fullscreen-active');
    document.body.classList.remove('camera-fs-body-lock');
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

function startLiveClock() {
  const clockEl = document.getElementById('kiosk-live-clock');

  const updateClock = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    if (clockEl) {
      clockEl.innerHTML = `${h}:${m}:${s} <span class="clock-tz">WIB</span>`;
    }
    const fsClock = document.getElementById('fs-clock-sub');
    if (fsClock) {
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const dayName = days[now.getDay()];
      const d = now.getDate();
      const monthName = months[now.getMonth()];
      fsClock.textContent = `${dayName}, ${d} ${monthName} • ${h}:${m}:${s} WIB`;
    }
  };

  updateClock();
  clockTimer = setInterval(updateClock, 1000);
}

// Setup Camera and Scanning logic
async function setupScannerController() {
  const cameraSelect = document.getElementById('camera-select');
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const manualInput = document.getElementById('manual-scan-input');
  const btnManualScan = document.getElementById('btn-manual-scan');

  // Fullscreen Buttons
  const btnCameraFs = document.getElementById('btn-camera-fullscreen');
  const btnQuickFs = document.getElementById('btn-quick-fullscreen');
  const btnExpandCamera = document.getElementById('btn-expand-camera');
  const btnFsExit = document.getElementById('btn-fs-exit');
  const btnFsAudio = document.getElementById('btn-fs-audio-toggle');
  const btnFsCameraSwitch = document.getElementById('btn-fs-camera-switch');
  const btnPlaceholderStart = document.getElementById('btn-placeholder-start');

  btnCameraFs?.addEventListener('click', () => toggleCameraFullscreen(true));
  btnQuickFs?.addEventListener('click', () => toggleCameraFullscreen(true));
  btnExpandCamera?.addEventListener('click', () => toggleCameraFullscreen(true));
  btnFsExit?.addEventListener('click', () => toggleCameraFullscreen(false));
  btnPlaceholderStart?.addEventListener('click', () => btnToggleCamera?.click());

  // Audio Toggle in Fullscreen HUD
  const updateAudioUi = (isOn) => {
    const audioText = document.getElementById('fs-audio-text');
    if (audioText) audioText.textContent = isOn ? 'Beep ON' : 'Mute';
    if (btnFsAudio) {
      btnFsAudio.classList.toggle('muted', !isOn);
    }
  };

  const initialBeep = store.state?.settings?.beepAudio !== false;
  updateAudioUi(initialBeep);

  btnFsAudio?.addEventListener('click', () => {
    const s = store.state.settings || {};
    const newState = s.beepAudio === false;
    s.beepAudio = newState;
    s.absensiBeepAudio = newState;
    saveData();
    updateAudioUi(newState);
    toast(newState ? 'Suara beep diaktifkan 🔔' : 'Suara beep dimatikan 🔕', 'info');
  });

  // Switch camera inside Fullscreen HUD
  btnFsCameraSwitch?.addEventListener('click', async () => {
    if (availableCamerasList && availableCamerasList.length > 1) {
      const currentIndex = availableCamerasList.findIndex(c => c.id === currentCameraId);
      const nextIndex = (currentIndex + 1) % availableCamerasList.length;
      currentCameraId = availableCamerasList[nextIndex].id;
      if (cameraSelect) cameraSelect.value = currentCameraId;
      toast(`Kamera beralih ke: ${availableCamerasList[nextIndex].label || 'Kamera ' + (nextIndex + 1)}`, 'info');
      if (isScannerRunning) {
        await stopScanner();
        await startCamera(currentCameraId);
      }
    } else {
      toast('Hanya 1 perangkat kamera yang terdeteksi', 'info');
    }
  });

  // Mode Scan Toggle (QR vs Barcode)
  const setScanMode = (mode) => {
    currentScanMode = mode;
    updateScanModeUi();
    toast(mode === 'barcode' ? 'Mode Barcode 1D Aktif (Bidik Garis)' : 'Mode QR Code Aktif (Bidik Persegi)', 'info');
  };

  document.getElementById('btn-mode-qr')?.addEventListener('click', () => setScanMode('qr'));
  document.getElementById('btn-mode-barcode')?.addEventListener('click', () => setScanMode('barcode'));
  document.getElementById('btn-fs-scan-mode')?.addEventListener('click', () => {
    setScanMode(currentScanMode === 'qr' ? 'barcode' : 'qr');
  });

  // Mirror Camera Toggle
  const toggleMirror = () => {
    isCameraMirrored = !isCameraMirrored;
    updateMirrorUi();
    toast(isCameraMirrored ? 'Mode Cermin (Mirror) Aktif' : 'Mode Cermin Nonaktif', 'info');
  };
  document.getElementById('btn-toggle-mirror')?.addEventListener('click', toggleMirror);
  document.getElementById('btn-fs-mirror')?.addEventListener('click', toggleMirror);

  // Zoom Level Presets
  const setZoom = (z) => {
    currentZoomLevel = z;
    updateZoomUi();
    toast(`Zoom Kamera: ${z}x`, 'info');
  };
  document.getElementById('btn-zoom-1x')?.addEventListener('click', () => setZoom(1.0));
  document.getElementById('btn-zoom-15x')?.addEventListener('click', () => setZoom(1.5));
  document.getElementById('btn-zoom-2x')?.addEventListener('click', () => setZoom(2.0));
  document.getElementById('btn-fs-zoom')?.addEventListener('click', () => {
    const nextZoom = currentZoomLevel === 1.0 ? 1.5 : (currentZoomLevel === 1.5 ? 2.0 : 1.0);
    setZoom(nextZoom);
  });

  // Torch / Flashlight
  document.getElementById('btn-toggle-torch')?.addEventListener('click', toggleTorch);
  document.getElementById('btn-fs-torch')?.addEventListener('click', toggleTorch);

  // Pause / Resume Scanner
  document.getElementById('btn-pause-scanner')?.addEventListener('click', toggleScannerPause);

  // Scan from Image File
  const fileInput = document.getElementById('input-qr-file');
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await scanImageFile(file);
      fileInput.value = '';
    }
  });

  // Initial UI sync
  updateScanModeUi();
  updateMirrorUi();
  updateZoomUi();

  // Global keydown: 'F' key toggles fullscreen, 'Escape' exits
  window.removeEventListener('keydown', onKeyDownFs);
  window.addEventListener('keydown', onKeyDownFs);

  // Sync state if user exits via browser native Escape key
  document.removeEventListener('fullscreenchange', onFsChange);
  document.addEventListener('fullscreenchange', onFsChange);

  // Focus manual input
  setTimeout(() => manualInput?.focus(), 200);

  // Manual Scan handler
  const handleManual = () => {
    const val = manualInput.value.trim();
    if (!val) return;
    manualInput.value = '';
    onQrDetected(val);
  };

  btnManualScan?.addEventListener('click', handleManual);
  manualInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManual();
    }
  });

  // Get available video devices
  try {
    const cameras = await Html5Qrcode.getCameras();
    availableCamerasList = cameras || [];
    if (cameras && cameras.length > 0) {
      cameraSelect.innerHTML = cameras.map((c, i) => `
        <option value="${c.id}" ${i === 0 ? 'selected' : ''}>${escapeHtml(c.label || `Kamera ${i + 1}`)}</option>
      `).join('');
      currentCameraId = cameras[0].id;
    } else {
      cameraSelect.innerHTML = '<option value="">Tidak ada kamera terdeteksi</option>';
    }
  } catch (err) {
    cameraSelect.innerHTML = '<option value="">Izin kamera ditolak / tidak tersedia</option>';
  }

  cameraSelect?.addEventListener('change', async (e) => {
    currentCameraId = e.target.value;
    if (isScannerRunning) {
      await stopScanner();
      await startCamera(currentCameraId);
    }
  });

  btnToggleCamera?.addEventListener('click', async () => {
    if (isScannerRunning) {
      await stopScanner();
      btnToggleCamera.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Mulai Kamera
      `;
      btnToggleCamera.className = 'btn btn-primary';
      const placeholder = document.getElementById('qr-placeholder');
      if (placeholder) placeholder.style.display = 'flex';
      const laser = document.getElementById('scanner-laser');
      if (laser) laser.style.display = 'none';
      const badge = document.getElementById('scanner-status-badge');
      if (badge) {
        badge.innerHTML = `<span class="dot-radar off"></span><span>Kamera Mati</span>`;
      }
    } else {
      await startCamera(cameraSelect.value);
    }
  });
}

async function startCamera(cameraId) {
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const laser = document.getElementById('scanner-laser');
  const badge = document.getElementById('scanner-status-badge');
  const placeholder = document.getElementById('qr-placeholder');

  try {
    if (!activeHtml5QrCode) {
      activeHtml5QrCode = new Html5Qrcode('qr-reader');
    }

    if (placeholder) placeholder.style.display = 'none';

    // Dynamic flexible qrbox calculation based on currentScanMode
    const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
      if (currentScanMode === 'barcode') {
        const w = Math.min(Math.floor(viewfinderWidth * 0.85), 360);
        const h = Math.min(Math.floor(viewfinderHeight * 0.45), 180);
        return { width: Math.max(w, 200), height: Math.max(h, 100) };
      }
      const s = Math.min(Math.floor(minEdge * 0.75), 260);
      return { width: Math.max(s, 180), height: Math.max(s, 180) };
    };

    const config = {
      fps: 20,
      qrbox: qrboxFunction
    };

    const cameraParam = cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' };

    await activeHtml5QrCode.start(
      cameraParam,
      config,
      (decodedText) => {
        if (!isScannerPaused) {
          onQrDetected(decodedText);
        }
      },
      (error) => {}
    );

    isScannerRunning = true;
    isScannerPaused = false;
    applyCameraTransform();

    if (laser) laser.style.display = 'block';
    if (badge) {
      badge.innerHTML = `<span class="dot-radar"></span><span>Live</span>`;
    }
    if (btnToggleCamera) {
      btnToggleCamera.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        Hentikan Kamera
      `;
      btnToggleCamera.className = 'btn btn-danger';
    }
  } catch (err) {
    console.error('Failed to start camera', err);
    toast('Gagal mengakses kamera: ' + (err?.message || err), 'error');
    if (placeholder) placeholder.style.display = 'flex';
  }
}

// Handle QR Scanned Event
let scanLock = false;
function onQrDetected(code) {
  if (scanLock) return;
  scanLock = true;
  setTimeout(() => { scanLock = false; }, 1800); // Debounce detector

  const result = catatAbsenByKode(code);
  const container = document.getElementById('scan-feedback-container');

  if (!result.success) {
    if (container) {
      container.innerHTML = `
        <div class="card scan-alert scan-error" style="background:#fef2f2; border:1px solid #f87171; padding:16px; display:flex; align-items:center; gap:14px; animation:shake 0.4s ease;">
          <div style="width:40px;height:40px;border-radius:50%;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
          <div>
            <div style="font-weight:600; color:#991b1b; font-size:14px;">Kartu Tidak Dikenali!</div>
            <div style="font-size:12.5px; color:#b91c1c;">${escapeHtml(result.message)}</div>
          </div>
        </div>
      `;
    }

    const fsToast = document.getElementById('camera-fs-toast');
    if (fsToast) {
      if (fsToastTimer) clearTimeout(fsToastTimer);
      fsToast.style.display = 'block';
      fsToast.innerHTML = `
        <div class="fs-toast-inner error">
          <div style="width:44px;height:44px;border-radius:50%;background:rgba(239,68,68,0.25);color:#EF4444;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
          <div class="fs-toast-info">
            <div class="fs-toast-name">Kartu Tidak Dikenali!</div>
            <div class="fs-toast-msg">${escapeHtml(result.message)}</div>
          </div>
          <div class="fs-toast-badge-wrap">
            <span class="fs-toast-badge error">Gagal</span>
          </div>
        </div>
      `;
      fsToastTimer = setTimeout(() => {
        fsToast.style.display = 'none';
      }, 3500);
    }

    toast(result.message, 'error');
    return;
  }

  const { siswa, status, type, message, record } = result;

  let badgeColor = '#10b981';
  let badgeBg = '#ecfdf5';
  let badgeText = 'Tepat Waktu';
  let iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  if (type === 'pulang') {
    badgeColor = '#3b82f6';
    badgeBg = '#eff6ff';
    badgeText = 'Absen Pulang';
  } else if (status === 'terlambat') {
    badgeColor = '#d97706';
    badgeBg = '#fef3c7';
    badgeText = 'Terlambat';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  } else if (type === 'duplicate' || type === 'completed') {
    badgeColor = '#6b7280';
    badgeBg = '#f3f4f6';
    badgeText = 'Sudah Tercatat';
  }

  const waLink = formatWaLinkAbsensi(siswa, record);

  // Normal Card feedback
  if (container) {
    container.innerHTML = `
      <div class="card scan-alert scan-success verified-card ${status === 'terlambat' ? 'terlambat' : 'hadir'}" style="border:2px solid ${badgeColor};">
        <div style="display:flex; align-items:center; gap:16px;">
          <div class="verified-avatar-box">
            <div class="verified-avatar" style="background:${badgeBg}; color:${badgeColor}; border:2px solid ${badgeColor};">
              ${iconSvg}
            </div>
            <div class="verified-wave">
              <span class="w-bar" style="background:${badgeColor};"></span>
              <span class="w-bar" style="background:${badgeColor};"></span>
              <span class="w-bar" style="background:${badgeColor};"></span>
            </div>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="verified-student-name">${escapeHtml(siswa.nama)}</span>
              <span class="kelas-chip">${escapeHtml(siswa.kelas)}</span>
            </div>
            <div style="font-size:12.5px; color:var(--ink-soft); margin-top:2px;">
              NIS: <span class="monospace font-bold">${escapeHtml(siswa.nis || '-')}</span> • <span class="monospace">${formatTimeDisplay(record.jamPulang || record.jamMasuk)}</span>
            </div>
            <div style="font-size:12.5px; color:${badgeColor}; font-weight:600; margin-top:3px;">
              ✓ ${escapeHtml(message)}
            </div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
          <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-size:13px; padding:6px 14px; font-weight:700;">${badgeText}</span>
          ${waLink ? `
            <a href="${waLink}" target="_blank" class="btn btn-sm btn-wa-notify" title="Kirim Notifikasi Langsung ke WhatsApp Orang Tua">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span>Kirim WA</span>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Fullscreen HUD Toast
  const fsToast = document.getElementById('camera-fs-toast');
  if (fsToast) {
    if (fsToastTimer) clearTimeout(fsToastTimer);
    fsToast.style.display = 'block';
    fsToast.innerHTML = `
      <div class="fs-toast-inner ${status === 'terlambat' ? 'terlambat' : 'hadir'}">
        <div class="fs-toast-avatar-box">
          <div class="fs-toast-avatar ${status === 'terlambat' ? 'terlambat' : 'hadir'}">
            ${escapeHtml(siswa.nama.substring(0, 2).toUpperCase())}
          </div>
          <div class="fs-wave-bars">
            <span class="fb1"></span>
            <span class="fb2"></span>
            <span class="fb3"></span>
          </div>
        </div>
        <div class="fs-toast-info">
          <div class="fs-toast-top-row">
            <span class="fs-toast-tag ${status === 'terlambat' ? 'terlambat' : 'hadir'}">${badgeText}</span>
            <span class="fs-toast-time">${formatTimeDisplay(record.jamPulang || record.jamMasuk)}</span>
          </div>
          <div class="fs-toast-name">${escapeHtml(siswa.nama)}</div>
          <div class="fs-toast-meta">
            Kelas <strong>${escapeHtml(siswa.kelas)}</strong> • NIS <span class="monospace">${escapeHtml(siswa.nis || '-')}</span>
          </div>
          <div class="fs-toast-msg">${escapeHtml(message)}</div>
        </div>
        <div class="fs-toast-badge-wrap">
          ${waLink ? `
            <a href="${waLink}" target="_blank" class="fs-toast-wa" title="Kirim WA Orang Tua">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span>Kirim WA</span>
            </a>
          ` : ''}
        </div>
        <div class="fs-toast-progress-bar">
          <div class="fs-progress-fill"></div>
        </div>
      </div>
    `;
    fsToastTimer = setTimeout(() => {
      fsToast.style.display = 'none';
    }, 4500);
  }

  // Live stats pills in Fullscreen HUD
  const statsNow = getTodayAttendanceStats();
  const fsHadir = document.getElementById('fs-stat-hadir');
  const fsTerlambat = document.getElementById('fs-stat-terlambat');
  const fsBelum = document.getElementById('fs-stat-belum');
  if (fsHadir) fsHadir.textContent = statsNow.hadir;
  if (fsTerlambat) fsTerlambat.textContent = statsNow.terlambat;
  if (fsBelum) fsBelum.textContent = statsNow.belumHadir;

  toast(message, status === 'terlambat' ? 'warning' : 'success');

  // Update Live Feed table
  updateLiveFeedTbody();
}

function updateLiveFeedTbody() {
  const tbody = document.getElementById('live-feed-tbody');
  if (!tbody) return;

  const today = getTodayDateStr();
  const todayScans = (store.state.absensi || [])
    .filter(a => a.tanggal === today)
    .sort((a, b) => (b.waktuScanPulang || b.waktuScanMasuk || 0) - (a.waktuScanPulang || a.waktuScanMasuk || 0))
    .slice(0, 10);

  if (todayScans.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--ink-soft);">Belum ada siswa yang absen hari ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = todayScans.map(s => {
    const siswa = store.state.siswa.find(x => x.id === s.siswaId);
    const nama = siswa ? escapeHtml(siswa.nama) : 'Siswa Terhapus';
    const kelas = siswa ? escapeHtml(siswa.kelas) : '-';
    let statusHtml = '';
    if (s.status === 'hadir') statusHtml = '<span class="badge lunas">Tepat Waktu</span>';
    else if (s.status === 'terlambat') statusHtml = '<span class="badge parsial">Terlambat</span>';
    else if (s.status === 'izin') statusHtml = '<span class="badge" style="background:var(--blue-soft);color:var(--blue);">Izin</span>';
    else if (s.status === 'sakit') statusHtml = '<span class="badge" style="background:var(--gold-soft);color:var(--gold);">Sakit</span>';
    else statusHtml = '<span class="badge nunggak">Alpa</span>';

    const waktu = s.jamPulang ? `Pulang ${formatTimeDisplay(s.jamPulang)}` : `Masuk ${formatTimeDisplay(s.jamMasuk)}`;
    const waUrl = siswa ? formatWaLinkAbsensi(siswa, s) : null;

    return `
      <tr>
        <td class="monospace" style="color:var(--ink-soft);">${waktu}</td>
        <td><strong>${nama}</strong></td>
        <td><span class="kelas-chip">${kelas}</span></td>
        <td>${statusHtml}</td>
        <td style="text-align:center;">
          ${waUrl ? `
            <a href="${waUrl}" target="_blank" class="btn btn-sm" style="background:#25D366; color:#fff; padding:3px 8px; border:none; display:inline-flex; align-items:center; gap:4px; font-size:11px;" title="Kirim WA ke Orang Tua">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              WA
            </a>
          ` : '<span style="color:var(--line);">-</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

// ------------------------------------------
// TAB 2: REKAPITULASI & RIWAYAT
// ------------------------------------------
function renderRekapTab(container, selectedDate, kelasList) {
  const kelasFilter = store.ui.absensiKelasFilter || '';
  const statusFilter = store.ui.absensiStatusFilter || '';
  const stats = getStatistikAbsensi(selectedDate, kelasFilter);

  // Filter students
  const filteredStudents = store.state.siswa.filter(s => {
    if (kelasFilter && s.kelas !== kelasFilter) return false;
    const rec = stats.records.find(r => r.siswaId === s.id);
    const currentStatus = rec ? rec.status : 'belum';
    if (statusFilter && currentStatus !== statusFilter) return false;
    return true;
  }).sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

  container.innerHTML = `
    <!-- Filter Toolbar -->
    <div class="toolbar" style="margin-bottom:16px;">
      <div class="toolbar-left" style="flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <label style="font-weight:600; font-size:13px; color:var(--ink);">Tanggal:</label>
          <input type="date" id="rekap-date-picker" value="${selectedDate}" style="font-size:13px; padding:6px 10px; background:var(--paper);">
        </div>
        <select id="rekap-kelas-filter">
          <option value="">Semua Kelas</option>
          ${kelasList.map(k => `<option value="${escapeAttr(k)}" ${kelasFilter === k ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
        </select>
        <select id="rekap-status-filter">
          <option value="">Semua Status</option>
          <option value="hadir" ${statusFilter === 'hadir' ? 'selected' : ''}>Hadir Tepat Waktu</option>
          <option value="terlambat" ${statusFilter === 'terlambat' ? 'selected' : ''}>Terlambat</option>
          <option value="izin" ${statusFilter === 'izin' ? 'selected' : ''}>Izin</option>
          <option value="sakit" ${statusFilter === 'sakit' ? 'selected' : ''}>Sakit</option>
          <option value="alpa" ${statusFilter === 'alpa' ? 'selected' : ''}>Alpa</option>
          <option value="belum" ${statusFilter === 'belum' ? 'selected' : ''}>Belum Hadir</option>
        </select>
      </div>
      <div class="toolbar-right" style="gap:8px;">
        <button class="btn btn-secondary" id="btn-catat-manual">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M12 5v14M5 12h14"/></svg>
          Catat Manual / Izin
        </button>
        <button class="btn btn-primary" id="btn-export-excel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export Excel
        </button>
      </div>
    </div>

    <!-- Summary Statistics Bar -->
    <div class="stat-row" style="margin-bottom:16px;">
      <div class="stat-card gold">
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
        <div class="label">Hadir Tepat Waktu</div>
        <div class="value">${stats.hadir}</div>
        <div class="foot">dari ${stats.totalSiswa} siswa</div>
      </div>
      <div class="stat-card amber">
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
        <div class="label">Terlambat</div>
        <div class="value">${stats.terlambat}</div>
        <div class="foot">melewati batas masuk</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg></div>
        <div class="label">Izin / Sakit</div>
        <div class="value">${stats.izin + stats.sakit}</div>
        <div class="foot">${stats.izin} izin • ${stats.sakit} sakit</div>
      </div>
      <div class="stat-card rust">
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div>
        <div class="label">Alpa / Belum Absen</div>
        <div class="value">${stats.alpa + stats.belumHadir}</div>
        <div class="foot">${stats.alpa} alpa • ${stats.belumHadir} belum hadir</div>
      </div>
    </div>

    <!-- Attendance Table -->
    <div class="card" style="padding:0;">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">No</th>
              <th>Nama Siswa</th>
              <th>Kelas</th>
              <th>NIS</th>
              <th>Status</th>
              <th>Jam Masuk</th>
              <th>Jam Pulang</th>
              <th>Keterangan</th>
              <th style="width:100px; text-align:center;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStudents.length === 0 ? `
              <tr><td colspan="9" style="text-align:center; padding:24px; color:var(--ink-soft);">Tidak ada data siswa yang cocok dengan filter.</td></tr>
            ` : filteredStudents.map((s, idx) => {
              const rec = stats.records.find(r => r.siswaId === s.id);
              let statusBadge = '<span class="badge" style="background:#f1f5f9; color:#475569;">Belum Hadir</span>';
              let jamMsk = '-';
              let jamPlg = '-';
              let ket = '-';

              if (rec) {
                jamMsk = formatTimeDisplay(rec.jamMasuk);
                jamPlg = formatTimeDisplay(rec.jamPulang);
                ket = rec.keterangan || '-';

                if (rec.status === 'hadir') statusBadge = '<span class="badge lunas">Tepat Waktu</span>';
                else if (rec.status === 'terlambat') statusBadge = '<span class="badge parsial">Terlambat</span>';
                else if (rec.status === 'izin') statusBadge = '<span class="badge" style="background:var(--blue-soft); color:var(--blue);">Izin</span>';
                else if (rec.status === 'sakit') statusBadge = '<span class="badge" style="background:var(--gold-soft); color:var(--gold);">Sakit</span>';
                else statusBadge = '<span class="badge nunggak">Alpa</span>';
              }

              const waUrl = rec ? formatWaLinkAbsensi(s, rec) : null;

              return `
                <tr>
                  <td style="text-align:center; color:var(--ink-soft);">${idx + 1}</td>
                  <td><strong>${escapeHtml(s.nama)}</strong></td>
                  <td><span class="kelas-chip">${escapeHtml(s.kelas)}</span></td>
                  <td class="monospace">${escapeHtml(s.nis || '-')}</td>
                  <td>${statusBadge}</td>
                  <td class="monospace">${jamMsk}</td>
                  <td class="monospace">${jamPlg}</td>
                  <td style="color:var(--ink-soft); max-width:180px;">${escapeHtml(ket)}</td>
                  <td style="text-align:center; white-space:nowrap;">
                    ${waUrl ? `
                      <a href="${waUrl}" target="_blank" class="btn btn-sm" style="background:#25D366; color:#fff; padding:3px 6px; border:none; display:inline-flex; align-items:center;" title="Kirim WA ke Orang Tua">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                      </a>
                    ` : ''}
                    <button class="btn btn-sm btn-ghost" data-edit-absen="${s.id}" title="Ubah Status">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:14px;height:14px;"><path d="M4 20h4L18 10l-4-4L4 16v4z"/></svg>
                    </button>
                    ${rec ? `
                      <button class="btn btn-sm btn-ghost" data-del-absen="${rec.id}" title="Hapus Catatan">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:14px;height:14px;"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Filter events
  document.getElementById('rekap-date-picker')?.addEventListener('change', e => {
    store.ui.absensiTanggal = e.target.value;
    renderAbsensi();
  });
  document.getElementById('rekap-kelas-filter')?.addEventListener('change', e => {
    store.ui.absensiKelasFilter = e.target.value;
    renderAbsensi();
  });
  document.getElementById('rekap-status-filter')?.addEventListener('change', e => {
    store.ui.absensiStatusFilter = e.target.value;
    renderAbsensi();
  });

  // Export Excel
  document.getElementById('btn-export-excel')?.addEventListener('click', () => {
    exportAbsensiExcel(selectedDate, kelasFilter);
  });

  // Manual Add / Edit
  document.getElementById('btn-catat-manual')?.addEventListener('click', () => {
    openManualAbsensiModal(null, selectedDate);
  });

  container.querySelectorAll('[data-edit-absen]').forEach(b => {
    b.addEventListener('click', () => {
      openManualAbsensiModal(b.dataset.editAbsen, selectedDate);
    });
  });

  container.querySelectorAll('[data-del-absen]').forEach(b => {
    b.addEventListener('click', () => {
      openConfirm('Hapus catatan absensi siswa ini?', () => {
        deleteAbsensi(b.dataset.delAbsen);
        renderAbsensi();
      });
    });
  });
}

// ------------------------------------------
// TAB 3: CETAK KARTU SISWA QR
// ------------------------------------------
async function renderKartuTab(container, kelasList) {
  const wasSearchFocused = document.activeElement?.id === 'kartu-search';
  const selStart = wasSearchFocused ? document.activeElement.selectionStart : null;
  const selEnd = wasSearchFocused ? document.activeElement.selectionEnd : null;
  const kelasFilter = store.ui.absensiKelasFilter || '';
  const search = store.ui.siswaSearch || '';

  const filteredStudents = store.state.siswa.filter(s => {
    const matchKelas = !kelasFilter || s.kelas === kelasFilter;
    const matchSearch = !search || s.nama.toLowerCase().includes(search.toLowerCase()) || (s.nis || '').includes(search);
    return matchKelas && matchSearch;
  }).sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

  container.innerHTML = `
    <div class="toolbar" style="margin-bottom:16px;">
      <div class="toolbar-left">
        <input class="search-input" id="kartu-search" placeholder="Cari nama / NIS siswa..." value="${escapeAttr(search)}">
        <select id="kartu-kelas-filter">
          <option value="">Semua Kelas</option>
          ${kelasList.map(k => `<option value="${escapeAttr(k)}" ${kelasFilter === k ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" id="btn-print-all-cards">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Cetak Kartu Terfilter (${filteredStudents.length})
        </button>
      </div>
    </div>

    <!-- Cards Preview Grid -->
    <div class="cards-preview-grid" id="cards-preview-grid">
      <div style="text-align:center; padding:30px; color:var(--ink-soft); grid-column: 1 / -1;">
        <span class="spinner"></span> Memuat pratinjau kartu QR...
      </div>
    </div>
  `;

  const searchInputEl = document.getElementById('kartu-search');
  searchInputEl?.addEventListener('input', e => {
    store.ui.siswaSearch = e.target.value;
    renderKartuTab(container, kelasList);
  });
  if (wasSearchFocused && searchInputEl) {
    searchInputEl.focus();
    if (selStart !== null) searchInputEl.setSelectionRange(selStart, selEnd);
  }
  document.getElementById('kartu-kelas-filter')?.addEventListener('change', e => {
    store.ui.absensiKelasFilter = e.target.value;
    renderKartuTab(container, kelasList);
  });

  document.getElementById('btn-print-all-cards')?.addEventListener('click', () => {
    printCardsList(filteredStudents);
  });

  // Render cards asynchronously
  const gridEl = document.getElementById('cards-preview-grid');
  if (filteredStudents.length === 0) {
    gridEl.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding:30px;">Tidak ada data siswa yang cocok untuk dicetak.</div>`;
    return;
  }

  const cardsHtmlPromises = filteredStudents.map(async s => {
    const cardContent = await renderStudentCardHtml(s);
    return `
      <div class="id-card-wrapper" style="display:flex; flex-direction:column; align-items:center; gap:8px;">
        ${cardContent}
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" data-print-single="${s.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Cetak
          </button>
          <button class="btn btn-sm" data-dl-qr="${s.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            QR
          </button>
        </div>
      </div>
    `;
  });

  const allCardsHtml = await Promise.all(cardsHtmlPromises);
  gridEl.innerHTML = allCardsHtml.join('');

  gridEl.querySelectorAll('[data-print-single]').forEach(btn => {
    btn.addEventListener('click', () => {
      const siswa = store.state.siswa.find(s => s.id === btn.dataset.printSingle);
      if (siswa) printSingleCard(siswa);
    });
  });

  gridEl.querySelectorAll('[data-dl-qr]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const siswa = store.state.siswa.find(s => s.id === btn.dataset.dlQr);
      if (siswa) {
        const qrUrl = await generateQrDataUrl(siswa.nis || siswa.id);
        const a = document.createElement('a');
        a.href = qrUrl;
        a.download = `QR_${siswa.nama.replace(/\s+/g, '_')}_${siswa.nis || ''}.png`;
        a.click();
        toast('QR Code siswa didownload', 'success');
      }
    });
  });
}

// ==========================================
// MODAL & PRINT HELPERS
// ==========================================
function openManualAbsensiModal(siswaId = null, defaultDate = null) {
  const tanggal = defaultDate || getTodayDateStr();
  const siswa = siswaId ? store.state.siswa.find(s => s.id === siswaId) : null;
  const existingRecord = siswa ? (store.state.absensi || []).find(a => a.siswaId === siswa.id && a.tanggal === tanggal) : null;

  const currentStatus = existingRecord ? existingRecord.status : 'hadir';
  const jamMsk = existingRecord ? (existingRecord.jamMasuk || '') : getCurrentTimeStr();
  const jamPlg = existingRecord ? (existingRecord.jamPulang || '') : '';
  const ket = existingRecord ? (existingRecord.keterangan || '') : '';

  const siswaList = store.state.siswa.slice().sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

  const html = `
    <div class="modal-head">
      <h3>${existingRecord ? 'Ubah Status Absensi' : 'Catat Absensi Manual / Izin'}</h3>
      <button class="close-x" id="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Pilih Siswa</label>
        <select id="modal-absen-siswa" style="width:100%;" ${siswa ? 'disabled' : ''}>
          ${siswaList.map(s => `
            <option value="${s.id}" ${(siswa && siswa.id === s.id) ? 'selected' : ''}>
              ${escapeHtml(s.nama)} (${escapeHtml(s.kelas)}) - NIS: ${escapeHtml(s.nis || '-')}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tanggal</label>
          <input type="date" id="modal-absen-tgl" value="${tanggal}" style="width:100%;">
        </div>
        <div class="form-group">
          <label>Status Kehadiran</label>
          <select id="modal-absen-status" style="width:100%;">
            <option value="hadir" ${currentStatus === 'hadir' ? 'selected' : ''}>Hadir Tepat Waktu</option>
            <option value="terlambat" ${currentStatus === 'terlambat' ? 'selected' : ''}>Terlambat</option>
            <option value="izin" ${currentStatus === 'izin' ? 'selected' : ''}>Izin</option>
            <option value="sakit" ${currentStatus === 'sakit' ? 'selected' : ''}>Sakit</option>
            <option value="alpa" ${currentStatus === 'alpa' ? 'selected' : ''}>Alpa (Tanpa Keterangan)</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Jam Masuk</label>
          <input type="text" id="modal-absen-jam-masuk" value="${jamMsk}" placeholder="07:05:00" style="width:100%; font-family:'IBM Plex Mono',monospace;">
        </div>
        <div class="form-group">
          <label>Jam Pulang</label>
          <input type="text" id="modal-absen-jam-pulang" value="${jamPlg}" placeholder="14:00:00" style="width:100%; font-family:'IBM Plex Mono',monospace;">
        </div>
      </div>
      <div class="form-group">
        <label>Keterangan Tambahan</label>
        <input type="text" id="modal-absen-ket" value="${escapeAttr(ket)}" placeholder="Contoh: Sakit demam, Izin ada acara keluarga..." style="width:100%;">
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="modal-cancel">Batal</button>
      <button class="btn btn-primary" id="modal-save-absen">Simpan Data</button>
    </div>
  `;

  openModal(html);

  document.getElementById('modal-save-absen')?.addEventListener('click', () => {
    const sId = document.getElementById('modal-absen-siswa').value;
    const tgl = document.getElementById('modal-absen-tgl').value;
    const st = document.getElementById('modal-absen-status').value;
    const jMsk = document.getElementById('modal-absen-jam-masuk').value.trim();
    const jPlg = document.getElementById('modal-absen-jam-pulang').value.trim();
    const k = document.getElementById('modal-absen-ket').value.trim();

    manualAddOrUpdateAbsensi({
      id: existingRecord?.id,
      siswaId: sId,
      tanggal: tgl,
      jamMasuk: (st === 'izin' || st === 'sakit' || st === 'alpa') ? null : jMsk,
      jamPulang: jPlg || null,
      status: st,
      keterangan: k
    });

    closeModal();
    renderAbsensi();
  });
}

// Print single student card
async function printSingleCard(siswa) {
  const cardHtml = await renderStudentCardHtml(siswa);
  const printArea = document.getElementById('kwitansi-print-area');
  if (!printArea) return;

  printArea.innerHTML = `
    <div class="print-cards-container single">
      ${cardHtml}
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 100);
}

// Print all / filtered student cards
async function printCardsList(students) {
  const printArea = document.getElementById('kwitansi-print-area');
  if (!printArea) return;

  toast('Menyiapkan lembar cetak kartu...', 'info');
  const cardsHtmlPromises = students.map(s => renderStudentCardHtml(s));
  const cardsHtml = await Promise.all(cardsHtmlPromises);

  printArea.innerHTML = `
    <div class="print-cards-container sheet">
      ${cardsHtml.join('')}
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 200);
}
