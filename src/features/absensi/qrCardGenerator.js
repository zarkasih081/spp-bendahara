import QRCode from 'qrcode';
import { store } from '../../app/state.js';
import { LOGO_BASE64 } from '../../utils/constants.js';
import { escapeHtml } from '../../utils/formatters.js';

export async function generateQrDataUrl(text) {
  try {
    return await QRCode.toDataURL(text, {
      width: 280,
      margin: 1,
      color: {
        dark: '#1F2059',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });
  } catch (err) {
    console.error('Failed to generate QR code', err);
    return '';
  }
}

export function getStudentInitials(name) {
  if (!name) return 'SW';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export async function downloadStudentQrCardPng(siswa) {
  const qrDataUrl = await generateQrDataUrl(siswa.nis || siswa.id);
  const settings = store.state?.settings || {};
  const namaSekolah = settings.namaSekolah || 'MTs Yasta Bunter';
  const tahunAjaran = settings.tahunAjaran || '';

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');

  // Background card
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header gradient
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 160);
  grad.addColorStop(0, '#1E1B4B');
  grad.addColorStop(1, '#333594');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, 155);

  // Accent top bar
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(0, 0, canvas.width, 6);

  // School Name & Subtitle
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Outfit, Plus Jakarta Sans, sans-serif';
  ctx.fillText(namaSekolah.toUpperCase(), canvas.width / 2, 68);

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
  ctx.fillText('KARTU QR PRESENSI & IDENTITAS SISWA', canvas.width / 2, 98);

  if (tahunAjaran) {
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 13px Plus Jakarta Sans, sans-serif';
    ctx.fillText(`Tahun Ajaran ${tahunAjaran}`, canvas.width / 2, 124);
  }

  // White QR container box
  const qrBoxSize = 330;
  const qrBoxX = (canvas.width - qrBoxSize) / 2;
  const qrBoxY = 185;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 24);
  ctx.fill();

  // Draw QR Image inside box
  const qrImg = new Image();
  await new Promise((resolve) => {
    qrImg.onload = resolve;
    qrImg.onerror = resolve;
    qrImg.src = qrDataUrl;
  });
  ctx.drawImage(qrImg, qrBoxX + 25, qrBoxY + 25, qrBoxSize - 50, qrBoxSize - 50);

  // Student Name
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 26px Outfit, Plus Jakarta Sans, sans-serif';
  const displayName = siswa.nama.length > 28 ? siswa.nama.slice(0, 26) + '...' : siswa.nama;
  ctx.fillText(displayName, canvas.width / 2, 568);

  // NIS & Kelas Pill
  const metaText = `NIS: ${siswa.nis || '-'}   •   KELAS: ${siswa.kelas || '-'}`;
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(110, 592, 380, 44, 22);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 16px IBM Plex Mono, monospace';
  ctx.fillText(metaText, canvas.width / 2, 620);

  // Footer instructions
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 13px Plus Jakarta Sans, sans-serif';
  ctx.fillText('Tunjukkan kode QR ini ke pemindai kamera gerbang sekolah', canvas.width / 2, 690);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 11px IBM Plex Mono, monospace';
  const serialLabel = siswa.rfidUid ? `RFID UID: ${siswa.rfidUid}` : `ID: ${siswa.id.slice(0, 10).toUpperCase()}`;
  ctx.fillText(`${serialLabel} • Sistem EduPass`, canvas.width / 2, 722);

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `Kartu_QR_${siswa.nama.replace(/\s+/g, '_')}_${siswa.nis || siswa.id}.png`;
  a.click();
}

export async function renderStudentCardHtml(siswa, options = {}) {
  const qrDataUrl = await generateQrDataUrl(siswa.nis || siswa.id);
  const settings = store.state?.settings || {};
  const namaSekolah = settings.namaSekolah || 'Sekolah';
  const tahunAjaran = settings.tahunAjaran || '';
  const initials = getStudentInitials(siswa.nama);
  const rfidBadge = siswa.rfidUid
    ? `RFID: ${escapeHtml(siswa.rfidUid)}`
    : `ID: ${siswa.id.slice(0, 10).toUpperCase()}`;

  return `
    <div class="id-card ${options.side === 'back' ? 'back' : 'front'}" id="id-card-${siswa.id}">
      <div class="id-card-holo"></div>
      
      <!-- Card Front Side -->
      <div class="id-card-face id-card-front">
        <div class="id-card-header">
          <div class="id-card-logo">
            <img src="${LOGO_BASE64}" alt="Logo">
          </div>
          <div class="id-card-school">
            <div class="school-name">${escapeHtml(namaSekolah)}</div>
            <div class="card-subtitle">KARTU IDENTITAS & PRESENSI SISWA</div>
          </div>
          <div class="id-card-chip" title="${siswa.rfidUid ? 'Kartu RFID 125KHz Terdaftar' : 'QR Presensi Aktif'}">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${siswa.rfidUid ? '#34D399' : '#FCD34D'}" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 9h6M14 12h4M14 15h6"/></svg>
          </div>
        </div>

        <div class="id-card-body">
          <div class="student-avatar-box">
            <div class="student-avatar-initials">${initials}</div>
          </div>

          <div class="id-card-info">
            <div class="info-row">
              <span class="info-label">NAMA LENGKAP</span>
              <span class="info-val student-name" title="${escapeHtml(siswa.nama)}">${escapeHtml(siswa.nama)}</span>
            </div>
            <div class="info-row-grid">
              <div class="info-row">
                <span class="info-label">NIS</span>
                <span class="info-val monospace">${escapeHtml(siswa.nis || '-')}</span>
              </div>
              <div class="info-row">
                <span class="info-label">KELAS</span>
                <span class="info-val badge-kelas">${escapeHtml(siswa.kelas)}</span>
              </div>
            </div>
            <div class="info-row">
              <span class="info-label">TAHUN AJARAN</span>
              <span class="info-val" style="font-size:11px;">${escapeHtml(tahunAjaran)}</span>
            </div>
          </div>

          <div class="id-card-qr-box">
            <img src="${qrDataUrl}" alt="QR Code" class="id-card-qr-img">
            <span class="qr-sub">RFID / QR</span>
          </div>
        </div>

        <div class="id-card-footer">
          <div class="id-card-serial">${rfidBadge}</div>
          <div class="id-card-note">Tap Kartu RFID / Scan QR di Gerbang</div>
        </div>
      </div>
    </div>
  `;
}
