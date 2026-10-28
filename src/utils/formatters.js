export function fmtRupiah(n){
  n = Math.round(n||0);
  return 'Rp' + n.toLocaleString('id-ID');
}

export function fmtDate(iso){
  if(!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
}

export function escapeHtml(str){
  return String(str||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function escapeAttr(str){ return escapeHtml(str); }

export function formatWaLink(noHp, text){
  if(!noHp) return null;
  let hp = String(noHp).replace(/[^0-9]/g, '');
  if(hp.startsWith('0')){
    hp = '62' + hp.substring(1);
  }
  return `https://wa.me/${hp}?text=${encodeURIComponent(text)}`;
}
