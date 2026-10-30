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

export function terbilang(n) {
  n = Math.abs(Math.floor(n || 0));
  const huruf = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  if (n < 12) return huruf[n];
  if (n < 20) return terbilang(n - 10) + ' Belas';
  if (n < 100) return (terbilang(Math.floor(n / 10)) + ' Puluh ' + terbilang(n % 10)).trim();
  if (n < 200) return ('Seratus ' + terbilang(n - 100)).trim();
  if (n < 1000) return (terbilang(Math.floor(n / 100)) + ' Ratus ' + terbilang(n % 100)).trim();
  if (n < 2000) return ('Seribu ' + terbilang(n - 1000)).trim();
  if (n < 1000000) return (terbilang(Math.floor(n / 1000)) + ' Ribu ' + terbilang(n % 1000)).trim();
  if (n < 1000000000) return (terbilang(Math.floor(n / 1000000)) + ' Juta ' + terbilang(n % 1000000)).trim();
  if (n < 1000000000000) return (terbilang(Math.floor(n / 1000000000)) + ' Miliar ' + terbilang(n % 1000000000)).trim();
  return String(n);
}

