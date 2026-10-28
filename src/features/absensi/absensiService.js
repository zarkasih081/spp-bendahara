import { store } from '../../app/state.js';
import { saveData } from '../../data/database.js';
import { uid, toast } from '../../utils/helpers.js';
import * as XLSX from 'xlsx';

export function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeStr() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatTimeDisplay(timeStr) {
  if (!timeStr) return '-';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]} WIB`;
  }
  return timeStr;
}

export function playScanSound(type = 'success') {
  if (store.state?.settings?.beepAudio === false) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Harmonic 2-tone chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'warning') {
      // Double beep for already scanned
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Error buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Audio context may require prior user interaction
  }
}

// Find student by scanned QR code (NIS, ID, or JSON payload)
export function parseSiswaFromQr(rawCode) {
  if (!rawCode) return null;
  const code = String(rawCode).trim();
  
  // 1. Try match by NIS directly
  let siswa = store.state.siswa.find(s => s.nis && s.nis.trim() === code);
  if (siswa) return siswa;

  // 2. Try match by ID directly
  siswa = store.state.siswa.find(s => s.id === code);
  if (siswa) return siswa;

  // 3. Try match if code is formatted like "SISWA:12345" or "NIS:12345"
  if (code.includes(':')) {
    const parts = code.split(':');
    const val = parts[1]?.trim();
    if (val) {
      siswa = store.state.siswa.find(s => (s.nis && s.nis.trim() === val) || s.id === val);
      if (siswa) return siswa;
    }
  }

  // 4. Try parse as JSON
  try {
    const obj = JSON.parse(code);
    if (obj.nis) {
      siswa = store.state.siswa.find(s => s.nis && s.nis.trim() === String(obj.nis).trim());
      if (siswa) return siswa;
    }
    if (obj.id) {
      siswa = store.state.siswa.find(s => s.id === obj.id);
      if (siswa) return siswa;
    }
  } catch (err) {}

  return null;
}

export function catatAbsenByKode(rawCode) {
  const siswa = parseSiswaFromQr(rawCode);
  if (!siswa) {
    playScanSound('error');
    return {
      success: false,
      message: 'Kartu QR tidak dikenali atau siswa tidak terdaftar dalam sistem!'
    };
  }

  const tanggal = getTodayDateStr();
  const jamSekarang = getCurrentTimeStr();
  const jamMasukBatas = store.state.settings.jamMasuk || '07:15';
  const jamPulangBatas = store.state.settings.jamPulang || '14:00';

  if (!store.state.absensi) store.state.absensi = [];

  // Find existing record for this student today
  const existingIndex = store.state.absensi.findIndex(a => a.siswaId === siswa.id && a.tanggal === tanggal);
  const nowMs = Date.now();

  if (existingIndex === -1) {
    // Record Absen Masuk
    const isTerlambat = jamSekarang.slice(0, 5) > jamMasukBatas;
    const status = isTerlambat ? 'terlambat' : 'hadir';

    const record = {
      id: uid(),
      siswaId: siswa.id,
      tanggal,
      jamMasuk: jamSekarang,
      jamPulang: null,
      status,
      keterangan: isTerlambat ? `Terlambat (Batas ${jamMasukBatas})` : 'Tepat Waktu',
      waktuScanMasuk: nowMs,
      waktuScanPulang: null
    };

    store.state.absensi.unshift(record);
    saveData();
    playScanSound('success');

    return {
      success: true,
      type: 'masuk',
      siswa,
      record,
      status,
      message: `Absen Masuk Berhasil: ${siswa.nama} (${formatTimeDisplay(jamSekarang)})`
    };
  } else {
    const record = store.state.absensi[existingIndex];

    // Debounce: If scanned within 20 seconds, ignore duplicate
    const lastScanMs = record.waktuScanPulang || record.waktuScanMasuk || 0;
    if (nowMs - lastScanMs < 20000) {
      playScanSound('warning');
      return {
        success: true,
        type: 'duplicate',
        siswa,
        record,
        status: record.status,
        message: `${siswa.nama} sudah melakukan absensi baru saja (${formatTimeDisplay(record.jamPulang || record.jamMasuk)})`
      };
    }

    // If student already has jamMasuk and hasn't checked out (jamPulang is null)
    // Check if enough time elapsed (e.g. > 15 minutes) or past jam 10:00
    if (!record.jamPulang) {
      record.jamPulang = jamSekarang;
      record.waktuScanPulang = nowMs;
      saveData();
      playScanSound('success');

      return {
        success: true,
        type: 'pulang',
        siswa,
        record,
        status: record.status,
        message: `Absen Pulang Berhasil: ${siswa.nama} (${formatTimeDisplay(jamSekarang)})`
      };
    } else {
      // Already checked in and checked out
      playScanSound('warning');
      return {
        success: true,
        type: 'completed',
        siswa,
        record,
        status: record.status,
        message: `${siswa.nama} sudah lengkap absen Masuk (${formatTimeDisplay(record.jamMasuk)}) & Pulang (${formatTimeDisplay(record.jamPulang)}) hari ini`
      };
    }
  }
}

export function manualAddOrUpdateAbsensi(data) {
  if (!store.state.absensi) store.state.absensi = [];
  const { id, siswaId, tanggal, jamMasuk, jamPulang, status, keterangan } = data;

  if (id) {
    const item = store.state.absensi.find(a => a.id === id);
    if (item) {
      item.jamMasuk = jamMasuk || item.jamMasuk;
      item.jamPulang = jamPulang || item.jamPulang;
      item.status = status || item.status;
      item.keterangan = keterangan !== undefined ? keterangan : item.keterangan;
      saveData('Data absensi diperbarui');
      return;
    }
  }

  // Check if student already has record on that date
  const existing = store.state.absensi.find(a => a.siswaId === siswaId && a.tanggal === tanggal);
  if (existing) {
    existing.jamMasuk = jamMasuk || existing.jamMasuk;
    existing.jamPulang = jamPulang || existing.jamPulang;
    existing.status = status || existing.status;
    existing.keterangan = keterangan !== undefined ? keterangan : existing.keterangan;
    saveData('Data absensi diperbarui');
  } else {
    store.state.absensi.unshift({
      id: uid(),
      siswaId,
      tanggal,
      jamMasuk: jamMasuk || null,
      jamPulang: jamPulang || null,
      status: status || 'hadir',
      keterangan: keterangan || '',
      waktuScanMasuk: Date.now()
    });
    saveData('Absensi siswa berhasil dicatat');
  }
}

export function deleteAbsensi(id) {
  if (!store.state.absensi) return;
  store.state.absensi = store.state.absensi.filter(a => a.id !== id);
  saveData('Data absensi dihapus');
}

export function getStatistikAbsensi(tanggal, kelasFilter = '') {
  const allSiswa = store.state.siswa.filter(s => !kelasFilter || s.kelas === kelasFilter);
  const totalSiswa = allSiswa.length;
  const validIds = new Set(allSiswa.map(s => s.id));

  const records = (store.state.absensi || []).filter(a => {
    return a.tanggal === tanggal && validIds.has(a.siswaId);
  });

  let hadir = 0;
  let terlambat = 0;
  let izin = 0;
  let sakit = 0;
  let alpa = 0;

  records.forEach(r => {
    if (r.status === 'hadir') hadir++;
    else if (r.status === 'terlambat') terlambat++;
    else if (r.status === 'izin') izin++;
    else if (r.status === 'sakit') sakit++;
    else if (r.status === 'alpa') alpa++;
  });

  const totalTercatat = hadir + terlambat + izin + sakit + alpa;
  const belumHadir = Math.max(0, totalSiswa - totalTercatat);

  return {
    totalSiswa,
    hadir,
    terlambat,
    izin,
    sakit,
    alpa,
    belumHadir,
    records
  };
}

export function getRiwayatAbsensiSiswa(siswaId, bulan = null, tahun = null) {
  if (!store.state.absensi) return [];
  return store.state.absensi.filter(a => {
    if (a.siswaId !== siswaId) return false;
    if (bulan && tahun) {
      const d = new Date(a.tanggal);
      return (d.getMonth() + 1) === bulan && d.getFullYear() === tahun;
    }
    return true;
  }).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

export function exportAbsensiExcel(tanggal, kelasFilter = '') {
  const stats = getStatistikAbsensi(tanggal, kelasFilter);
  const siswaList = store.state.siswa
    .filter(s => !kelasFilter || s.kelas === kelasFilter)
    .sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

  const rows = siswaList.map((s, idx) => {
    const rec = stats.records.find(r => r.siswaId === s.id);
    let statusLabel = 'Belum Hadir';
    let jamMsk = '-';
    let jamPlg = '-';
    let ket = '';

    if (rec) {
      statusLabel = rec.status.toUpperCase();
      jamMsk = rec.jamMasuk || '-';
      jamPlg = rec.jamPulang || '-';
      ket = rec.keterangan || '';
    }

    return {
      'No': idx + 1,
      'Tanggal': tanggal,
      'Nama Siswa': s.nama,
      'Kelas': s.kelas,
      'NIS': s.nis || '-',
      'Status': statusLabel,
      'Jam Masuk': jamMsk,
      'Jam Pulang': jamPlg,
      'Keterangan': ket
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');

  const fileName = `Rekap_Absensi_${kelasFilter ? kelasFilter.replace(/\s+/g, '_') + '_' : ''}${tanggal}.xlsx`;
  XLSX.writeFile(wb, fileName);
  toast('Laporan absensi berhasil didownload', 'success');
}

export function formatWaLinkAbsensi(siswa, record) {
  if (!siswa || !siswa.noHp) return null;
  const sekolah = store.state?.settings?.namaSekolah || 'Sekolah';
  const waktu = record.jamPulang ? `Pulang pukul ${formatTimeDisplay(record.jamPulang)}` : `Masuk pukul ${formatTimeDisplay(record.jamMasuk)}`;
  const statusTxt = record.status === 'hadir' ? 'Tepat Waktu' : record.status === 'terlambat' ? 'Terlambat' : record.status === 'izin' ? 'Izin' : record.status === 'sakit' ? 'Sakit' : 'Alpa';

  const teks = `*NOTIFIKASI KEHADIRAN SISWA*
*${sekolah.toUpperCase()}*
------------------------------------------------------
Yth. Bapak/Ibu Wali Murid dari *${siswa.nama}*,

Menginformasikan bahwa ananda telah tercatat melakukan absensi di sekolah dengan rincian:

📋 *Data Siswa*
Nama  : ${siswa.nama}
Kelas : ${siswa.kelas}
NIS   : ${siswa.nis || '-'}

⏰ *Waktu & Status*
Tanggal : ${new Date(record.tanggal).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
Waktu   : ${waktu}
Status  : *${statusTxt.toUpperCase()}* ${record.keterangan ? `(${record.keterangan})` : ''}

------------------------------------------------------
Terima kasih atas perhatian dan kerja sama Bapak/Ibu.
_Sistem Absensi Otomatis ${sekolah}_`;

  let hp = String(siswa.noHp).replace(/[^0-9]/g, '');
  if (hp.startsWith('0')) hp = '62' + hp.substring(1);
  return `https://wa.me/${hp}?text=${encodeURIComponent(teks)}`;
}

