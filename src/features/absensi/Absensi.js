import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { escapeHtml, escapeAttr, formatWaLink } from '../../utils/formatters.js';
import { toast, BULAN } from '../../utils/helpers.js';
import { openModal, closeModal, openConfirm } from '../../components/Modal.js';
import { triggerRender } from '../../utils/events.js';
import {
  getTodayDateStr,
  parseLocalDate,
  getCurrentTimeStr,
  formatTimeDisplay,
  catatAbsenByKode,
  manualAddOrUpdateAbsensi,
  markBulkHadir,
  deleteAbsensi,
  getStatistikAbsensi,
  getRiwayatAbsensiSiswa,
  exportAbsensiExcel,
  exportRekapBulananExcel,
  formatWaLinkAbsensi,
  playScanSound,
  registerRfidUid,
  removeRfidUid
} from './absensiService.js';
import { renderStudentCardHtml, generateQrDataUrl, downloadStudentQrCardPng } from './qrCardGenerator.js';
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

// Kiosk Mode & RFID Settings
let currentKioskAttendanceMode = 'auto'; // 'auto' | 'masuk' | 'pulang' | 'duha' | 'dzuhur'
let kioskResetTimer = null;
const KIOSK_AUTO_RESET_MS = 60000; // Reset back to 'auto' after 60s
let autoNextRfidActive = false;

// Global Hardware Buffer for USB RFID 125KHz Readers
let rfidBuffer = '';
let rfidBufferTimer = null;

