import '../style.css';
import { store } from './state.js';
import { loadData } from '../data/database.js';
import { renderNav, PAGE_META } from '../components/Navigation.js';
import { setupModalEvents } from '../components/Modal.js';
import { getActiveTahunMulai, getSchoolLogo } from '../utils/helpers.js';
import { saveAuth } from '../data/authStorage.js';
import { escapeHtml } from '../utils/formatters.js';
import { getStudentInitials } from '../features/absensi/qrCardGenerator.js';

import { renderDashboard, openStudentProfileModal } from '../features/dashboard/Dashboard.js';
import { renderSiswa, initSiswaEvents } from '../features/siswa/Siswa.js';
import { renderBayar } from '../features/pembayaran/Pembayaran.js';
import { renderRiwayat } from '../features/riwayat/Riwayat.js';
import { renderLaporan } from '../features/laporan/Laporan.js';
import { renderPengaturan } from '../features/pengaturan/Pengaturan.js';
import { renderLogin } from '../features/auth/Login.js';
import { renderAbsensi, stopScanner } from '../features/absensi/Absensi.js';

// Initialize saved theme on load
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-mode');
}

// Global PWA Install Prompt
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
  const btnInstall = document.getElementById('btn-install');
  if (btnInstall) btnInstall.style.display = 'inline-flex';
});

function renderTahunAjaranSelector(id){
  const current = getActiveTahunMulai();
  const base = store.state.settings.tahunMulai || new Date().getFullYear();
  const options = [];
  for(let y = base - 3; y <= base + 3; y++){
    options.push(`<option value="${y}" ${current===y?'selected':''}>${y}/${y+1}</option>`);
  }
  return `<select id="${id}" style="padding:4px 8px; font-size:12px; margin-left:6px; background:var(--paper);">${options.join('')}</select>`;
}

