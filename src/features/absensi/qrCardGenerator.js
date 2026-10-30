import QRCode from 'qrcode';
import { store } from '../../app/state.js';
import { getSchoolLogo } from '../../utils/helpers.js';
import { escapeHtml, escapeAttr } from '../../utils/formatters.js';

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

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function downloadStudentQrCardPng(siswa) {
  const qrDataUrl = await generateQrDataUrl(siswa.nis || siswa.id);
  const settings = store.state?.settings || {};
  const namaSekolah = settings.namaSekolah || 'MTs Yasta Bunter';
  const tahunAjaran = settings.tahunAjaran || '';
  const initials = getStudentInitials(siswa.nama);

  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');

  // Background card with luxury navy gradient
  const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGrad.addColorStop(0, '#0A0F1D');
  bgGrad.addColorStop(0.5, '#131B38');
  bgGrad.addColorStop(1, '#1A214D');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle radial hologram glow in top right
  const radialGlow = ctx.createRadialGradient(880, 80, 10, 880, 80, 320);
  radialGlow.addColorStop(0, 'rgba(252, 211, 77, 0.14)');
  radialGlow.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
  radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top decorative accent line (Gold / Amber)
  const topBarGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  topBarGrad.addColorStop(0, '#F59E0B');
  topBarGrad.addColorStop(0.5, '#FCD34D');
  topBarGrad.addColorStop(1, '#38BDF8');
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 0, canvas.width, 7);

  // Header bottom border line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(35, 105);
  ctx.lineTo(canvas.width - 35, 105);
  ctx.stroke();

  // Load School Logo
  const logoImg = await loadImage(getSchoolLogo());
  if (logoImg) {
    ctx.drawImage(logoImg, 40, 24, 66, 66);
  }

  // School Name & Header Subtitle
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px Outfit, Plus Jakarta Sans, sans-serif';
  ctx.fillText(namaSekolah.toUpperCase(), 122, 57);

  ctx.fillStyle = '#FCD34D';
  ctx.font = 'bold 12.5px Plus Jakarta Sans, sans-serif';
  ctx.fillText('KARTU IDENTITAS SISWA & PRESENSI DIGITAL', 122, 82);

  // Smartcard RFID Chip graphic on top right
  const chipX = 895;
  const chipY = 32;
  const chipW = 65;
  const chipH = 50;
  ctx.fillStyle = '#EAB308';
  ctx.beginPath();
  ctx.roundRect(chipX, chipY, chipW, chipH, 8);
  ctx.fill();
  ctx.strokeStyle = '#CA8A04';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chip inner contacts
  ctx.strokeStyle = '#854D0E';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(chipX + 16, chipY + 12, chipW - 32, chipH - 24, 4);
  ctx.moveTo(chipX, chipY + chipH / 2);
  ctx.lineTo(chipX + chipW, chipY + chipH / 2);
  ctx.moveTo(chipX + chipW / 2, chipY);
  ctx.lineTo(chipX + chipW / 2, chipY + chipH);
  ctx.stroke();

  // ================= STUDENT PHOTO (Left) =================
  const photoX = 40;
  const photoY = 135;
  const photoW = 195;
  const photoH = 260;

  // Photo frame background
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(photoX, photoY, photoW, photoH, 14);
  ctx.fill();

  let hasCustomPhoto = false;
  if (siswa.foto) {
    const studentImg = await loadImage(siswa.foto);
    if (studentImg) {
      hasCustomPhoto = true;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(photoX, photoY, photoW, photoH, 14);
      ctx.clip();
      ctx.drawImage(studentImg, photoX, photoY, photoW, photoH);
      ctx.restore();
    }
  }

  if (!hasCustomPhoto) {
    // Draw Initials
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FCD34D';
    ctx.font = 'bold 56px Outfit, sans-serif';
    ctx.fillText(initials, photoX + photoW / 2, photoY + photoH / 2 + 18);
  }

  // Photo Border
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(photoX, photoY, photoW, photoH, 14);
  ctx.stroke();

  // Badge under Photo
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(photoX, photoY + photoH + 16, photoW, 42, 10);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = siswa.rfidUid ? '#34D399' : '#94A3B8';
  ctx.font = '600 12px IBM Plex Mono, monospace';
  const rfidDisplay = siswa.rfidUid ? `RFID: ${siswa.rfidUid}` : 'RFID SMART CARD';
  ctx.fillText(rfidDisplay, photoX + photoW / 2, photoY + photoH + 42);

  // ================= STUDENT DETAILS (Center) =================
  const infoX = 265;
  ctx.textAlign = 'left';

  // Label Nama
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 12px Plus Jakarta Sans, sans-serif';
  ctx.fillText('NAMA LENGKAP SISWA', infoX, 155);

  // Nama Siswa
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 25px Outfit, Plus Jakarta Sans, sans-serif';
  const nameToDraw = siswa.nama.length > 24 ? siswa.nama.slice(0, 22) + '...' : siswa.nama;
  ctx.fillText(nameToDraw, infoX, 188);

  // Line separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(infoX, 208);
  ctx.lineTo(infoX + 390, 208);
  ctx.stroke();

  // NIS / NISN row
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 12px Plus Jakarta Sans, sans-serif';
  ctx.fillText(siswa.nisn ? 'NIS / NISN' : 'NOMOR INDUK SISWA (NIS)', infoX, 236);

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 19px IBM Plex Mono, monospace';
  const nisVal = `${siswa.nis || '-'}${siswa.nisn ? ` / ${siswa.nisn}` : ''}`;
  ctx.fillText(nisVal, infoX, 264);

  // Kelas & Masa Berlaku Pills
  // Kelas Pill
  const kelasPillW = 160;
  const kelasPillH = 46;
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(infoX, 290, kelasPillW, kelasPillH, 10);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 10.5px Plus Jakarta Sans, sans-serif';
  ctx.fillText('KELAS', infoX + 16, 310);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px Plus Jakarta Sans, sans-serif';
  ctx.fillText(siswa.kelas || '-', infoX + 16, 328);

  // Masa Berlaku Pill
  const taPillX = infoX + kelasPillW + 14;
  const taPillW = 215;
  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(taPillX, 290, taPillW, kelasPillH, 10);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 10.5px Plus Jakarta Sans, sans-serif';
  ctx.fillText('STATUS & MASA BERLAKU', taPillX + 16, 310);
  ctx.fillStyle = '#FCD34D';
  ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
  ctx.fillText(tahunAjaran ? `TA ${tahunAjaran} • Aktif` : 'Siswa Aktif', taPillX + 16, 328);

  // Note text under details
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 12.5px Plus Jakarta Sans, sans-serif';
  ctx.fillText('Kartu identitas resmi terdaftar di sistem gerbang & perpustakaan.', infoX, 395);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 11.5px IBM Plex Mono, monospace';
  ctx.fillText(`ID SISTEM: ${siswa.id.slice(0, 16).toUpperCase()}`, infoX, 420);

  // ================= QR CODE BOX (Right) =================
  const qrBoxX = 690;
  const qrBoxY = 135;
  const qrBoxW = 270;
  const qrBoxH = 320;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // QR Image inside box
  const qrImg = await loadImage(qrDataUrl);
  if (qrImg) {
    ctx.drawImage(qrImg, qrBoxX + 25, qrBoxY + 20, 220, 220);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#1E1B4B';
  ctx.font = 'bold 13px Plus Jakarta Sans, sans-serif';
  ctx.fillText('PINDAI QR PRESENSI', qrBoxX + qrBoxW / 2, qrBoxY + 265);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 10.5px Plus Jakarta Sans, sans-serif';
  ctx.fillText('Arahkan ke kamera gerbang', qrBoxX + qrBoxW / 2, qrBoxY + 288);

  // ================= FOOTER =================
  ctx.fillStyle = '#080C16';
  ctx.fillRect(0, 560, canvas.width, 70);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 560);
  ctx.lineTo(canvas.width, 560);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 12px IBM Plex Mono, monospace';
  const serialLabel = siswa.rfidUid ? `RFID UID: ${siswa.rfidUid}` : `UID: ${siswa.id.slice(0, 12).toUpperCase()}`;
  ctx.fillText(serialLabel, 40, 600);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 12px Plus Jakarta Sans, sans-serif';
  ctx.fillText('Hak Milik Madrasah • Wajib Dibawa Saat Sekolah • EduPass System', canvas.width - 40, 600);

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `Kartu_Depan_${siswa.nama.replace(/\s+/g, '_')}_${siswa.nis || siswa.id}.png`;
  a.click();
}

