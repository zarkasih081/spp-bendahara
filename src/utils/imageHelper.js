import { escapeHtml, escapeAttr } from './formatters.js';

export function getStudentInitials(name) {
  if (!name) return 'SW';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * Resizes and center-crops an uploaded image file into a square base64 JPEG
 * to ensure crisp display while keeping localStorage lightweight (~20KB-35KB).
 */
export function compressImageFile(file, size = 300, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('File harus berupa gambar (JPG, PNG, WebP)'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Draw with white background in case of transparent PNG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);

        // Center-crop square logic
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Generates an HTML avatar element for a student (photo if available, or stylized initials fallback)
 */
export function renderAvatarHtml(siswa, size = 34, className = '') {
  if (!siswa) return '';
  const initials = getStudentInitials(siswa.nama);

  if (siswa.foto) {
    return `<img src="${escapeAttr(siswa.foto)}" alt="${escapeAttr(siswa.nama || '')}" class="student-avatar-img ${className}" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover; display:inline-block; vertical-align:middle; flex-shrink:0; border:1px solid var(--line); box-shadow:0 1px 3px rgba(0,0,0,0.08);">`;
  }

  // Consistent pleasant color based on student name hash
  const colors = [
    { bg: 'rgba(67, 56, 202, 0.12)', text: '#4338CA', border: 'rgba(67, 56, 202, 0.25)' },
    { bg: 'rgba(14, 165, 233, 0.12)', text: '#0284C7', border: 'rgba(14, 165, 233, 0.25)' },
    { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669', border: 'rgba(16, 185, 129, 0.25)' },
    { bg: 'rgba(245, 158, 11, 0.12)', text: '#D97706', border: 'rgba(245, 158, 11, 0.25)' },
    { bg: 'rgba(139, 92, 246, 0.12)', text: '#7C3AED', border: 'rgba(139, 92, 246, 0.25)' }
  ];
  let hash = 0;
  for (let i = 0; i < (siswa.nama || '').length; i++) hash += (siswa.nama || '').charCodeAt(i);
  const color = colors[Math.abs(hash) % colors.length];

  return `
    <span class="student-avatar-initials-pill ${className}" style="width:${size}px; height:${size}px; border-radius:50%; background:${color.bg}; color:${color.text}; border:1px solid ${color.border}; display:inline-flex; align-items:center; justify-content:center; font-size:${Math.round(size * 0.42)}px; font-weight:700; flex-shrink:0; vertical-align:middle; user-select:none; font-family:'Outfit', sans-serif;">
      ${escapeHtml(initials)}
    </span>
  `;
}