export function render(){
  const role = store.ui.currentUser ? store.ui.currentUser.role : null;
  
  if (!store.ui.currentUser) {
    if (store.ui.page !== 'login') {
      store.ui.page = 'login';
      return render();
    }
    store.ui.page = 'login';
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.topbar').style.display = 'none';
    document.querySelector('.main').style.marginLeft = '0';
    document.querySelector('.main').style.padding = '0';
    document.body.classList.remove('role-siswa');
  } else {
    document.querySelector('.sidebar').style.display = '';
    document.querySelector('.topbar').style.display = '';
    document.querySelector('.main').style.marginLeft = '';
    document.querySelector('.main').style.padding = '';
    if (role === 'siswa') {
      document.body.classList.add('role-siswa');
    } else {
      document.body.classList.remove('role-siswa');
    }
  }

  renderNav();
  
  if (store.ui.page !== 'login') {
    if (role === 'siswa' && !['dashboard', 'riwayat', 'absensi'].includes(store.ui.page)) {
      store.ui.page = 'dashboard';
      return render();
    }
    
    const topbar = document.querySelector('.topbar');
    
    if (role === 'siswa') {
      const user = store.ui.currentUser;
      const s = store.state.siswa.find(x => x.id === user.id) || user;
      const initials = getStudentInitials(s.nama);
      const namaSekolah = store.state.settings.namaSekolah || 'MTs Yasta Bunter';
      const avatarEl = s.foto
        ? `<img src="${s.foto}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
        : escapeHtml(initials);

      topbar.innerHTML = `
        <div class="student-topbar-wrapper">
          <div class="student-topbar-brand">
            <div class="st-brand-logo">
              <img src="${getSchoolLogo()}" alt="Logo" />
            </div>
            <div class="st-brand-text">
              <div class="st-title">
                <span>EduPass</span>
                <span class="st-badge">Portal Siswa</span>
              </div>
              <div class="st-school">${escapeHtml(namaSekolah)}</div>
            </div>
          </div>

          <nav class="student-desktop-tabs">
            <button type="button" class="st-tab-btn ${store.ui.page === 'dashboard' ? 'active' : ''}" data-student-nav="dashboard">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>
              <span>Beranda</span>
            </button>
            <button type="button" class="st-tab-btn ${store.ui.page === 'absensi' ? 'active' : ''}" data-student-nav="absensi">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
              <span>Absensi & QR</span>
            </button>
            <button type="button" class="st-tab-btn ${store.ui.page === 'riwayat' ? 'active' : ''}" data-student-nav="riwayat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
              <span>Riwayat SPP</span>
            </button>
          </nav>

          <div class="student-topbar-profile">
            <button type="button" class="btn-topbar-theme" id="btn-topbar-theme" title="Ganti Tema (Gelap / Terang)">
              ${document.body.classList.contains('dark-mode')
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'}
            </button>
            <div class="st-profile-capsule" id="btn-student-profile" style="cursor:pointer;" title="Klik untuk Profil & Ubah PIN (${escapeHtml(s.nama)})">
              <div class="st-avatar" style="overflow:hidden; display:flex; align-items:center; justify-content:center;">${avatarEl}</div>
              <div class="st-profile-info">
                <div class="st-name">${escapeHtml(s.nama)}</div>
                <div class="st-meta">NIS: ${escapeHtml(s.nis || '-')} • Kelas ${escapeHtml(s.kelas || '-')}</div>
              </div>
            </div>
            <button type="button" class="btn-st-logout" id="btn-student-logout" title="Keluar dari Akun">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              <span class="txt-logout">Keluar</span>
            </button>
          </div>
        </div>
      `;

      topbar.querySelectorAll('[data-student-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
          store.ui.page = btn.dataset.studentNav;
          render();
        });
      });

      document.getElementById('btn-student-profile')?.addEventListener('click', () => {
        openStudentProfileModal(s);
      });

      document.getElementById('btn-student-logout')?.addEventListener('click', () => {
        store.ui.currentUser = null;
        store.ui.page = 'login';
        saveAuth(null);
        render();
      });

    } else {
      // Standard Bendahara Topbar
      const meta = PAGE_META[store.ui.page] || { title: '', sub: '' };
      topbar.innerHTML = `
        <div>
          <h1 id="page-title">${meta.title}</h1>
          <div class="sub" id="page-sub">${meta.sub}</div>
        </div>
        <div class="today" id="today-label" style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:12.5px; font-weight:600; color:var(--ink);">Tahun Ajaran ${renderTahunAjaranSelector('global-ta')}</span>
            <span style="color:var(--ink-soft); font-size:12px;">•</span>
            <span style="font-size:12px; color:var(--ink-soft);">${new Date().toLocaleDateString('id-ID',{weekday:'long', day:'numeric', month:'short', year:'numeric'})}</span>
          </div>
          <button type="button" class="btn-topbar-theme" id="btn-topbar-theme" title="Ganti Tema (Gelap / Terang)">
            ${document.body.classList.contains('dark-mode')
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'}
          </button>
          <div class="bendahara-topbar-profile" style="display:inline-flex; align-items:center; gap:8px; background:var(--paper-dim); border:1px solid var(--line); border-radius:30px; padding:3px 12px 3px 5px;">
            <div style="width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg, #1E293B, #333594); color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">BD</div>
            <span style="font-size:12.5px; font-weight:600; color:var(--ink);">Bendahara</span>
          </div>
        </div>
      `;
      document.getElementById('global-ta')?.addEventListener('change', e=>{
        store.ui.activeTahunMulai = parseInt(e.target.value, 10);
        render();
      });
    }
    document.getElementById('btn-topbar-theme')?.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
      render();
    });
  }

  if (store.ui.page !== 'absensi') {
    stopScanner();
  }

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+store.ui.page).classList.add('active');

  const pages = {
    dashboard: renderDashboard,
    siswa: renderSiswa,
    absensi: renderAbsensi,
    bayar: renderBayar,
    riwayat: renderRiwayat,
    laporan: renderLaporan,
    pengaturan: renderPengaturan,
    login: renderLogin
  };

  pages[store.ui.page]?.();
}

// Make them available globally or via exports to avoid circular if needed
export { renderSiswa, renderBayar, renderRiwayat, renderLaporan, renderPengaturan, renderAbsensi };

// Start App
setupModalEvents();
window.addEventListener('app:render', render);

loadData(() => {
  initSiswaEvents();
  render();
});