export async function downloadStudentCardBackPng(siswa) {
  const settings = store.state?.settings || {};
  const namaSekolah = settings.namaSekolah || 'MTs Yasta Bunter';
  const tahunAjaran = settings.tahunAjaran || '';
  const kepalaMadrasah = settings.kepalaMadrasah || 'Kepala Madrasah';
  const nipKepala = settings.nipKepalaMadrasah || '-';
  const alamat = settings.alamatSekolah || 'Kecamatan Sukadana, Kabupaten Ciamis';
  const kota = alamat.split(',')[0].trim() || 'Ciamis';

  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');

  // Background card
  const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGrad.addColorStop(0, '#0A0F1D');
  bgGrad.addColorStop(0.5, '#131B38');
  bgGrad.addColorStop(1, '#1A214D');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top decorative accent line (Amber)
  const topBarGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  topBarGrad.addColorStop(0, '#F59E0B');
  topBarGrad.addColorStop(0.5, '#FCD34D');
  topBarGrad.addColorStop(1, '#38BDF8');
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 0, canvas.width, 7);

  // Header bottom border line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(35, 105);
  ctx.lineTo(canvas.width - 35, 105);
  ctx.stroke();

  // Load School Logo
  const logoImg = await loadImage(getSchoolLogo());
  if (logoImg) {
    ctx.drawImage(logoImg, 40, 24, 66, 66);
  }

  // School Name & Header Subtitle
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px Outfit, Plus Jakarta Sans, sans-serif';
  ctx.fillText(namaSekolah.toUpperCase(), 122, 57);

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 12.5px Plus Jakarta Sans, sans-serif';
  ctx.fillText('KETENTUAN, TATA TERTIB & PENGESAHAN KARTU SISWA', 122, 82);

  // ================= LEFT BOX: RULES =================
  const rulesBoxX = 40;
  const rulesBoxY = 135;
  const rulesBoxW = 520;
  const rulesBoxH = 405;

  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(rulesBoxX, rulesBoxY, rulesBoxW, rulesBoxH, 16);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 17px Plus Jakarta Sans, sans-serif';
  ctx.fillText('Ketentuan Penggunaan Kartu:', rulesBoxX + 28, rulesBoxY + 45);

  const rules = [
    '1. Kartu ini adalah tanda identitas resmi siswa yang sah.',
    '2. Wajib dibawa setiap hari sekolah untuk presensi QR & RFID gerbang.',
    '3. Dilarang memindahtangankan, merusak, atau menyalahgunakan kartu.',
    '4. Apabila kartu hilang atau tercecer, segera laporkan ke pihak madrasah.'
  ];

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '14.5px Plus Jakarta Sans, sans-serif';
  let ry = rulesBoxY + 95;
  rules.forEach(r => {
    ctx.fillText(r, rulesBoxX + 28, ry);
    ry += 52;
  });

  ctx.fillStyle = '#64748B';
  ctx.font = '500 12px IBM Plex Mono, monospace';
  ctx.fillText('Catatan: Kartu berlaku selama yang bersangkutan menjadi siswa aktif.', rulesBoxX + 28, rulesBoxY + 365);

  // ================= RIGHT BOX: ENDORSEMENT =================
  const authBoxX = 585;
  const authBoxY = 135;
  const authBoxW = 375;
  const authBoxH = 405;

  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.roundRect(authBoxX, authBoxY, authBoxW, authBoxH, 16);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  const authCenterX = authBoxX + authBoxW / 2;

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 14px Plus Jakarta Sans, sans-serif';
  const thAjar = tahunAjaran.split('/')[0] || new Date().getFullYear();
  ctx.fillText(`${kota}, Juli ${thAjar}`, authCenterX, authBoxY + 50);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '600 14.5px Plus Jakarta Sans, sans-serif';
  ctx.fillText('Mengetahui,', authCenterX, authBoxY + 76);
  ctx.fillText('Kepala Madrasah', authCenterX, authBoxY + 98);

  // Digital Stamp Box
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(authCenterX - 95, authBoxY + 125, 190, 52, 10);
  ctx.stroke();

  ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.fill();

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 12px IBM Plex Mono, monospace';
  ctx.fillText('STEMPEL RESMI DIGITAL', authCenterX, authBoxY + 156);

  // Headmaster Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Outfit, Plus Jakarta Sans, sans-serif';
  ctx.fillText(kepalaMadrasah, authCenterX, authBoxY + 245);

  // Underline for name
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(authCenterX - 110, authBoxY + 255);
  ctx.lineTo(authCenterX + 110, authBoxY + 255);
  ctx.stroke();

  // NIP
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 13px IBM Plex Mono, monospace';
  ctx.fillText(`NIP. ${nipKepala}`, authCenterX, authBoxY + 282);

  // School Address
  ctx.fillStyle = '#64748B';
  ctx.font = '500 11.5px Plus Jakarta Sans, sans-serif';
  ctx.fillText(alamat, authCenterX, authBoxY + 355);

  // ================= FOOTER =================
  ctx.fillStyle = '#080C16';
  ctx.fillRect(0, 560, canvas.width, 70);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 560);
  ctx.lineTo(canvas.width, 560);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 12px IBM Plex Mono, monospace';
  const serialLabel = siswa.rfidUid ? `RFID UID: ${siswa.rfidUid}` : `UID: ${siswa.id.slice(0, 12).toUpperCase()}`;
  ctx.fillText(serialLabel, 40, 600);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 12px Plus Jakarta Sans, sans-serif';
  ctx.fillText(`${alamat} • EduPass System`, canvas.width - 40, 600);

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `Kartu_Belakang_${siswa.nama.replace(/\s+/g, '_')}_${siswa.nis || siswa.id}.png`;
  a.click();
}

