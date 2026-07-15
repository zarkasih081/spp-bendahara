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
    document.querySelector('header').style.display = 'none';
    document.querySelector('.main').style.marginLeft = '0';
  } else {
    document.querySelector('.sidebar').style.display = '';
    document.querySelector('header').style.display = '';
    document.querySelector('.main').style.marginLeft = '';
  }

  renderNav();
  
  if (store.ui.page !== 'login') {
    if (role === 'siswa' && !['dashboard', 'riwayat'].includes(store.ui.page)) {
      store.ui.page = 'dashboard';
      return render();
    }
    const meta = PAGE_META[store.ui.page] || { title: '', sub: '' };
    document.getElementById('page-title').textContent = meta.title;
    document.getElementById('page-sub').textContent = meta.sub;
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
