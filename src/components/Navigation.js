import { store, saveAuth } from '../state/store.js';
import { triggerRender } from '../utils/events.js';

export const PAGE_META = {
  dashboard: { title:'Dashboard', sub:'Ringkasan pemasukan SPP dan status pembayaran' },
  siswa: { title:'Data Siswa', sub:'Kelola daftar siswa dan kelas' },
  bayar: { title:'Input Pembayaran', sub:'Catat pembayaran SPP dan cetak kwitansi' },
  riwayat: { title:'Riwayat & Tunggakan', sub:'Status pembayaran per siswa' },
  laporan: { title:'Laporan', sub:'Rekap pemasukan SPP per periode' },
  pengaturan: { title:'Pengaturan', sub:'Nominal SPP, tahun ajaran, dan identitas sekolah' },
};

function iconGrid(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>`; }
function iconUsers(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2"/><circle cx="17" cy="8.5" r="2.6"/><path d="M15.5 13.5c2.9.3 5 2.6 5 6.2"/></svg>`; }
function iconPlus(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`; }
function iconClock(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`; }
function iconChart(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>`; }
function iconGear(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`; }

function iconChevronLeft(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`; }
function iconHamburger(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`; }

export const NAV_ITEMS = [
  { key:'dashboard', label:'Dashboard', group:'Ringkasan', icon:iconGrid() },
  { key:'siswa', label:'Data Siswa', group:'Data', icon:iconUsers() },
  { key:'bayar', label:'Input Pembayaran', group:'Data', icon:iconPlus() },
  { key:'riwayat', label:'Riwayat & Tunggakan', group:'Data', icon:iconClock() },
  { key:'laporan', label:'Laporan', group:'Laporan', icon:iconChart() },
  { key:'pengaturan', label:'Pengaturan', group:'Lainnya', icon:iconGear() },
];

export function renderNav(){
  const sidebar = document.querySelector('.sidebar');
  const nav = document.getElementById('nav');
  const bottomNav = document.getElementById('bottom-nav');
  let html = '';
  let lastGroup = null;
  
  const user = store.ui.currentUser;
  
  if (user && user.role === 'siswa') {
    // Render Bottom Nav for Siswa
    bottomNav.style.display = 'flex';
    nav.innerHTML = '';
    
    let bottomHtml = `
      <div class="bottom-nav-item ${store.ui.page==='dashboard'?'active':''}" data-bottom-nav="dashboard">
        ${iconGrid()}
        <span>Beranda</span>
      </div>
      <div class="bottom-nav-item ${store.ui.page==='riwayat'?'active':''}" data-bottom-nav="riwayat">
        ${iconClock()}
        <span>Riwayat</span>
      </div>
      <div class="bottom-nav-item logout" id="btn-bottom-logout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        <span>Keluar</span>
      </div>
    `;
    bottomNav.innerHTML = bottomHtml;
    
    document.getElementById('btn-bottom-logout').addEventListener('click', () => {
      store.ui.currentUser = null;
      store.ui.page = 'login';
      saveAuth(null);
      triggerRender();
    });
    
    bottomNav.querySelectorAll('[data-bottom-nav]').forEach(el=>{
      el.addEventListener('click', ()=>{
        store.ui.page = el.dataset.bottomNav;
        triggerRender();
      });
    });

  } else {
    // Render Sidebar Nav for Bendahara
    if (bottomNav) bottomNav.style.display = 'none';
    let items = NAV_ITEMS;
    
    items.forEach(item=>{
      if(item.group !== lastGroup){ html += `<div class="nav-label">${item.group}</div>`; lastGroup = item.group; }
      html += `<div class="nav-item ${store.ui.page===item.key?'active':''}" data-nav="${item.key}" data-tooltip="${item.label}">${item.icon}<span class="txt">${item.label}</span></div>`;
    });
    
    html += `<div class="nav-label">Sistem</div>`;
    html += `<div class="nav-item" id="btn-logout" data-tooltip="Keluar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg><span class="txt">Keluar (${user ? user.nama : ''})</span></div>`;

    nav.innerHTML = html;
    
    document.getElementById('btn-logout').addEventListener('click', () => {
      store.ui.currentUser = null;
      store.ui.page = 'login';
      saveAuth(null);
      triggerRender();
    });
  } // End of else

  nav.querySelectorAll('[data-nav]').forEach(el=>{
    el.addEventListener('click', ()=>{
      store.ui.page = el.dataset.nav;
      // Close mobile menu if open
      sidebar.classList.remove('mobile-open');
      const overlay = document.getElementById('mobile-overlay');
      if(overlay) overlay.classList.remove('active');
      triggerRender();
    });
  });

  // Setup sidebar toggle (desktop)
  const existingToggle = sidebar.querySelector('.sidebar-toggle');
  if(!existingToggle) {
    const toggle = document.createElement('button');
    toggle.className = 'sidebar-toggle';
    toggle.innerHTML = iconChevronLeft();
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
    sidebar.appendChild(toggle);
  }

  // Setup mobile hamburger
  let hamburger = document.getElementById('mobile-hamburger');
  if(!hamburger) {
    hamburger = document.createElement('button');
    hamburger.id = 'mobile-hamburger';
    hamburger.className = 'mobile-hamburger';
    hamburger.innerHTML = iconHamburger();
    const main = document.querySelector('.main');
    main.insertBefore(hamburger, main.firstChild);
    
    hamburger.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      let overlay = document.getElementById('mobile-overlay');
      if(!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mobile-overlay';
        overlay.className = 'mobile-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', () => {
          sidebar.classList.remove('mobile-open');
          overlay.classList.remove('active');
        });
      }
      overlay.classList.add('active');
    });
  }

  // Update sidebar footer with timestamp
  const foot = document.getElementById('sidebar-foot');
  if(foot && !foot.querySelector('.dot')) {
    foot.innerHTML = `<span class="dot"></span><span class="foot-text">Tersimpan otomatis</span>`;
  }
}

// Helper to update the footer timestamp
export function updateSaveTimestamp() {
  const foot = document.getElementById('sidebar-foot');
  if(foot) {
    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
    foot.innerHTML = `<span class="dot"></span><span class="foot-text">Tersimpan ${time}</span>`;
  }
}

export function setSaveLoading() {
  const foot = document.getElementById('sidebar-foot');
  if(foot) {
    foot.innerHTML = `<span class="spinner" style="width:12px;height:12px;border-width:2px;margin-right:8px;margin-left:2px;display:inline-block"></span><span class="foot-text">Menyimpan...</span>`;
  }
}
