import { store } from '../state/store.js';
import { triggerRender } from './events.js';

export const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export function uid(){ return 'x'+Math.random().toString(36).slice(2,10)+Date.now().toString(36); }

export function toast(msg, variant = 'success'){
  const t = document.getElementById('toast');
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
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

export function fmtRupiah(n){
  n = Math.round(n||0);
  return 'Rp' + n.toLocaleString('id-ID');
}
export function fmtDate(iso){
  if(!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
}

export function getActiveTahunMulai(){
  return store.ui.activeTahunMulai || store.state.settings.tahunMulai;
}
export function getPeriode(){
  const s = store.state.settings;
  const arr = [];
  let b = s.bulanMulai, t = getActiveTahunMulai();
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
    .filter(p => p.siswaId === siswaId && p.bulan === bulan && p.tahun === tahun)
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

export function escapeHtml(str){
  return String(str||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function escapeAttr(str){ return escapeHtml(str); }

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

export function formatWaLink(noHp, text){
  if(!noHp) return null;
  let hp = String(noHp).replace(/[^0-9]/g, '');
  if(hp.startsWith('0')){
    hp = '62' + hp.substring(1);
  }
  return `https://wa.me/${hp}?text=${encodeURIComponent(text)}`;
}
