import { store } from '../app/state.js';
import { triggerRender } from './events.js';
import { escapeHtml } from './formatters.js';

export const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export function uid(){ return 'x'+Math.random().toString(36).slice(2,10)+Date.now().toString(36); }

export function toast(msg, variant = 'success'){
  const t = document.getElementById('toast');
  const icons = {
    success: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };
  const icon = icons[variant] || icons.info;
  
  // Clear any existing timeout/animation
  clearTimeout(t._h);
  clearTimeout(t._h2);
  t.classList.remove('show', 'hiding', 'toast-success', 'toast-error', 'toast-warning', 'toast-info');
  
  t.className = `toast toast-${variant}`;
  t.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close" onclick="this.parentElement.classList.remove('show')">&times;</button>
    <div class="toast-progress" style="width:100%"></div>
  `;
  
  // Show
  requestAnimationFrame(() => {
    t.classList.add('show');
    // Animate progress bar
    const bar = t.querySelector('.toast-progress');
    if(bar) {
      requestAnimationFrame(() => {
        bar.style.transitionDuration = '2.5s';
        bar.style.width = '0%';
      });
    }
  });
  
  // Hide with animation
  t._h = setTimeout(() => {
    t.classList.add('hiding');
    t._h2 = setTimeout(() => {
      t.classList.remove('show', 'hiding');
    }, 200);
  }, 2800);
}


export function getActiveTahunMulai(){
  return store.ui?.activeTahunMulai || store.state?.settings?.tahunMulai || new Date().getFullYear();
}
export function getPeriode(){
  const s = store.state?.settings || {};
  const arr = [];
  let b = s.bulanMulai || 7, t = getActiveTahunMulai();
  for(let i=0;i<12;i++){
    arr.push({bulan:b, tahun:t});
    b++; if(b>12){ b=1; t++; }
  }
  return arr;
}
export function getPeriodeBerjalan(){
  const now = new Date();
  const curB = now.getMonth()+1, curT = now.getFullYear();
  return getPeriode().filter(p => (p.tahun < curT) || (p.tahun === curT && p.bulan <= curB));
}
export function siswaTotalBulan(siswaId, bulan, tahun){
  return store.state.pembayaran
    .filter(p => p.siswaId === siswaId && (!p.jenis || p.jenis === 'spp') && p.bulan === bulan && p.tahun === tahun)
    .reduce((a,p)=>a+p.nominal, 0);
}
export function siswaStatusBulan(siswaId, bulan, tahun){
  const total = siswaTotalBulan(siswaId, bulan, tahun);
  const nominal = store.state.settings.nominalSPP;
  if(total <= 0) return 'nunggak';
  if(total < nominal) return 'parsial';
  return 'lunas';
}
export function siswaTunggakan(siswaId){
  const periode = getPeriodeBerjalan();
  const nominal = store.state.settings.nominalSPP;
  let totalKurang = 0;
  const bulanBelum = [];
  periode.forEach(p=>{
    const total = siswaTotalBulan(siswaId, p.bulan, p.tahun);
    if(total < nominal){
      totalKurang += (nominal - total);
      bulanBelum.push({...p, dibayar: total, kurang: nominal-total});
    }
  });
  return { totalKurang, bulanBelum, jumlahBulan: bulanBelum.length };
}
export function currentPeriodeEntry(){
  const now = new Date();
  return { bulan: now.getMonth()+1, tahun: now.getFullYear() };
}


export function downloadFile(filename, content, mimeType = 'text/csv;charset=utf-8;'){
  const blob = new Blob([content], {type: mimeType});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function emptyState(iconSvg, title, desc, btnLabel, onClick){
  const id = 'empty-cta-' + Math.random().toString(36).substr(2, 5);
  setTimeout(()=>{
    const btn = document.getElementById(id);
    if(btn && onClick) btn.addEventListener('click', onClick);
  }, 0);
  return `<div class="empty-state">
    <div class="empty-icon">${iconSvg}</div>
    <h3 style="margin:0;">${escapeHtml(title)}</h3>
    <p>${escapeHtml(desc)}</p>
    <button class="btn btn-primary" style="margin-top:16px;" id="${id}">${escapeHtml(btnLabel)}</button>
  </div>`;
}