export async function renderStudentCardHtml(siswa, options = {}) {
  const qrDataUrl = await generateQrDataUrl(siswa.nis || siswa.id);
  const settings = store.state?.settings || {};
  const namaSekolah = settings.namaSekolah || 'Sekolah';
  const tahunAjaran = settings.tahunAjaran || '';
  const kepalaMadrasah = settings.kepalaMadrasah || 'Kepala Madrasah';
  const nipKepala = settings.nipKepalaMadrasah || '-';
  const alamat = settings.alamatSekolah || 'Madrasah Tsanawiyah';
  const kota = alamat.split(',')[0].trim() || 'Ciamis';
  const initials = getStudentInitials(siswa.nama);
  const rfidBadge = siswa.rfidUid
    ? `RFID: ${escapeHtml(siswa.rfidUid)}`
    : `ID: ${siswa.id.slice(0, 10).toUpperCase()}`;

  const sideClass = options.side === 'back' ? 'show-back' : '';

  return `
    <div class="id-card ${sideClass}" id="id-card-${siswa.id}" data-card-id="${siswa.id}">
      <div class="id-card-holo"></div>
      
      <!-- Card Front Side -->
      <div class="id-card-face id-card-front">
        <div class="id-card-header">
          <div class="id-card-logo">
            <img src="${getSchoolLogo()}" alt="Logo">
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
            ${siswa.foto ? `<img src="${escapeAttr(siswa.foto)}" alt="Foto" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">` : `<div class="student-avatar-initials">${initials}</div>`}
          </div>

          <div class="id-card-info">
            <div class="info-row">
              <span class="info-label">NAMA LENGKAP</span>
              <span class="info-val student-name" title="${escapeHtml(siswa.nama)}">${escapeHtml(siswa.nama)}</span>
            </div>
            <div class="info-row-grid">
              <div class="info-row">
                <span class="info-label">${siswa.nisn ? 'NIS / NISN' : 'NIS'}</span>
                <span class="info-val monospace">${escapeHtml(siswa.nis || '-')}${siswa.nisn ? ` / ${escapeHtml(siswa.nisn)}` : ''}</span>
              </div>
              <div class="info-row">
                <span class="info-label">KELAS</span>
                <span class="info-val badge-kelas">${escapeHtml(siswa.kelas)}</span>
              </div>
            </div>
            <div class="info-row">
              <span class="info-label">STATUS & MASA BERLAKU</span>
              <span class="info-val" style="font-size:10.5px;">${escapeHtml(tahunAjaran ? `TA ${tahunAjaran} • Siswa Aktif` : 'Siswa Aktif')}</span>
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

      <!-- Card Back Side -->
      <div class="id-card-face id-card-back">
        <div class="id-card-header back-header">
          <div class="id-card-logo">
            <img src="${getSchoolLogo()}" alt="Logo">
          </div>
          <div class="id-card-school">
            <div class="school-name">${escapeHtml(namaSekolah)}</div>
            <div class="card-subtitle-back">TATA TERTIB & KETENTUAN KARTU</div>
          </div>
        </div>

        <div class="id-card-body back-body">
          <ol class="card-rules-list">
            <li>Kartu tanda pengenal resmi siswa dan wajib dibawa saat kegiatan madrasah.</li>
            <li>Digunakan untuk presensi gerbang otomatis (QR & RFID 125KHz).</li>
            <li>Dilarang mencoret, merusak, atau memindahtangankan kartu ke pihak lain.</li>
            <li>Jika kartu hilang/rusak, segera melapor ke Tata Usaha / Bendahara.</li>
          </ol>

          <div class="card-back-meta">
            <div class="meta-city-date">${escapeHtml(kota)}, Juli ${escapeHtml(tahunAjaran.split('/')[0] || '')}</div>
            <div class="meta-role">Mengetahui, Kepala Madrasah</div>
            <div class="meta-stamp-row">
              <span class="meta-stamp-pill">STEMPEL DIGITAL</span>
            </div>
            <div class="meta-name">${escapeHtml(kepalaMadrasah)}</div>
            <div class="meta-nip">NIP. ${escapeHtml(nipKepala)}</div>
          </div>
        </div>

        <div class="id-card-footer back-footer">
          <div class="id-card-serial">${rfidBadge}</div>
          <div class="id-card-note">${escapeHtml(alamat)}</div>
        </div>
      </div>
    </div>
  `;
}
