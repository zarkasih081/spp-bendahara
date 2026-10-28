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

export async function renderStudentCardHtml(siswa, options = {}) {
  const qrDataUrl = await generateQrDataUrl(siswa.nis || siswa.id);
  const settings = store.state?.settings || {};
  const namaSekolah = settings.namaSekolah || 'Sekolah';
  const tahunAjaran = settings.tahunAjaran || '';
  const initials = getStudentInitials(siswa.nama);

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
            <div class="card-subtitle">KARTU IDENTITAS SISWA</div>
          </div>
          <div class="id-card-chip">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#FCD34D" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 9h6M14 12h4M14 15h6"/></svg>
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
            <span class="qr-sub">SCAN ABSEN</span>
          </div>
        </div>

        <div class="id-card-footer">
          <div class="id-card-serial">ID: ${siswa.id.slice(0, 10).toUpperCase()}</div>
          <div class="id-card-note">Gunakan untuk tap absensi & administrasi sekolah</div>
        </div>
      </div>
    </div>
  `;
}
