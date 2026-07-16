import './style.css';
import { loadData, store } from './state/store.js';
import { renderNav, PAGE_META } from './components/Navigation.js';
import { setupModalEvents } from './components/Modal.js';
import { getActiveTahunMulai } from './utils/helpers.js';

import { renderDashboard } from './pages/Dashboard.js';
import { renderSiswa, initSiswaEvents } from './pages/Siswa.js';
import { renderBayar } from './pages/Pembayaran.js';
import { renderRiwayat } from './pages/Riwayat.js';
import { renderLaporan } from './pages/Laporan.js';
import { renderPengaturan } from './pages/Pengaturan.js';
import { renderLogin } from './pages/Login.js';

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
    if (role === 'siswa' && !['dashboard', 'riwayat'].includes(store.ui.page)) {
      store.ui.page = 'dashboard';
      return render();
    }
    const meta = PAGE_META[store.ui.page] || { title: '', sub: '' };
    let pageTitle = meta.title;
    let pageSub = meta.sub;
    
    if (role === 'siswa') {
      if (store.ui.page === 'dashboard') {
        pageTitle = 'Dashboard Siswa';
        pageSub = 'Ringkasan tagihan dan informasi SPP Anda';
      } else if (store.ui.page === 'riwayat') {
        pageTitle = 'Riwayat Pembayaran';
        pageSub = 'Detail transaksi dan status SPP Anda';
      }
    }
    
    document.getElementById('page-title').textContent = pageTitle;
    document.getElementById('page-sub').textContent = pageSub;
    document.getElementById('today-label').innerHTML = `
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:4px;">
        <span style="font-size:12.5px; font-weight:600; color:var(--ink);">Tahun Ajaran ${renderTahunAjaranSelector('global-ta')}</span>
        <span>${new Date().toLocaleDateString('id-ID',{weekday:'long', day:'numeric', month:'long', year:'numeric'})}</span>
      </div>
    `;
    document.getElementById('global-ta').addEventListener('change', e=>{
      store.ui.activeTahunMulai = parseInt(e.target.value, 10);
      render();
    });
  }

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+store.ui.page).classList.add('active');

  const pages = {
    dashboard: renderDashboard,
    siswa: renderSiswa,
    bayar: renderBayar,
    riwayat: renderRiwayat,
    laporan: renderLaporan,
    pengaturan: renderPengaturan,
    login: renderLogin
  };

  pages[store.ui.page]?.();
}

// Make them available globally or via exports to avoid circular if needed
export { renderSiswa, renderBayar, renderRiwayat, renderLaporan, renderPengaturan };

// Start App
setupModalEvents();
window.addEventListener('app:render', render);

loadData(() => {
  initSiswaEvents();
  render();
});