function handleGlobalRfidKeypress(e) {
  // If user is actively typing in a normal text input (except rfid inputs), don't hijack unless rapid HID
  const activeTag = document.activeElement?.tagName;
  const activeId = document.activeElement?.id;
  const isInputActive = ['INPUT', 'TEXTAREA'].includes(activeTag) && activeId !== 'uidInput' && activeId !== 'manual-scan-input' && activeId !== 'rfid-scan-modal-input';

  if (isInputActive) return;

  if (e.key === 'Enter') {
    if (rfidBuffer.length >= 4) {
      const code = rfidBuffer.trim();
      rfidBuffer = '';
      if (document.getElementById('rfid-scan-modal-input')) {
        const modalInput = document.getElementById('rfid-scan-modal-input');
        if (modalInput) {
          modalInput.value = code;
          modalInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
      } else {
        processRfidOrQrScan(code);
      }
    }
    rfidBuffer = '';
    return;
  }

  if (e.key && e.key.length === 1) {
    rfidBuffer += e.key;
    clearTimeout(rfidBufferTimer);
    rfidBufferTimer = setTimeout(() => {
      rfidBuffer = '';
    }, 400); // 400ms buffer window for rapid hardware typing
  }
}

window.removeEventListener('keydown', handleGlobalRfidKeypress);
window.addEventListener('keydown', handleGlobalRfidKeypress);

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

  if (brackets) brackets.classList.toggle('mode-barcode', currentScanMode === 'barcode');
  if (hudTag) hudTag.textContent = currentScanMode === 'barcode' ? 'FOCUS: 1D BARCODE' : 'FOCUS AREA • SMART SCANNER';
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
  const badge = document.getElementById('scanner-status-badge');

  if (isScannerPaused) {
    if (activeHtml5QrCode.pause) activeHtml5QrCode.pause();
    if (btnPause) {
      btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Lanjutkan</span>`;
      btnPause.classList.add('active');
    }
    if (badge) badge.innerHTML = `<span class="dot-radar off"></span><span>Dijeda</span>`;
    toast('Pemindaian dijeda ⏸', 'info');
  } else {
    if (activeHtml5QrCode.resume) activeHtml5QrCode.resume();
    if (btnPause) {
      btnPause.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg><span>Jeda</span>`;
      btnPause.classList.remove('active');
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
    if (tempScanner) scanner.clear();
    processRfidOrQrScan(decodedText);
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
  clearTimeout(kioskResetTimer);
  window.removeEventListener('keydown', onKeyDownFs);
  document.removeEventListener('fullscreenchange', onFsChange);
  const wrapper = document.getElementById('qr-camera-wrapper');
  if (wrapper) wrapper.classList.remove('camera-fullscreen-active');
  document.body.classList.remove('camera-fs-body-lock');
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

window.addEventListener('beforeunload', () => {
  stopScanner();
  if (clockTimer) clearInterval(clockTimer);
});

export async function renderAbsensi() {
  const el = document.getElementById('page-absensi');
  const user = store.ui.currentUser;

  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }

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
  if (!store.ui.siswaAbsenBulan) store.ui.siswaAbsenBulan = now.getMonth() + 1;
  if (!store.ui.siswaAbsenTahun) store.ui.siswaAbsenTahun = now.getFullYear();
  const currentBulan = store.ui.siswaAbsenBulan;
  const currentTahun = store.ui.siswaAbsenTahun;

  const allStudentYears = (store.state.absensi || [])
    .filter(a => a.siswaId === siswa.id && a.tanggal)
    .map(a => parseLocalDate(a.tanggal).getFullYear());
  const tahunOptions = [...new Set([now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, ...allStudentYears])].sort((a, b) => a - b);

  const riwayat = getRiwayatAbsensiSiswa(siswa.id, currentBulan, currentTahun);
  const totalHadir = riwayat.filter(r => r.status === 'hadir').length;
  const totalTerlambat = riwayat.filter(r => r.status === 'terlambat').length;
  const totalIzin = riwayat.filter(r => r.status === 'izin').length;
  const totalSakit = riwayat.filter(r => r.status === 'sakit').length;
  const totalAlpa = riwayat.filter(r => r.status === 'alpa').length;
  const totalDuha = riwayat.filter(r => !!r.jamDuha).length;
  const totalDzuhur = riwayat.filter(r => !!r.jamDzuhur).length;
  const totalMasuk = totalHadir + totalTerlambat;
  const totalHariCatat = totalMasuk + totalIzin + totalSakit + totalAlpa;
  const persenHadir = totalHariCatat > 0 ? Math.round((totalMasuk / totalHariCatat) * 100) : 100;

  const cardHtml = await renderStudentCardHtml(siswa);

  let statusBadgeToday = '';
  let statusDescToday = '';

  if (!todayRecord) {
    statusBadgeToday = `<span class="badge" style="background:var(--paper-dim); color:var(--ink-soft); font-size:13px; padding:6px 14px; border:1px solid var(--line);">Belum Hadir</span>`;
    statusDescToday = 'Ananda belum melakukan tap kartu RFID atau scan presensi hari ini.';
  } else if (todayRecord.status === 'hadir') {
    statusBadgeToday = `<span class="badge lunas" style="font-size:13px; padding:6px 14px;">✓ Hadir Tepat Waktu</span>`;
    statusDescToday = `Masuk pukul <strong>${formatTimeDisplay(todayRecord.jamMasuk)}</strong>${todayRecord.jamPulang ? ` • Pulang: <strong>${formatTimeDisplay(todayRecord.jamPulang)}</strong>` : ' • Belum tap pulang'}`;
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

  const calendarHtml = generateAttendanceCalendarHtml(currentTahun, currentBulan, riwayat);

  el.innerHTML = `
    <!-- Hero Grid: Status Hari Ini & Kartu Pelajar -->
    <div class="siswa-absensi-hero-grid" style="display:grid; grid-template-columns: 1.2fr 1fr; gap:18px; margin-bottom:20px;">
      <!-- Kolom Kiri: Status Kehadiran Hari Ini & Ibadah -->
      <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; margin-bottom:0;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
            <div>
              <div class="card-eyebrow">Status Kehadiran & Ibadah Hari Ini</div>
              <h2 style="margin:2px 0 4px 0; font-size:18px;">${new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</h2>
              <div style="font-size:13px; color:var(--ink-soft);">${statusDescToday}</div>
            </div>
            ${statusBadgeToday}
          </div>

          <!-- 4 Pill Waktu Harian (Masuk, Pulang, Duha, Dzuhur) -->
          <div class="siswa-today-times-grid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; margin-top:14px;">
            <div class="time-pill-box ${todayRecord?.jamMasuk ? 'active' : ''}">
              <div class="tpb-label">📥 Jam Masuk</div>
              <div class="tpb-time monospace">${formatTimeDisplay(todayRecord?.jamMasuk)}</div>
            </div>
            <div class="time-pill-box ${todayRecord?.jamPulang ? 'active' : ''}">
              <div class="tpb-label">📤 Jam Pulang</div>
              <div class="tpb-time monospace">${formatTimeDisplay(todayRecord?.jamPulang)}</div>
            </div>
            <div class="time-pill-box duha ${todayRecord?.jamDuha ? 'active' : ''}">
              <div class="tpb-label">☀️ Solat Duha</div>
              <div class="tpb-time monospace">${formatTimeDisplay(todayRecord?.jamDuha)}</div>
            </div>
            <div class="time-pill-box dzuhur ${todayRecord?.jamDzuhur ? 'active' : ''}">
              <div class="tpb-label">🕌 Solat Dzuhur</div>
              <div class="tpb-time monospace">${formatTimeDisplay(todayRecord?.jamDzuhur)}</div>
            </div>
          </div>
        </div>

        <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="font-size:12px; color:var(--ink-soft); display:flex; align-items:center; gap:6px;">
            <span class="badge ${siswa.rfidUid ? 'lunas' : ''}" style="font-size:11px; padding:3px 8px;">
              ${siswa.rfidUid ? `💳 Kartu RFID: ${siswa.rfidUid}` : '💳 Belum Ada Kartu RFID'}
            </span>
          </div>
          <button type="button" class="btn btn-sm btn-outline" id="btn-siswa-ajukan-izin" title="Kirim Permohonan Izin / Sakit via WhatsApp ke Sekolah">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <span>Ajukan Izin / Sakit</span>
          </button>
        </div>
      </div>

      <!-- Kolom Kanan: Kartu Pelajar Digital & Tombol Aksi -->
      <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; margin-bottom:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <h3 style="margin:0; font-size:15px;">Kartu Pelajar & RFID/QR</h3>
            <div class="card-sub" style="font-size:11.5px; margin-top:2px;">Tap kartu RFID atau scan QR di gerbang</div>
          </div>
          <button class="btn btn-sm btn-secondary" id="btn-zoom-qr-modal" title="Buka QR ukuran besar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            Perbesar QR
          </button>
        </div>

        <div style="display:flex; justify-content:center; padding:4px 0;">
          ${cardHtml}
        </div>

        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="btn btn-sm btn-primary" id="btn-download-kartu" style="flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Simpan PNG
          </button>
          <button class="btn btn-sm btn-outline" id="btn-print-kartu" style="flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Cetak Kartu
          </button>
        </div>
      </div>
    </div>

    <!-- Filter Periode Bulan & Tahun -->
    <div class="toolbar" style="margin-bottom:14px;">
      <div class="toolbar-left" style="align-items:center; flex-wrap:wrap; gap:8px;">
        <span style="font-size:13px; font-weight:600; color:var(--ink);">Periode Absensi:</span>
        <select id="siswa-absen-bulan">
          ${BULAN.map((b, i) => `<option value="${i + 1}" ${currentBulan === i + 1 ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
        <select id="siswa-absen-tahun">
          ${tahunOptions.map(y => `<option value="${y}" ${currentTahun === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
        ${(currentBulan !== now.getMonth() + 1 || currentTahun !== now.getFullYear()) ? `
          <button class="btn btn-sm btn-ghost" id="btn-siswa-bulan-ini" style="font-size:11.5px;">Bulan Ini</button>
        ` : ''}
      </div>
      <div class="toolbar-right">
        <span style="font-size:13px; color:var(--ink-soft); font-weight:600;">
          Tingkat Kehadiran: <strong style="color:var(--green); font-size:15px;">${persenHadir}%</strong>
        </span>
      </div>
    </div>

    <!-- 4 Stat Card Akun Siswa -->
    <div class="stat-row" style="margin-bottom:18px;">
      <div class="stat-card gold">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <div class="label">Hadir Tepat Waktu</div>
        <div class="value">${totalHadir} Hari</div>
        <div class="foot">Total masuk: ${totalMasuk} hari</div>
      </div>
      <div class="stat-card amber">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <div class="label">Terlambat Masuk</div>
        <div class="value">${totalTerlambat} Hari</div>
        <div class="foot">Melewati batas jam masuk</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <div class="label">Solat Duha & Dzuhur</div>
        <div class="value">${totalDuha + totalDzuhur}x</div>
        <div class="foot">${totalDuha} Duha • ${totalDzuhur} Dzuhur</div>
      </div>
      <div class="stat-card ${totalAlpa > 0 ? 'rust' : 'emerald'}">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
        </div>
        <div class="label">Izin / Sakit / Alpa</div>
        <div class="value">${totalIzin + totalSakit + totalAlpa} Hari</div>
        <div class="foot">${totalIzin} Izin • ${totalSakit} Sakit • ${totalAlpa} Alpa</div>
      </div>
    </div>

    <!-- Tata Letak 2 Kolom Proporsional: Kalender Kompak di Kiri & Log Absensi di Kanan -->
    <div class="siswa-absensi-body-grid" style="display:grid; grid-template-columns: 340px 1fr; gap:18px; align-items:start;">
      <!-- Kalender Visual Kompak -->
      <div class="card" style="margin-bottom:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
          <h3 style="margin:0; font-size:14.5px;">Kalender Kehadiran</h3>
          <span style="font-size:12px; color:var(--ink-soft); font-weight:600;">${BULAN[currentBulan-1]} ${currentTahun}</span>
        </div>
        ${calendarHtml}
        <div class="cal-legend" style="margin-top:12px; border-top:1px solid var(--line); padding-top:8px;">
          <span class="legend-item"><span class="legend-dot dot-hadir"></span> Hadir</span>
          <span class="legend-item"><span class="legend-dot dot-terlambat"></span> Telat</span>
          <span class="legend-item"><span class="legend-dot dot-izin"></span> Izin/Sakit</span>
          <span class="legend-item"><span class="legend-dot dot-alpa"></span> Alpa</span>
        </div>
      </div>

      <!-- Log Absensi Rinci Bulan Berjalan -->
      <div class="card" style="margin-bottom:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0; font-size:14.5px;">Log Absensi & Ibadah Rinci</h3>
          <span style="font-size:12px; color:var(--ink-soft);">${riwayat.length} catatan</span>
        </div>
        <div class="table-scroll">
          <table style="font-size:13px;">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Masuk</th>
                <th>Pulang</th>
                <th>☀️ Duha</th>
                <th>🕌 Dzuhur</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${riwayat.length === 0 ? `
                <tr><td colspan="6" class="empty-state" style="padding:20px; text-align:center;">Belum ada catatan absensi bulan ini.</td></tr>
              ` : riwayat.map(r => {
                let badge = '';
                if (r.status === 'hadir') badge = '<span class="badge lunas">Tepat Waktu</span>';
                else if (r.status === 'terlambat') badge = '<span class="badge parsial">Terlambat</span>';
                else if (r.status === 'izin') badge = '<span class="badge" style="background:var(--blue-soft); color:var(--blue);">Izin</span>';
                else if (r.status === 'sakit') badge = '<span class="badge" style="background:var(--gold-soft); color:var(--gold);">Sakit</span>';
                else badge = '<span class="badge nunggak">Alpa</span>';

                return `
                  <tr>
                    <td>${parseLocalDate(r.tanggal).toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short' })}</td>
                    <td class="monospace">${formatTimeDisplay(r.jamMasuk)}</td>
                    <td class="monospace">${formatTimeDisplay(r.jamPulang)}</td>
                    <td class="monospace">${formatTimeDisplay(r.jamDuha)}</td>
                    <td class="monospace">${formatTimeDisplay(r.jamDzuhur)}</td>
                    <td>${badge}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Quick Floating Action QR Button for Mobile Screen -->
    <button class="mobile-floating-qr-btn" id="btn-floating-qr" title="Buka QR Presensi Saya">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      <span>QR Saya</span>
    </button>
  `;

  // Attach button events for Siswa
  document.getElementById('siswa-absen-bulan')?.addEventListener('change', e => {
    store.ui.siswaAbsenBulan = +e.target.value;
    renderAbsensi();
  });
  document.getElementById('siswa-absen-tahun')?.addEventListener('change', e => {
    store.ui.siswaAbsenTahun = +e.target.value;
    renderAbsensi();
  });
  document.getElementById('btn-siswa-bulan-ini')?.addEventListener('click', () => {
    const d = new Date();
    store.ui.siswaAbsenBulan = d.getMonth() + 1;
    store.ui.siswaAbsenTahun = d.getFullYear();
    renderAbsensi();
  });

  document.getElementById('btn-print-kartu')?.addEventListener('click', () => {
    printSingleCard(siswa);
  });

  const showZoomQrModal = async () => {
    const qrUrl = await generateQrDataUrl(siswa.rfidUid || siswa.nis || siswa.id);
    openModal(`
      <div class="modal-head">
        <h3>QR Presensi Cepat</h3>
        <button class="close-x" id="modal-close">&times;</button>
      </div>
      <div class="modal-body" style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:20px 16px; background:#FFFFFF; border-radius:12px;">
        <div style="font-size:18px; font-weight:800; color:#1E1B4B; text-align:center;">${escapeHtml(siswa.nama)}</div>
        <div style="font-family:'IBM Plex Mono', monospace; font-size:12.5px; color:#4338CA; font-weight:700; background:#EEF2FF; padding:4px 12px; border-radius:16px;">
          NIS: ${escapeHtml(siswa.nis || '-')} • KELAS ${escapeHtml(siswa.kelas || '-')}
          ${siswa.rfidUid ? ` • RFID: ${escapeHtml(siswa.rfidUid)}` : ''}
        </div>
        <div style="padding:14px; background:#FFFFFF; border:3px solid #1E1B4B; border-radius:18px; box-shadow:0 12px 30px rgba(0,0,0,0.12);">
          <img src="${qrUrl}" alt="QR" style="width:230px; height:230px; display:block;" />
        </div>
        <div style="font-size:12px; color:#64748B; text-align:center; max-width:280px;">
          Tingkatkan kecerahan layar HP saat memindai ke scanner gerbang sekolah.
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-primary" id="modal-cancel" style="width:100%;">Tutup</button>
      </div>
    `);
  };

  document.getElementById('btn-zoom-qr-modal')?.addEventListener('click', showZoomQrModal);
  document.getElementById('btn-floating-qr')?.addEventListener('click', showZoomQrModal);

  document.getElementById('btn-download-kartu')?.addEventListener('click', async () => {
    await downloadStudentQrCardPng(siswa);
    toast('Kartu QR berhasil disimpan sebagai gambar PNG', 'success');
  });

  // Modal Ajukan Izin / Sakit Terstruktur
  document.getElementById('btn-siswa-ajukan-izin')?.addEventListener('click', () => {
    const noHpSekolah = store.state.settings.noHpBendahara;
    if (!noHpSekolah) {
      toast('Nomor WhatsApp sekolah/bendahara belum diatur oleh admin.', 'info');
      return;
    }

    openModal(`
      <div class="modal-head">
        <h3>Permohonan Izin / Sakit</h3>
        <button class="close-x" id="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Jenis Permohonan</label>
          <select id="izin-modal-jenis" style="width:100%;">
            <option value="Sakit">Sakit</option>
            <option value="Izin">Izin (Ada keperluan keluarga/lainnya)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Tanggal</label>
          <input type="date" id="izin-modal-tgl" value="${getTodayDateStr()}" style="width:100%;">
        </div>
        <div class="form-group">
          <label>Alasan / Keterangan</label>
          <textarea id="izin-modal-alasan" rows="3" placeholder="Contoh: Demam tinggi dan istirahat di rumah per anjuran dokter..." style="width:100%;"></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" id="modal-cancel">Batal</button>
        <button class="btn btn-primary" id="btn-kirim-izin-wa" style="background:#25D366; border-color:#25D366; display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          Kirim via WhatsApp
        </button>
      </div>
    `);

    document.getElementById('btn-kirim-izin-wa')?.addEventListener('click', () => {
      const jenis = document.getElementById('izin-modal-jenis').value;
      const tglVal = document.getElementById('izin-modal-tgl').value;
      const alasan = document.getElementById('izin-modal-alasan').value.trim() || '-';
      const tglFormatted = parseLocalDate(tglVal).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

      const teks = `Assalamu'alaikum Wr. Wb.\nYth. Bapak/Ibu Petugas Presensi ${store.state.settings.namaSekolah},\n\nKami selaku orang tua/wali memberitahukan bahwa siswa:\nNama  : *${siswa.nama}*\nKelas : *${siswa.kelas}*\nNIS   : *${siswa.nis || '-'}*\n\nMemohon izin tidak dapat hadir mengikuti kegiatan sekolah pada hari *${tglFormatted}* dikarenakan *${jenis.toUpperCase()}*.\n\n*Keterangan:* ${alasan}\n\nDemikian permohonan ini kami sampaikan. Terima kasih.\nWassalamu'alaikum Wr. Wb.`;
      window.open(formatWaLink(noHpSekolah, teks), '_blank');
      closeModal();
    });
  });

  el.querySelectorAll('[data-cal-info]').forEach(dayEl => {
    dayEl.addEventListener('click', () => {
      toast(dayEl.dataset.calInfo, 'info');
    });
  });
}

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
      const pulangInfo = rec.jamPulang ? ` • Pulang ${formatTimeDisplay(rec.jamPulang)}` : '';
      const ibadahInfo = (rec.jamDuha || rec.jamDzuhur) ? ` • Ibadah: ${rec.jamDuha ? 'Duha' : ''} ${rec.jamDzuhur ? 'Dzuhur' : ''}` : '';
      if (rec.status === 'hadir') { dotClass = 'dot-hadir'; dayStatusTooltip = `Hadir Tepat Waktu: Masuk ${formatTimeDisplay(rec.jamMasuk)}${pulangInfo}${ibadahInfo}`; }
      else if (rec.status === 'terlambat') { dotClass = 'dot-terlambat'; dayStatusTooltip = `Terlambat: Masuk ${formatTimeDisplay(rec.jamMasuk)}${pulangInfo}${ibadahInfo}`; }
      else if (rec.status === 'izin' || rec.status === 'sakit') { dotClass = 'dot-izin'; dayStatusTooltip = `${rec.status.toUpperCase()}${rec.keterangan ? ` (${rec.keterangan})` : ''}`; }
      else if (rec.status === 'alpa') { dotClass = 'dot-alpa'; dayStatusTooltip = 'Alpa (Tanpa Keterangan)'; }
    }

    cells.push(`
      <div class="cal-day ${isToday ? 'today' : ''} ${dotClass ? 'has-record' : ''}" ${dotClass ? `style="cursor:pointer;" data-cal-info="${escapeAttr(`${day} ${BULAN[month-1]} ${year} — ${dayStatusTooltip}`)}"` : ''} title="${day} ${BULAN[month-1]}: ${dayStatusTooltip || 'Tidak ada catatan'}">
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
    <!-- Top Action Bar with 4 Tabs & Kiosk Mode Toggle -->
    <div class="absensi-header-nav" style="margin-bottom:18px;">
      <div class="tabs-container" style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn ${currentTab === 'scan' ? 'btn-primary' : 'btn-ghost'}" id="tab-scan" style="display:inline-flex; align-items:center; gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
          Scanner & Kiosk RFID/QR
        </button>
        <button class="btn ${currentTab === 'rfid' ? 'btn-primary' : 'btn-ghost'}" id="tab-rfid" style="display:inline-flex; align-items:center; gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 9h6M14 12h4M14 15h6"/></svg>
          Pendaftaran Kartu RFID
        </button>
        <button class="btn ${currentTab === 'rekap' ? 'btn-primary' : 'btn-ghost'}" id="tab-rekap" style="display:inline-flex; align-items:center; gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Rekapitulasi Kehadiran
        </button>
        <button class="btn ${currentTab === 'kartu' ? 'btn-primary' : 'btn-ghost'}" id="tab-kartu" style="display:inline-flex; align-items:center; gap:8px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px;"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="12" y2="12"/></svg>
          Cetak Kartu Siswa
        </button>
      </div>

      ${currentTab === 'scan' ? `
        <button class="btn btn-secondary btn-kiosk-toggle" id="btn-toggle-kiosk" title="Aktifkan Mode Layar Penuh Kiosk Gerbang / Lobi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          <span class="txt-kiosk">Mode Kiosk Terpadu</span>
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
  document.getElementById('tab-rfid')?.addEventListener('click', () => {
    stopScanner();
    store.ui.absensiTab = 'rfid';
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

  document.getElementById('btn-toggle-kiosk')?.addEventListener('click', () => {
    toggleKioskMode();
  });

  const contentEl = document.getElementById('absensi-content');

  if (currentTab === 'scan') {
    await renderScanTab(contentEl);
  } else if (currentTab === 'rfid') {
    renderRfidRegistrationTab(contentEl, kelasList);
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
      <span>Mode Kiosk Terpadu</span>
    `;
  }
  toast(isKiosk ? 'Mode Kiosk Layar Penuh Aktif' : 'Keluar dari Mode Kiosk', 'info');
  // Auto-focus on input for USB RFID Reader
  setTimeout(() => {
    document.getElementById('manual-scan-input')?.focus();
  }, 200);
}

// ------------------------------------------
// TAB 1: SCANNER & KIOSK RFID/QR TERPADU
// ------------------------------------------
async function renderScanTab(container) {
  const jamMasuk = store.state.settings.jamMasuk || '07:15';
  const jamPulang = store.state.settings.jamPulang || '14:00';
  const today = getTodayDateStr();

  const stats = getStatistikAbsensi(today);
  const todayScans = (store.state.absensi || [])
    .filter(a => a.tanggal === today)
    .sort((a, b) => (b.waktuScanTerakhir || b.waktuScanPulang || b.waktuScanMasuk || 0) - (a.waktuScanTerakhir || a.waktuScanPulang || a.waktuScanMasuk || 0))
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
          <span class="k-val" id="kiosk-stat-hadir">${stats.hadir}</span>
          <span class="k-lbl">✓ Tepat Waktu</span>
        </div>
        <div class="k-stat warning" title="Siswa Masuk Terlambat">
          <span class="k-val" id="kiosk-stat-terlambat">${stats.terlambat}</span>
          <span class="k-lbl">! Terlambat</span>
        </div>
        <div class="k-stat blue" title="Siswa Solat Duha">
          <span class="k-val" id="kiosk-stat-duha">${stats.duha || 0}</span>
          <span class="k-lbl">☀️ Duha</span>
        </div>
        <div class="k-stat emerald" title="Siswa Solat Dzuhur">
          <span class="k-val" id="kiosk-stat-dzuhur">${stats.dzuhur || 0}</span>
          <span class="k-lbl">🕌 Dzuhur</span>
        </div>
        <div class="k-stat gray" title="Siswa Belum Melakukan Absensi">
          <span class="k-val" id="kiosk-stat-belum">${stats.belumHadir}</span>
          <span class="k-lbl">Belum Hadir</span>
        </div>
      </div>
    </div>

    <!-- 4+1 Tombol Mode Absensi Terpadu (Kiosk Terpadu MTsS Yasta Bunter) -->
    <div class="kiosk-mode-bar" style="margin-bottom:16px;">
      <div class="mode-grid-kiosk">
        <button class="btn-mode-kiosk ${currentKioskAttendanceMode === 'auto' ? 'aktif' : ''}" data-kiosk-mode="auto" title="Deteksi Otomatis (Masuk / Pulang)">
          🤖 Otomatis (Pintar)
        </button>
        <button class="btn-mode-kiosk ${currentKioskAttendanceMode === 'masuk' ? 'aktif' : ''}" data-kiosk-mode="masuk" title="Absen Masuk Sekolah">
          📥 Absen Masuk
        </button>
        <button class="btn-mode-kiosk ${currentKioskAttendanceMode === 'pulang' ? 'aktif' : ''}" data-kiosk-mode="pulang" title="Absen Pulang Sekolah">
          📤 Absen Pulang
        </button>
        <button class="btn-mode-kiosk ${currentKioskAttendanceMode === 'duha' ? 'aktif' : ''}" data-kiosk-mode="duha" title="Presensi Solat Duha Berjamaah">
          ☀️ Solat Duha
        </button>
        <button class="btn-mode-kiosk ${currentKioskAttendanceMode === 'dzuhur' ? 'aktif' : ''}" data-kiosk-mode="dzuhur" title="Presensi Solat Dzuhur Berjamaah">
          🕌 Solat Dzuhur
        </button>
      </div>
      <div id="kiosk-mode-info" style="font-size:12.5px; color:var(--ink-soft); margin-top:8px; text-align:center;">
        Mode aktif: <strong>${getModeLabel(currentKioskAttendanceMode)}</strong>. Tempelkan kartu RFID 125KHz ke reader USB atau arahkan QR ke kamera.
      </div>
    </div>

    <div class="scanner-kiosk-layout">
      <!-- Scanner Column: RFID Tap Box & Camera QR Viewport -->
      <div class="card scanner-box-card" style="padding:16px;">
        <!-- RFID Card Tap Primary Box (Highlight USB Reader 125KHz) -->
        <div class="rfid-tap-hero-box" style="margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:13px; font-weight:700; color:var(--ink); display:flex; align-items:center; gap:6px;">
              <span class="pulse-rfid-icon">💳</span>
              <span>Reader Kartu RFID 125KHz USB:</span>
            </div>
            <span class="scanner-live-badge"><span class="dot-radar"></span>Siap Tap Kartu</span>
          </div>
          <div style="display:flex; gap:8px;">
            <input type="text" id="manual-scan-input" placeholder="Sistem siap. Tempelkan kartu RFID 125KHz Anda..." class="rfid-primary-input" autocomplete="off">
            <button class="btn btn-primary" id="btn-manual-scan" style="padding:10px 18px; font-weight:700;">Catat</button>
          </div>
          <div style="font-size:11.5px; color:var(--ink-soft); margin-top:6px; display:flex; justify-content:space-between; align-items:center;">
            <span>*Kompatibel dengan reader RFID 125KHz USB Plug-and-Play & Barcode USB.</span>
            <span style="font-family:'IBM Plex Mono',monospace; font-size:11px;">Otomatis Fokus</span>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:8px;">
          <div>
            <h3 style="margin:0; font-size:15px;">Pemindai Kamera QR (Opsional)</h3>
            <div class="card-sub" style="font-size:11.5px; margin-top:2px;">Scan kartu pelajar cetak / HP jika tidak membawa kartu RFID</div>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="btn btn-sm btn-outline btn-fs-trigger" id="btn-camera-fullscreen" title="Buka Layar Penuh Kamera (F)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              <span>Layar Penuh [F]</span>
            </button>
          </div>
        </div>

        <!-- Camera Viewport Box -->
        <div class="qr-camera-wrapper" id="qr-camera-wrapper">
          <div class="camera-fs-header" id="camera-fs-header">
            <div class="camera-fs-brand">
              <div class="fs-logo-glow"><span class="fs-pulse-dot"></span></div>
              <div>
                <div class="fs-brand-title">EduPass <span class="fs-badge-ai">RFID + QR SENSOR</span></div>
                <div class="fs-brand-sub" id="fs-clock-sub">Memuat jam...</div>
              </div>
            </div>
            <div class="camera-fs-actions">
              <button class="btn-fs-icon btn-fs-exit" id="btn-fs-exit" title="Keluar Layar Penuh (Esc)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                <span>Keluar (Esc)</span>
              </button>
            </div>
          </div>

          <button id="btn-quick-fullscreen" class="quick-fs-btn" title="Layar Penuh (F)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          </button>

          <div id="qr-reader" style="width:100%; border-radius:12px; overflow:hidden; background:#070A11; min-height:240px; position:relative;">
            <div class="qr-placeholder" id="qr-placeholder">
              <div class="qr-placeholder-glow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:40px;height:40px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              </div>
              <div class="placeholder-title">Kamera Siap Digunakan</div>
              <div class="placeholder-sub">Klik tombol di bawah jika ingin memindai via webcam/kamera HP</div>
              <button class="btn btn-primary btn-sm" id="btn-placeholder-start" style="margin-top:12px; border-radius:20px;">
                Aktifkan Kamera QR
              </button>
            </div>
          </div>

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
          </div>

          <div class="scanner-laser" id="scanner-laser" style="display:none;"></div>
          <div class="camera-fs-toast" id="camera-fs-toast" style="display:none;"></div>
        </div>

        <!-- Camera Controls Toolbar -->
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; align-items:center;">
          <select id="camera-select" style="flex:1; min-width:140px; font-size:12px; padding:6px 10px;">
            <option value="">Memuat kamera...</option>
          </select>
          <button class="btn btn-sm btn-primary" id="btn-toggle-camera">
            Mulai Kamera
          </button>
        </div>

        <div class="camera-flex-toolbar">
          <div class="flex-tool-row">
            <div class="flex-tool-group">
              <span class="tool-label">Mode:</span>
              <div class="btn-group-pill">
                <button class="btn-pill-opt active" id="btn-mode-qr">⏹ QR</button>
                <button class="btn-pill-opt" id="btn-mode-barcode">▰ Barcode</button>
              </div>
            </div>
            <div class="flex-tool-group">
              <span class="tool-label">Zoom:</span>
              <div class="btn-group-pill">
                <button class="btn-pill-opt active" id="btn-zoom-1x">1x</button>
                <button class="btn-pill-opt" id="btn-zoom-15x">1.5x</button>
                <button class="btn-pill-opt" id="btn-zoom-2x">2x</button>
              </div>
            </div>
          </div>
          <div class="flex-tool-row secondary" style="margin-top:6px;">
            <button class="btn-flex-action" id="btn-toggle-mirror"><span>Mirror</span></button>
            <button class="btn-flex-action" id="btn-toggle-torch"><span>Senter</span></button>
            <button class="btn-flex-action" id="btn-pause-scanner"><span>Jeda</span></button>
            <label class="btn-flex-action" id="label-upload-qr">
              <span>Scan Foto</span>
              <input type="file" id="input-qr-file" accept="image/*" style="display:none;">
            </label>
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
              <div style="font-weight:700; font-size:14px; color:var(--ink);">Menunggu Tap Kartu RFID / QR</div>
              <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">Tempelkan kartu ke reader USB 125KHz atau arahkan kartu ke kamera</div>
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
            <span id="live-feed-count" style="font-size:12px; color:var(--ink-soft); font-family:'IBM Plex Mono',monospace;">${todayScans.length} siswa terakhir</span>
          </div>

          <div class="table-scroll">
            <table style="font-size:13px;">
              <thead>
                <tr>
                  <th style="width:90px;">Waktu</th>
                  <th>Nama Siswa</th>
                  <th>Kelas</th>
                  <th>Aktivitas</th>
                  <th style="width:60px; text-align:center;">WA</th>
                </tr>
              </thead>
              <tbody id="live-feed-tbody">
                ${renderLiveFeedRows(todayScans)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  startLiveClock();
  setupScannerController();

  // Mode Selection Event Listeners
  container.querySelectorAll('[data-kiosk-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      setKioskAttendanceMode(btn.dataset.kioskMode);
    });
  });

  // Keep auto-focus on input for USB RFID Reader
  const manualInput = document.getElementById('manual-scan-input');
  setTimeout(() => manualInput?.focus(), 200);

  const focusInterval = setInterval(() => {
    if (store.ui.page === 'absensi' && store.ui.absensiTab === 'scan' && !document.querySelector('.modal-overlay.active') && !document.querySelector('.overlay.tampil')) {
      const activeTag = document.activeElement?.tagName;
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) {
        manualInput?.focus();
      }
    } else {
      clearInterval(focusInterval);
    }
  }, 3000);
}

function getModeLabel(mode) {
  if (mode === 'masuk') return '📥 Absen Masuk';
  if (mode === 'pulang') return '📤 Absen Pulang';
  if (mode === 'duha') return '☀️ Solat Duha';
  if (mode === 'dzuhur') return '🕌 Solat Dzuhur';
  return '🤖 Otomatis (Masuk / Pulang Pintar)';
}

function setKioskAttendanceMode(newMode) {
  currentKioskAttendanceMode = newMode;
  document.querySelectorAll('.btn-mode-kiosk').forEach(b => {
    b.classList.toggle('aktif', b.dataset.kioskMode === newMode);
  });
  const infoEl = document.getElementById('kiosk-mode-info');
  if (infoEl) {
    infoEl.innerHTML = `Mode aktif: <strong>${getModeLabel(newMode)}</strong>. Tempelkan kartu RFID 125KHz ke reader USB atau arahkan QR ke kamera.`;
  }
  toast(`Mode diubah ke ${getModeLabel(newMode)}`, 'info');

  clearTimeout(kioskResetTimer);
  if (newMode !== 'auto') {
    kioskResetTimer = setTimeout(() => {
      setKioskAttendanceMode('auto');
      toast('Mode otomatis kembali ke Otomatis (Pintar)', 'info');
    }, KIOSK_AUTO_RESET_MS);
  }

  document.getElementById('manual-scan-input')?.focus();
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
      fsClock.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} • ${h}:${m}:${s} WIB`;
    }
  };

  updateClock();
  clockTimer = setInterval(updateClock, 1000);
}

// Controller for Scanner & Manual RFID input
async function setupScannerController() {
  const cameraSelect = document.getElementById('camera-select');
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  const manualInput = document.getElementById('manual-scan-input');
  const btnManualScan = document.getElementById('btn-manual-scan');

  const btnCameraFs = document.getElementById('btn-camera-fullscreen');
  const btnQuickFs = document.getElementById('btn-quick-fullscreen');
  const btnFsExit = document.getElementById('btn-fs-exit');
  const btnPlaceholderStart = document.getElementById('btn-placeholder-start');

  btnCameraFs?.addEventListener('click', () => toggleCameraFullscreen(true));
  btnQuickFs?.addEventListener('click', () => toggleCameraFullscreen(true));
  btnFsExit?.addEventListener('click', () => toggleCameraFullscreen(false));
  btnPlaceholderStart?.addEventListener('click', () => btnToggleCamera?.click());

  // Mode Scan Toggle
  document.getElementById('btn-mode-qr')?.addEventListener('click', () => {
    currentScanMode = 'qr'; updateScanModeUi();
  });
  document.getElementById('btn-mode-barcode')?.addEventListener('click', () => {
    currentScanMode = 'barcode'; updateScanModeUi();
  });

  // Mirror & Zoom
  document.getElementById('btn-toggle-mirror')?.addEventListener('click', () => {
    isCameraMirrored = !isCameraMirrored; updateMirrorUi();
  });
  document.getElementById('btn-zoom-1x')?.addEventListener('click', () => { currentZoomLevel = 1.0; updateZoomUi(); });
  document.getElementById('btn-zoom-15x')?.addEventListener('click', () => { currentZoomLevel = 1.5; updateZoomUi(); });
  document.getElementById('btn-zoom-2x')?.addEventListener('click', () => { currentZoomLevel = 2.0; updateZoomUi(); });

  document.getElementById('btn-toggle-torch')?.addEventListener('click', toggleTorch);
  document.getElementById('btn-pause-scanner')?.addEventListener('click', toggleScannerPause);

  document.getElementById('input-qr-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await scanImageFile(file);
      e.target.value = '';
    }
  });

  window.removeEventListener('keydown', onKeyDownFs);
  window.addEventListener('keydown', onKeyDownFs);
  document.removeEventListener('fullscreenchange', onFsChange);
  document.addEventListener('fullscreenchange', onFsChange);

  // Manual & RFID Reader Input Submission
  const handleManual = () => {
    const val = manualInput.value.trim();
    if (!val) return;
    manualInput.value = '';
    processRfidOrQrScan(val);
  };

  btnManualScan?.addEventListener('click', handleManual);
  manualInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManual();
    }
  });

  // Populate cameras
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (cameras && cameras.length > 0) {
      cameraSelect.innerHTML = cameras.map((c, i) => `
        <option value="${c.id}" ${i === 0 ? 'selected' : ''}>${escapeHtml(c.label || `Kamera ${i + 1}`)}</option>
      `).join('');
      currentCameraId = cameras[0].id;
    } else {
      cameraSelect.innerHTML = '<option value="">Tidak ada webcam terdeteksi</option>';
    }
  } catch (err) {
    cameraSelect.innerHTML = '<option value="">Izin kamera belum aktif</option>';
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
      btnToggleCamera.textContent = 'Mulai Kamera';
      btnToggleCamera.className = 'btn btn-sm btn-primary';
      const placeholder = document.getElementById('qr-placeholder');
      if (placeholder) placeholder.style.display = 'flex';
      const laser = document.getElementById('scanner-laser');
      if (laser) laser.style.display = 'none';
      const badge = document.getElementById('scanner-status-badge');
      if (badge) badge.innerHTML = `<span class="dot-radar off"></span><span>Kamera Mati</span>`;
    } else {
      await startCamera(cameraSelect.value);
    }
  });
}

export function toggleCameraFullscreen(forceState) {
  const wrapper = document.getElementById('qr-camera-wrapper');
  if (!wrapper) return;
  const isCurrentlyFs = wrapper.classList.contains('camera-fullscreen-active');
  const shouldBeFs = forceState !== undefined ? forceState : !isCurrentlyFs;

  if (shouldBeFs) {
    wrapper.classList.add('camera-fullscreen-active');
    document.body.classList.add('camera-fs-body-lock');
    if (wrapper.requestFullscreen && !document.fullscreenElement) {
      wrapper.requestFullscreen().catch(() => {});
    }
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

    const config = { fps: 20, qrbox: qrboxFunction };
    const cameraParam = cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' };

    await activeHtml5QrCode.start(
      cameraParam,
      config,
      (decodedText) => {
        if (!isScannerPaused) {
          processRfidOrQrScan(decodedText);
        }
      },
      () => {}
    );

    isScannerRunning = true;
    isScannerPaused = false;
    applyCameraTransform();

    if (laser) laser.style.display = 'block';
    if (badge) badge.innerHTML = `<span class="dot-radar"></span><span>Live</span>`;
    if (btnToggleCamera) {
      btnToggleCamera.textContent = 'Hentikan Kamera';
      btnToggleCamera.className = 'btn btn-sm btn-danger';
    }
  } catch (err) {
    console.error('Failed to start camera', err);
    toast('Gagal mengakses kamera: ' + (err?.message || err), 'error');
    if (placeholder) placeholder.style.display = 'flex';
  }
}

// Process RFID Card Tap or QR Code Detection
let scanDebounceLock = false;
function processRfidOrQrScan(rawCode) {
  if (scanDebounceLock) return;
  scanDebounceLock = true;
  setTimeout(() => { scanDebounceLock = false; }, 1500);

  const mode = currentKioskAttendanceMode;
  const result = catatAbsenByKode(rawCode, mode);
  const container = document.getElementById('scan-feedback-container');

  if (!result.success) {
    if (container) {
      container.innerHTML = `
        <div class="card scan-alert scan-error" style="background:#fef2f2; border:1px solid #f87171; padding:16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; animation:shake 0.4s ease;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:42px;height:42px;border-radius:50%;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;flex-shrink:0; font-size:20px;">
              ❌
            </div>
            <div>
              <div style="font-weight:700; color:#991b1b; font-size:14px;">Kartu Tidak Dikenal!</div>
              <div style="font-size:12.5px; color:#b91c1c;">${escapeHtml(result.message)}</div>
            </div>
          </div>
          ${result.unknownUid ? `
            <button class="btn btn-sm btn-primary" id="btn-quick-register-rfid" data-unknown-uid="${escapeAttr(result.unknownUid)}">
              💳 Daftarkan Kartu Ini
            </button>
          ` : ''}
        </div>
      `;

      document.getElementById('btn-quick-register-rfid')?.addEventListener('click', (e) => {
        openQuickRegisterRfidModal(e.currentTarget.dataset.unknownUid);
      });
    }

    toast(result.message, 'error');
    return;
  }

  const { siswa, status, type, aktivitas, message, record } = result;

  let badgeColor = '#10b981';
  let badgeBg = '#ecfdf5';
  let badgeText = 'Tepat Waktu';
  let iconDisplay = '✅';

  if (type === 'pulang') {
    badgeColor = '#3b82f6';
    badgeBg = '#eff6ff';
    badgeText = 'Absen Pulang';
    iconDisplay = '📤';
  } else if (type === 'duha') {
    badgeColor = '#d97706';
    badgeBg = '#fffdf0';
    badgeText = 'Solat Duha';
    iconDisplay = '☀️';
  } else if (type === 'dzuhur') {
    badgeColor = '#047857';
    badgeBg = '#ecfdf5';
    badgeText = 'Solat Dzuhur';
    iconDisplay = '🕌';
  } else if (status === 'terlambat') {
    badgeColor = '#d97706';
    badgeBg = '#fef3c7';
    badgeText = 'Terlambat';
    iconDisplay = '⏰';
  } else if (type === 'duplicate' || type === 'completed') {
    badgeColor = '#6b7280';
    badgeBg = '#f3f4f6';
    badgeText = 'Sudah Tercatat';
    iconDisplay = '⚠️';
  }

  const waLink = formatWaLinkAbsensi(siswa, record);

  if (container) {
    container.innerHTML = `
      <div class="card scan-alert scan-success verified-card" style="border:2px solid ${badgeColor}; padding:14px 18px;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div class="verified-avatar" style="background:${badgeBg}; color:${badgeColor}; border:2px solid ${badgeColor}; font-size:22px; width:48px; height:48px;">
            ${iconDisplay}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="verified-student-name">${escapeHtml(siswa.nama)}</span>
              <span class="kelas-chip">${escapeHtml(siswa.kelas)}</span>
            </div>
            <div style="font-size:12.5px; color:var(--ink-soft); margin-top:2px;">
              NIS: <span class="monospace font-bold">${escapeHtml(siswa.nis || '-')}</span>
              ${siswa.rfidUid ? ` • RFID: <span class="monospace">${escapeHtml(siswa.rfidUid)}</span>` : ''}
            </div>
            <div style="font-size:12.5px; color:${badgeColor}; font-weight:700; margin-top:2px;">
              ${escapeHtml(message)}
            </div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
          <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-size:13px; padding:5px 12px; font-weight:700;">${badgeText}</span>
          ${waLink ? `
            <a href="${waLink}" target="_blank" class="btn btn-sm btn-wa-notify" title="Kirim Notifikasi Langsung ke WhatsApp Orang Tua">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span>Kirim WA</span>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Refresh counts & live feed
  updateLiveFeedTbody();
  toast(message, status === 'terlambat' ? 'warning' : 'success');
}

function renderLiveFeedRows(todayScans) {
  if (todayScans.length === 0) {
    return `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--ink-soft);">Belum ada tap kartu atau absensi hari ini.</td></tr>`;
  }

  return todayScans.map(s => {
    const siswa = store.state.siswa.find(x => x.id === s.siswaId);
    const nama = siswa ? escapeHtml(siswa.nama) : 'Siswa Terhapus';
    const initials = nama.substring(0, 2).toUpperCase();
    const kelas = siswa ? escapeHtml(siswa.kelas) : '-';

    let aktivitasHtml = '';
    let waktuStr = '-';

    if (s.aktivitasTerakhir === 'Solat Duha' || (!s.aktivitasTerakhir && s.jamDuha)) {
      aktivitasHtml = '<span class="badge" style="background:#fffdf0; color:#b08d00; border:1px solid #fde68a;">☀️ Solat Duha</span>';
      waktuStr = formatTimeDisplay(s.jamDuha);
    } else if (s.aktivitasTerakhir === 'Solat Dzuhur' || (!s.aktivitasTerakhir && s.jamDzuhur)) {
      aktivitasHtml = '<span class="badge" style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;">🕌 Solat Dzuhur</span>';
      waktuStr = formatTimeDisplay(s.jamDzuhur);
    } else if (s.jamPulang) {
      aktivitasHtml = '<span class="badge" style="background:#eff6ff; color:#2563eb;">Pulang</span>';
      waktuStr = formatTimeDisplay(s.jamPulang);
    } else if (s.status === 'hadir') {
      aktivitasHtml = '<span class="badge lunas">Tepat Waktu</span>';
      waktuStr = formatTimeDisplay(s.jamMasuk);
    } else if (s.status === 'terlambat') {
      aktivitasHtml = '<span class="badge parsial">Terlambat</span>';
      waktuStr = formatTimeDisplay(s.jamMasuk);
    } else {
      aktivitasHtml = '<span class="badge">' + s.status.toUpperCase() + '</span>';
      waktuStr = '-';
    }

    const waUrl = siswa ? formatWaLinkAbsensi(siswa, s) : null;

    return `
      <tr>
        <td class="monospace" style="color:var(--ink-soft); font-size:12px;">${waktuStr}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="mini-avatar">${initials}</span>
            <strong>${nama}</strong>
          </div>
        </td>
        <td><span class="kelas-chip">${kelas}</span></td>
        <td>${aktivitasHtml}</td>
        <td style="text-align:center;">
          ${waUrl ? `
            <a href="${waUrl}" target="_blank" class="btn btn-sm btn-wa-notify" title="Kirim WA Orang Tua">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            </a>
          ` : '<span style="color:var(--line);">-</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function updateLiveFeedTbody() {
  const today = getTodayDateStr();
  const statsNow = getStatistikAbsensi(today);

  const kHadir = document.getElementById('kiosk-stat-hadir');
  const kTerlambat = document.getElementById('kiosk-stat-terlambat');
  const kDuha = document.getElementById('kiosk-stat-duha');
  const kDzuhur = document.getElementById('kiosk-stat-dzuhur');
  const kBelum = document.getElementById('kiosk-stat-belum');
  if (kHadir) kHadir.textContent = statsNow.hadir;
  if (kTerlambat) kTerlambat.textContent = statsNow.terlambat;
  if (kDuha) kDuha.textContent = statsNow.duha || 0;
  if (kDzuhur) kDzuhur.textContent = statsNow.dzuhur || 0;
  if (kBelum) kBelum.textContent = statsNow.belumHadir;

  const tbody = document.getElementById('live-feed-tbody');
  if (!tbody) return;

  const todayScans = (store.state.absensi || [])
    .filter(a => a.tanggal === today)
    .sort((a, b) => (b.waktuScanTerakhir || b.waktuScanPulang || b.waktuScanMasuk || 0) - (a.waktuScanTerakhir || a.waktuScanPulang || a.waktuScanMasuk || 0))
    .slice(0, 10);

  const countEl = document.getElementById('live-feed-count');
  if (countEl) countEl.textContent = `${todayScans.length} siswa terakhir`;

  tbody.innerHTML = renderLiveFeedRows(todayScans);
}

// ------------------------------------------
// TAB 2: PENDAFTARAN KARTU RFID 125KHz (Admin)
// ------------------------------------------
function renderRfidRegistrationTab(container, kelasList) {
  const wasSearchFocused = document.activeElement?.id === 'rfid-admin-search';
  const selStart = wasSearchFocused ? document.activeElement.selectionStart : null;
  const selEnd = wasSearchFocused ? document.activeElement.selectionEnd : null;

  const kelasFilter = store.ui.rfidKelasFilter || '';
  const statusFilter = store.ui.rfidStatusFilter || 'semua'; // 'semua' | 'belum' | 'terdaftar'
  const search = store.ui.rfidSearch || '';

  const allSiswa = store.state.siswa || [];
  const totalSiswa = allSiswa.length;
  const totalRegistered = allSiswa.filter(s => s.rfidUid && s.rfidUid.trim()).length;
  const totalUnregistered = totalSiswa - totalRegistered;

  const filtered = allSiswa.filter(s => {
    if (kelasFilter && s.kelas !== kelasFilter) return false;
    const hasUid = !!(s.rfidUid && s.rfidUid.trim());
    if (statusFilter === 'belum' && hasUid) return false;
    if (statusFilter === 'terdaftar' && !hasUid) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchNama = (s.nama || '').toLowerCase().includes(q);
      const matchNis = (s.nis || '').includes(q);
      const matchUid = (s.rfidUid || '').toLowerCase().includes(q);
      if (!matchNama && !matchNis && !matchUid) return false;
    }
    return true;
  }).sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

  container.innerHTML = `
    <!-- RFID Summary Banner -->
    <div class="stat-row" style="margin-bottom:16px;">
      <div class="stat-card emerald">
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
        <div class="label">Sudah Punya Kartu RFID</div>
        <div class="value">${totalRegistered} Siswa</div>
        <div class="foot">${Math.round((totalRegistered / (totalSiswa || 1)) * 100)}% dari ${totalSiswa} total siswa</div>
      </div>
      <div class="stat-card ${totalUnregistered > 0 ? 'amber' : 'emerald'}">
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
        <div class="label">Belum Memiliki Kartu RFID</div>
        <div class="value">${totalUnregistered} Siswa</div>
        <div class="foot">Perlu didaftarkan kartu fisik</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/></svg></div>
        <div class="label">Reader RFID 125KHz</div>
        <div class="value">USB HID Active</div>
        <div class="foot">Plug-and-play siap tap kartu</div>
      </div>
    </div>

    <!-- Filter & Toolbar -->
    <div class="toolbar" style="margin-bottom:16px;">
      <div class="toolbar-left" style="flex-wrap:wrap; gap:10px;">
        <input class="search-input" id="rfid-admin-search" placeholder="Cari nama, NIS, atau UID RFID..." value="${escapeAttr(search)}">
        <select id="rfid-kelas-filter">
          <option value="">Semua Kelas</option>
          ${kelasList.map(k => `<option value="${escapeAttr(k)}" ${kelasFilter === k ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
        </select>
        <select id="rfid-status-filter">
          <option value="semua" ${statusFilter === 'semua' ? 'selected' : ''}>Semua Status Kartu</option>
          <option value="belum" ${statusFilter === 'belum' ? 'selected' : ''}>Belum Punya Kartu (${totalUnregistered})</option>
          <option value="terdaftar" ${statusFilter === 'terdaftar' ? 'selected' : ''}>Sudah Terdaftar (${totalRegistered})</option>
        </select>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-primary" id="btn-auto-next-rfid" title="Daftarkan kartu RFID siswa secara beruntun otomatis">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          ⚡ Mode Daftar Beruntun (Auto-Next)
        </button>
      </div>
    </div>

    <!-- Tabel Pendaftaran Kartu RFID Siswa -->
    <div class="card" style="padding:0;">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">No</th>
              <th>Nama Siswa</th>
              <th>Kelas</th>
              <th>NIS</th>
              <th>UID Kartu RFID 125KHz</th>
              <th style="width:140px; text-align:center;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr><td colspan="6" style="text-align:center; padding:24px; color:var(--ink-soft);">Tidak ada data siswa yang cocok dengan filter.</td></tr>
            ` : filtered.map((s, idx) => {
              const hasUid = !!(s.rfidUid && s.rfidUid.trim());
              const uidBadge = hasUid
                ? `<span class="badge lunas monospace" style="font-size:12.5px; font-weight:700;">💳 ${escapeHtml(s.rfidUid)}</span>`
                : `<span class="badge" style="background:var(--paper-dim); color:var(--ink-soft);">Belum ada</span>`;

              return `
                <tr>
                  <td style="text-align:center; color:var(--ink-soft);">${idx + 1}</td>
                  <td><strong>${escapeHtml(s.nama)}</strong></td>
                  <td><span class="kelas-chip">${escapeHtml(s.kelas)}</span></td>
                  <td class="monospace">${escapeHtml(s.nis || '-')}</td>
                  <td>${uidBadge}</td>
                  <td style="text-align:center; white-space:nowrap;">
                    <button class="btn btn-sm ${hasUid ? 'btn-secondary' : 'btn-primary'}" data-register-rfid="${s.id}" data-nama="${escapeAttr(s.nama)}">
                      ${hasUid ? 'Ganti Kartu' : 'Daftarkan'}
                    </button>
                    ${hasUid ? `
                      <button class="btn btn-sm btn-ghost" data-delete-rfid="${s.id}" data-nama="${escapeAttr(s.nama)}" title="Hapus UID Kartu">
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

  // Search and Filter Events
  const searchEl = document.getElementById('rfid-admin-search');
  searchEl?.addEventListener('input', e => {
    store.ui.rfidSearch = e.target.value;
    renderRfidRegistrationTab(container, kelasList);
  });
  if (wasSearchFocused && searchEl) {
    searchEl.focus();
    if (selStart !== null) searchEl.setSelectionRange(selStart, selEnd);
  }

  document.getElementById('rfid-kelas-filter')?.addEventListener('change', e => {
    store.ui.rfidKelasFilter = e.target.value;
    renderRfidRegistrationTab(container, kelasList);
  });
  document.getElementById('rfid-status-filter')?.addEventListener('change', e => {
    store.ui.rfidStatusFilter = e.target.value;
    renderRfidRegistrationTab(container, kelasList);
  });

  // Action Buttons
  container.querySelectorAll('[data-register-rfid]').forEach(b => {
    b.addEventListener('click', () => {
      openRfidScanModal(b.dataset.registerRfid, b.dataset.nama, false, () => {
        renderRfidRegistrationTab(container, kelasList);
      });
    });
  });

  container.querySelectorAll('[data-delete-rfid]').forEach(b => {
    b.addEventListener('click', () => {
      openConfirm(`Hapus kaitan kartu RFID dari siswa ${b.dataset.nama}?`, () => {
        removeRfidUid(b.dataset.deleteRfid);
        renderRfidRegistrationTab(container, kelasList);
      });
    });
  });

  // Auto-next mode
  document.getElementById('btn-auto-next-rfid')?.addEventListener('click', () => {
    const unreg = store.state.siswa.filter(s => !s.rfidUid || !s.rfidUid.trim()).sort((a,b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
    if (unreg.length === 0) {
      toast('Semua siswa sudah memiliki kartu RFID!', 'success');
      return;
    }
    openRfidScanModal(unreg[0].id, unreg[0].nama, true, () => {
      renderRfidRegistrationTab(container, kelasList);
    });
  });
}

// Modal Tap Kartu RFID (Admin Kartu RFID MTsS Yasta Bunter)
function openRfidScanModal(siswaId, namaSiswa, autoNext = false, onComplete = null) {
  const siswa = store.state.siswa.find(s => s.id === siswaId);
  if (!siswa) return;

  const html = `
    <div class="modal-head">
      <h3>Daftarkan Kartu RFID</h3>
      <button class="close-x" id="modal-close">&times;</button>
    </div>
    <div class="modal-body" style="text-align:center; padding:24px 20px;">
      <div style="font-size:48px; margin-bottom:8px; animation:popIn 0.3s ease;">💳</div>
      <h2 style="margin:0 0 4px 0; font-size:18px; color:var(--ink);">${escapeHtml(namaSiswa)}</h2>
      <div style="font-size:12.5px; color:var(--ink-soft); font-family:'IBM Plex Mono',monospace; margin-bottom:18px;">
        KELAS: ${escapeHtml(siswa.kelas)} • NIS: ${escapeHtml(siswa.nis || '-')}
      </div>

      <div style="background:var(--paper-dim); border:2px dashed var(--line); border-radius:14px; padding:16px; margin-bottom:14px;">
        <div style="font-size:13px; font-weight:700; color:var(--ink); margin-bottom:8px;">Tempelkan kartu RFID 125KHz ke reader sekarang</div>
        <input type="text" id="rfid-scan-modal-input" placeholder="Menunggu kartu..." style="width:100%; text-align:center; font-family:'IBM Plex Mono',monospace; font-size:18px; font-weight:700; padding:12px; border:2px solid var(--green); border-radius:10px; background:var(--paper); color:var(--ink);" autocomplete="off">
        <div id="rfid-modal-status" style="margin-top:10px; font-size:13px; font-weight:600; min-height:22px;"></div>
      </div>
      ${autoNext ? `<div style="font-size:11.5px; color:var(--primary); font-weight:600;">⚡ Mode Beruntun Aktif: Otomatis lanjut ke siswa berikutnya setelah berhasil.</div>` : ''}
    </div>
    <div class="modal-foot" style="justify-content:center;">
      <button class="btn btn-secondary" id="modal-cancel">Batal</button>
    </div>
  `;

  openModal(html);

  const inputEl = document.getElementById('rfid-scan-modal-input');
  const statusEl = document.getElementById('rfid-modal-status');
  setTimeout(() => inputEl?.focus(), 150);

  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const uid = inputEl.value.trim();
      inputEl.value = '';
      if (!uid) return;

      statusEl.textContent = 'Memproses kartu...';
      statusEl.style.color = 'var(--ink-soft)';

      const res = registerRfidUid(siswaId, uid);
      if (res.success) {
        statusEl.textContent = '✅ ' + res.message;
        statusEl.style.color = '#10b981';
        toast(res.message, 'success');

        setTimeout(() => {
          if (autoNext) {
            const nextStudent = store.state.siswa.find(s => s.id !== siswaId && (!s.rfidUid || !s.rfidUid.trim()));
            if (nextStudent) {
              closeModal();
              openRfidScanModal(nextStudent.id, nextStudent.nama, true, onComplete);
            } else {
              toast('Selamat! Semua siswa telah selesai didaftarkan kartu RFID.', 'success');
              closeModal();
              if (onComplete) onComplete();
            }
          } else {
            closeModal();
            if (onComplete) onComplete();
          }
        }, 900);
      } else {
        statusEl.textContent = '❌ ' + res.message;
        statusEl.style.color = '#ef4444';
        toast(res.message, 'error');
        setTimeout(() => inputEl.focus(), 200);
      }
    }
  });
}

function openQuickRegisterRfidModal(unknownUid) {
  const unregSiswa = store.state.siswa.slice().sort((a,b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  openModal(`
    <div class="modal-head">
      <h3>Daftarkan Kartu RFID</h3>
      <button class="close-x" id="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--paper-dim); padding:12px; border-radius:10px; margin-bottom:14px; text-align:center;">
        <div style="font-size:12px; color:var(--ink-soft);">UID Kartu Terbaca:</div>
        <div style="font-family:'IBM Plex Mono',monospace; font-size:18px; font-weight:800; color:var(--primary);">${escapeHtml(unknownUid)}</div>
      </div>
      <div class="form-group">
        <label>Pilih Siswa Pemilik Kartu Ini:</label>
        <select id="quick-rfid-siswa-select" style="width:100%;">
          ${unregSiswa.map(s => `
            <option value="${s.id}">
              ${escapeHtml(s.nama)} (${escapeHtml(s.kelas)}) - NIS: ${escapeHtml(s.nis || '-')} ${s.rfidUid ? `[Ganti UID: ${s.rfidUid}]` : ''}
            </option>
          `).join('')}
        </select>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="modal-cancel">Batal</button>
      <button class="btn btn-primary" id="btn-save-quick-rfid">Simpan & Daftarkan</button>
    </div>
  `);

  document.getElementById('btn-save-quick-rfid')?.addEventListener('click', () => {
    const sId = document.getElementById('quick-rfid-siswa-select').value;
    const res = registerRfidUid(sId, unknownUid);
    if (res.success) {
      toast(res.message, 'success');
      closeModal();
      processRfidOrQrScan(unknownUid);
    } else {
      toast(res.message, 'error');
    }
  });
}

// ------------------------------------------
// TAB 3: REKAPITULASI KEHADIRAN (Harian & Bulanan)
// ------------------------------------------
function renderRekapTab(container, selectedDate, kelasList) {
  const wasSearchFocused = document.activeElement?.id === 'rekap-search';
  const selStart = wasSearchFocused ? document.activeElement.selectionStart : null;
  const selEnd = wasSearchFocused ? document.activeElement.selectionEnd : null;

  const kelasFilter = store.ui.absensiKelasFilter || '';
  const statusFilter = store.ui.absensiStatusFilter || '';
  const rekapSearch = store.ui.absensiSearch || '';
  const rekapMode = store.ui.absensiRekapMode || 'harian'; // 'harian' | 'bulanan'

  const stats = getStatistikAbsensi(selectedDate, kelasFilter);

  const filteredStudents = store.state.siswa.filter(s => {
    if (kelasFilter && s.kelas !== kelasFilter) return false;
    if (rekapSearch && !s.nama.toLowerCase().includes(rekapSearch.toLowerCase()) && !(s.nis || '').includes(rekapSearch) && !(s.rfidUid || '').includes(rekapSearch)) return false;
    const rec = stats.records.find(r => r.siswaId === s.id);
    const currentStatus = rec ? rec.status : 'belum';
    if (statusFilter && currentStatus !== statusFilter) return false;
    return true;
  }).sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

  container.innerHTML = `
    <!-- Segmented Tab: Rekap Harian vs Bulanan -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
      <div class="tabs" style="margin:0;">
        <button class="tab-btn ${rekapMode === 'harian' ? 'active' : ''}" id="btn-mode-harian">📅 Rekap Harian</button>
        <button class="tab-btn ${rekapMode === 'bulanan' ? 'active' : ''}" id="btn-mode-bulanan">📊 Rekap Bulanan per Siswa</button>
      </div>

      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary btn-sm" id="btn-catat-manual">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M12 5v14M5 12h14"/></svg>
          Catat Manual / Izin
        </button>
        <button class="btn btn-primary btn-sm" id="btn-export-excel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export Excel
        </button>
      </div>
    </div>

    ${rekapMode === 'harian' ? `
      <!-- Toolbar Rekap Harian -->
      <div class="toolbar" style="margin-bottom:14px;">
        <div class="toolbar-left" style="flex-wrap:wrap; gap:8px;">
          <input class="search-input" id="rekap-search" placeholder="Cari nama, NIS, RFID..." value="${escapeAttr(rekapSearch)}">
          <div style="display:flex; align-items:center; gap:6px;">
            <label style="font-weight:600; font-size:13px; color:var(--ink);">Tanggal:</label>
            <input type="date" id="rekap-date-picker" value="${selectedDate}" style="font-size:13px; padding:5px 8px;">
            <button class="btn btn-sm btn-ghost" id="btn-rekap-hari-ini" style="font-size:12px;">Hari Ini</button>
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
        <div class="toolbar-right">
          <button class="btn btn-sm btn-outline" id="btn-bulk-hadir" title="Tandai semua siswa belum hadir jadi hadir">
            ✓ Tandai Semua Hadir
          </button>
        </div>
      </div>

      <!-- Stat Cards Harian -->
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
          <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
          <div class="label">Solat Duha / Dzuhur</div>
          <div class="value">${stats.duha || 0} / ${stats.dzuhur || 0}</div>
          <div class="foot">${stats.duha || 0} Duha • ${stats.dzuhur || 0} Dzuhur</div>
        </div>
        <div class="stat-card rust">
          <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div>
          <div class="label">Belum Hadir / Alpa</div>
          <div class="value">${stats.belumHadir + stats.alpa}</div>
          <div class="foot">${stats.belumHadir} belum • ${stats.alpa} alpa</div>
        </div>
      </div>

      <!-- Tabel Harian -->
      <div class="card" style="padding:0;">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th style="width:35px; text-align:center;">No</th>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th>Status</th>
                <th>Masuk</th>
                <th>Pulang</th>
                <th>☀️ Duha</th>
                <th>🕌 Dzuhur</th>
                <th>Keterangan</th>
                <th style="width:110px; text-align:center;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.length === 0 ? `
                <tr><td colspan="10" style="text-align:center; padding:24px; color:var(--ink-soft);">Tidak ada data yang cocok dengan filter.</td></tr>
              ` : filteredStudents.map((s, idx) => {
                const rec = stats.records.find(r => r.siswaId === s.id);
                let statusBadge = '<span class="badge" style="background:var(--paper-dim); color:var(--ink-soft);">Belum Hadir</span>';
                let jMsk = '-';
                let jPlg = '-';
                let jDuh = '-';
                let jDzu = '-';
                let ket = '-';

                if (rec) {
                  jMsk = formatTimeDisplay(rec.jamMasuk);
                  jPlg = formatTimeDisplay(rec.jamPulang);
                  jDuh = formatTimeDisplay(rec.jamDuha);
                  jDzu = formatTimeDisplay(rec.jamDzuhur);
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
                    <td>${statusBadge}</td>
                    <td class="monospace">${jMsk}</td>
                    <td class="monospace">${jPlg}</td>
                    <td class="monospace">${jDuh}</td>
                    <td class="monospace">${jDzu}</td>
                    <td style="color:var(--ink-soft); max-width:140px; font-size:12px;">${escapeHtml(ket)}</td>
                    <td style="text-align:center; white-space:nowrap;">
                      ${!rec ? `
                        <button class="btn btn-sm btn-outline" data-quick-hadir="${s.id}" title="Tandai Hadir Tepat Waktu" style="padding:2px 8px; font-size:11.5px;">
                          ✓ Hadir
                        </button>
                      ` : ''}
                      ${waUrl ? `
                        <a href="${waUrl}" target="_blank" class="btn btn-sm" style="background:#25D366; color:#fff; padding:3px 6px; border:none; display:inline-flex; align-items:center;" title="Kirim WA">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        </a>
                      ` : ''}
                      <button class="btn btn-sm btn-ghost" data-edit-absen="${s.id}" title="Ubah Detail">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:13px;height:13px;"><path d="M4 20h4L18 10l-4-4L4 16v4z"/></svg>
                      </button>
                      ${rec ? `
                        <button class="btn btn-sm btn-ghost" data-del-absen="${rec.id}" title="Hapus">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:13px;height:13px;"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
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
    ` : `
      <!-- Toolbar Rekap Bulanan -->
      <div class="toolbar" style="margin-bottom:14px;">
        <div class="toolbar-left" style="align-items:center; flex-wrap:wrap; gap:8px;">
          <span style="font-size:13px; font-weight:600; color:var(--ink);">Bulan & Tahun:</span>
          <select id="rekap-bulan-select">
            ${BULAN.map((b, i) => `<option value="${i + 1}" ${(store.ui.rekapBulan || new Date().getMonth() + 1) === i + 1 ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
          <select id="rekap-tahun-select">
            ${[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => `
              <option value="${y}" ${(store.ui.rekapTahun || new Date().getFullYear()) === y ? 'selected' : ''}>${y}</option>
            `).join('')}
          </select>
          <select id="rekap-kelas-filter">
            <option value="">Semua Kelas</option>
            ${kelasList.map(k => `<option value="${escapeAttr(k)}" ${kelasFilter === k ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Tabel Akumulasi Bulanan -->
      <div class="card" style="padding:0;">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th style="width:35px; text-align:center;">No</th>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th style="text-align:center;">Hadir</th>
                <th style="text-align:center;">Telat</th>
                <th style="text-align:center;">Total Masuk</th>
                <th style="text-align:center;">☀️ Duha</th>
                <th style="text-align:center;">🕌 Dzuhur</th>
                <th style="text-align:center;">Izin</th>
                <th style="text-align:center;">Sakit</th>
                <th style="text-align:center;">Alpa</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.map((s, idx) => {
                const bVal = store.ui.rekapBulan || new Date().getMonth() + 1;
                const yVal = store.ui.rekapTahun || new Date().getFullYear();
                const riw = getRiwayatAbsensiSiswa(s.id, bVal, yVal);
                const h = riw.filter(r => r.status === 'hadir').length;
                const t = riw.filter(r => r.status === 'terlambat').length;
                const iz = riw.filter(r => r.status === 'izin').length;
                const sk = riw.filter(r => r.status === 'sakit').length;
                const al = riw.filter(r => r.status === 'alpa').length;
                const duh = riw.filter(r => !!r.jamDuha).length;
                const dzu = riw.filter(r => !!r.jamDzuhur).length;

                return `
                  <tr>
                    <td style="text-align:center; color:var(--ink-soft);">${idx + 1}</td>
                    <td><strong>${escapeHtml(s.nama)}</strong></td>
                    <td><span class="kelas-chip">${escapeHtml(s.kelas)}</span></td>
                    <td style="text-align:center; font-weight:700; color:#10b981;">${h}</td>
                    <td style="text-align:center; font-weight:700; color:#f59e0b;">${t}</td>
                    <td style="text-align:center; font-weight:800; font-family:'IBM Plex Mono',monospace;">${h + t}</td>
                    <td style="text-align:center; color:#b08d00; font-weight:600;">${duh}</td>
                    <td style="text-align:center; color:#047857; font-weight:600;">${dzu}</td>
                    <td style="text-align:center;">${iz}</td>
                    <td style="text-align:center;">${sk}</td>
                    <td style="text-align:center; color:#ef4444; font-weight:700;">${al}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `}
  `;

  // Rekap Mode Switcher
  document.getElementById('btn-mode-harian')?.addEventListener('click', () => {
    store.ui.absensiRekapMode = 'harian';
    renderRekapTab(container, selectedDate, kelasList);
  });
  document.getElementById('btn-mode-bulanan')?.addEventListener('click', () => {
    store.ui.absensiRekapMode = 'bulanan';
    renderRekapTab(container, selectedDate, kelasList);
  });

  // Search input
  const rekapSearchEl = document.getElementById('rekap-search');
  rekapSearchEl?.addEventListener('input', e => {
    store.ui.absensiSearch = e.target.value;
    renderRekapTab(container, selectedDate, kelasList);
  });
  if (wasSearchFocused && rekapSearchEl) {
    rekapSearchEl.focus();
    if (selStart !== null) rekapSearchEl.setSelectionRange(selStart, selEnd);
  }

  document.getElementById('rekap-date-picker')?.addEventListener('change', e => {
    store.ui.absensiTanggal = e.target.value;
    renderAbsensi();
  });
  document.getElementById('btn-rekap-hari-ini')?.addEventListener('click', () => {
    store.ui.absensiTanggal = getTodayDateStr();
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

  document.getElementById('rekap-bulan-select')?.addEventListener('change', e => {
    store.ui.rekapBulan = +e.target.value;
    renderRekapTab(container, selectedDate, kelasList);
  });
  document.getElementById('rekap-tahun-select')?.addEventListener('change', e => {
    store.ui.rekapTahun = +e.target.value;
    renderRekapTab(container, selectedDate, kelasList);
  });

  // Export Excel
  document.getElementById('btn-export-excel')?.addEventListener('click', () => {
    if (rekapMode === 'bulanan') {
      const b = store.ui.rekapBulan || new Date().getMonth() + 1;
      const y = store.ui.rekapTahun || new Date().getFullYear();
      exportRekapBulananExcel(b, y, kelasFilter);
    } else {
      exportAbsensiExcel(selectedDate, kelasFilter);
    }
  });

  // Bulk mark hadir
  document.getElementById('btn-bulk-hadir')?.addEventListener('click', () => {
    const unregIds = filteredStudents.filter(s => !stats.records.find(r => r.siswaId === s.id)).map(s => s.id);
    if (unregIds.length === 0) {
      toast('Semua siswa pada filter ini sudah memiliki catatan absensi.', 'info');
      return;
    }
    openConfirm(`Tandai ${unregIds.length} siswa yang belum hadir menjadi Hadir Tepat Waktu?`, () => {
      markBulkHadir(unregIds, selectedDate);
      renderAbsensi();
    });
  });

  // Quick 1-click hadir
  container.querySelectorAll('[data-quick-hadir]').forEach(b => {
    b.addEventListener('click', () => {
      manualAddOrUpdateAbsensi({
        siswaId: b.dataset.quickHadir,
        tanggal: selectedDate,
        jamMasuk: store.state?.settings?.jamMasuk || '07:00:00',
        status: 'hadir',
        keterangan: 'Tepat Waktu'
      });
      renderAbsensi();
    });
  });

  // Manual Add / Edit Modal
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
// TAB 4: CETAK KARTU SISWA QR & RFID
// ------------------------------------------
async function renderKartuTab(container, kelasList) {
  const wasSearchFocused = document.activeElement?.id === 'kartu-search';
  const selStart = wasSearchFocused ? document.activeElement.selectionStart : null;
  const selEnd = wasSearchFocused ? document.activeElement.selectionEnd : null;
  const kelasFilter = store.ui.absensiKelasFilter || '';
  const search = store.ui.siswaSearch || '';

  const filteredStudents = store.state.siswa.filter(s => {
    const matchKelas = !kelasFilter || s.kelas === kelasFilter;
    const matchSearch = !search || s.nama.toLowerCase().includes(search.toLowerCase()) || (s.nis || '').includes(search) || (s.rfidUid || '').includes(search);
    return matchKelas && matchSearch;
  }).sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

  container.innerHTML = `
    <div class="toolbar" style="margin-bottom:16px;">
      <div class="toolbar-left">
        <input class="search-input" id="kartu-search" placeholder="Cari nama, NIS, RFID..." value="${escapeAttr(search)}">
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
        <span class="spinner"></span> Memuat pratinjau kartu...
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
          <button class="btn btn-sm btn-outline" data-print-single="${s.id}">
            Cetak
          </button>
          <button class="btn btn-sm btn-primary" data-dl-qr="${s.id}">
            Unduh PNG
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
        await downloadStudentQrCardPng(siswa);
        toast('Kartu siswa berhasil didownload PNG', 'success');
      }
    });
  });
}

// Modal Catat Manual
function openManualAbsensiModal(siswaId = null, defaultDate = null) {
  const tanggal = defaultDate || getTodayDateStr();
  const siswaList = store.state.siswa.slice().sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  const initialSiswa = siswaId ? store.state.siswa.find(s => s.id === siswaId) : siswaList[0];
  const existingRecord = initialSiswa ? (store.state.absensi || []).find(a => a.siswaId === initialSiswa.id && a.tanggal === tanggal) : null;

  const currentStatus = existingRecord ? existingRecord.status : 'hadir';
  const isAbsentStatus = currentStatus === 'izin' || currentStatus === 'sakit' || currentStatus === 'alpa';
  const jamMsk = existingRecord ? (existingRecord.jamMasuk || '') : (isAbsentStatus ? '' : getCurrentTimeStr());
  const jamPlg = existingRecord ? (existingRecord.jamPulang || '') : '';
  const jamDuh = existingRecord ? (existingRecord.jamDuha || '') : '';
  const jamDzu = existingRecord ? (existingRecord.jamDzuhur || '') : '';
  const ket = existingRecord ? (existingRecord.keterangan || '') : '';

  const html = `
    <div class="modal-head">
      <h3 id="modal-absen-title">${existingRecord ? 'Ubah Status Absensi' : 'Catat Absensi Manual / Izin'}</h3>
      <button class="close-x" id="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Pilih Siswa</label>
        <select id="modal-absen-siswa" style="width:100%;" ${siswaId ? 'disabled' : ''}>
          ${siswaList.map(s => `
            <option value="${s.id}" ${(initialSiswa && initialSiswa.id === s.id) ? 'selected' : ''}>
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
          <input type="text" id="modal-absen-jam-masuk" value="${jamMsk}" placeholder="07:05:00" class="monospace" style="width:100%;" ${isAbsentStatus ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label>Jam Pulang</label>
          <input type="text" id="modal-absen-jam-pulang" value="${jamPlg}" placeholder="14:00:00" class="monospace" style="width:100%;" ${isAbsentStatus ? 'disabled' : ''}>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>☀️ Jam Solat Duha (opsional)</label>
          <input type="text" id="modal-absen-jam-duha" value="${jamDuh}" placeholder="08:30:00" class="monospace" style="width:100%;" ${isAbsentStatus ? 'disabled' : ''}>
        </div>
        <div class="form-group">
          <label>🕌 Jam Solat Dzuhur (opsional)</label>
          <input type="text" id="modal-absen-jam-dzuhur" value="${jamDzu}" placeholder="12:15:00" class="monospace" style="width:100%;" ${isAbsentStatus ? 'disabled' : ''}>
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

  const selSiswa = document.getElementById('modal-absen-siswa');
  const inTgl = document.getElementById('modal-absen-tgl');
  const selStatus = document.getElementById('modal-absen-status');
  const inJamMasuk = document.getElementById('modal-absen-jam-masuk');
  const inJamPulang = document.getElementById('modal-absen-jam-pulang');
  const inJamDuha = document.getElementById('modal-absen-jam-duha');
  const inJamDzuhur = document.getElementById('modal-absen-jam-dzuhur');
  const inKet = document.getElementById('modal-absen-ket');
  const titleEl = document.getElementById('modal-absen-title');

  const syncFields = (st) => {
    const absent = st === 'izin' || st === 'sakit' || st === 'alpa';
    [inJamMasuk, inJamPulang, inJamDuha, inJamDzuhur].forEach(el => {
      if (el) el.disabled = absent;
    });
    if (absent) {
      if (inJamMasuk) inJamMasuk.value = '';
      if (inJamPulang) inJamPulang.value = '';
      if (inJamDuha) inJamDuha.value = '';
      if (inJamDzuhur) inJamDzuhur.value = '';
    } else if (inJamMasuk && !inJamMasuk.value) {
      inJamMasuk.value = getCurrentTimeStr();
    }
  };

  const syncExisting = () => {
    const sId = selSiswa?.value;
    const tglVal = inTgl?.value;
    const rec = (store.state.absensi || []).find(a => a.siswaId === sId && a.tanggal === tglVal);
    if (titleEl) titleEl.textContent = rec ? 'Ubah Status Absensi' : 'Catat Absensi Manual / Izin';
    if (rec) {
      if (selStatus) selStatus.value = rec.status;
      if (inJamMasuk) inJamMasuk.value = rec.jamMasuk || '';
      if (inJamPulang) inJamPulang.value = rec.jamPulang || '';
      if (inJamDuha) inJamDuha.value = rec.jamDuha || '';
      if (inJamDzuhur) inJamDzuhur.value = rec.jamDzuhur || '';
      if (inKet) inKet.value = rec.keterangan || '';
      syncFields(rec.status);
    } else {
      syncFields(selStatus?.value || 'hadir');
    }
  };

  selSiswa?.addEventListener('change', syncExisting);
  inTgl?.addEventListener('change', syncExisting);
  selStatus?.addEventListener('change', e => syncFields(e.target.value));

  document.getElementById('modal-save-absen')?.addEventListener('click', () => {
    const sId = selSiswa.value;
    const tgl = inTgl.value;
    const st = selStatus.value;
    const jMsk = inJamMasuk.value.trim();
    const jPlg = inJamPulang.value.trim();
    const jDuh = inJamDuha.value.trim();
    const jDzu = inJamDzuhur.value.trim();
    const k = inKet.value.trim();
    const currentRec = (store.state.absensi || []).find(a => a.siswaId === sId && a.tanggal === tgl);

    manualAddOrUpdateAbsensi({
      id: currentRec?.id,
      siswaId: sId,
      tanggal: tgl,
      jamMasuk: (st === 'izin' || st === 'sakit' || st === 'alpa') ? null : (jMsk || null),
      jamPulang: (st === 'izin' || st === 'sakit' || st === 'alpa') ? null : (jPlg || null),
      jamDuha: (st === 'izin' || st === 'sakit' || st === 'alpa') ? null : (jDuh || null),
      jamDzuhur: (st === 'izin' || st === 'sakit' || st === 'alpa') ? null : (jDzu || null),
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
