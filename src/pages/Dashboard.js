import { store } from '../state/store.js';
import { currentPeriodeEntry, siswaStatusBulan, siswaTunggakan, fmtRupiah, escapeHtml, BULAN, emptyState, getPeriode, siswaTotalBulan, formatWaLink } from '../utils/helpers.js';
import { triggerRender } from '../utils/events.js';

function iconMoney(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`; }
function iconUserCheck(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/><path d="M16 11l2 2 4-4"/></svg>`; }
function iconAlertTri(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>`; }
function iconWallet(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01M2 10h20"/></svg>`; }
function iconEmptyUsers(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`; }



function renderTopTunggakan(){
  const rows = store.state.siswa.map(s=>({ s, t: siswaTunggakan(s.id) }))
    .filter(r=>r.t.totalKurang>0)
    .sort((a,b)=>b.t.totalKurang-a.t.totalKurang)
    .slice(0,6);
  if(rows.length===0) return `<div class="empty-state" style="padding:24px;"><p>Semua siswa lunas sampai bulan berjalan. Kerja bagus, Bu/Pak Bendahara. 🎉</p></div>`;
  return `<div class="table-scroll"><table><thead><tr><th>Nama</th><th>Kelas</th><th class="num">Bulan Tertunggak</th><th class="num">Kekurangan</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td>${escapeHtml(r.s.nama)}</td><td><span class="kelas-chip">${escapeHtml(r.s.kelas)}</span></td><td class="num">${r.t.jumlahBulan}</td><td class="num">${fmtRupiah(r.t.totalKurang)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

export function renderDashboard(){
  const el = document.getElementById('page-dashboard');
  const user = store.ui.currentUser;

  // VIEW FOR SISWA
  if (user && user.role === 'siswa') {
    const s = store.state.siswa.find(x => x.id === user.id);
    if (!s) {
      el.innerHTML = `<div class="empty-state">Data siswa tidak ditemukan.</div>`;
      return;
    }
    const tunggakan = siswaTunggakan(s.id);
    const periode = getPeriode();
    const nominal = store.state.settings.nominalSPP;
    
    const lunasCount = periode.filter(p => siswaTotalBulan(s.id, p.bulan, p.tahun) >= nominal).length;
    const progressPercent = Math.round((lunasCount / 12) * 100);

    el.innerHTML = `
      <div class="virtual-card">
        <div class="vc-header">
          <div class="vc-title">Kartu SPP Digital</div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        </div>
        <div class="vc-body">
          <div class="vc-name">${escapeHtml(s.nama)}</div>
          <div class="vc-nis">${escapeHtml(s.nis || 'NIS Belum Diatur')} • Kelas ${escapeHtml(s.kelas)}</div>
        </div>
        <div class="vc-footer">
          <div>
            <div class="vc-label">Kewajiban Bulanan</div>
            <div class="vc-amount">${fmtRupiah(nominal)}</div>
          </div>
          <div style="text-align:right;">
            <div class="vc-label">Tahun Ajaran</div>
            <div style="font-weight:600; font-size:14px;">${escapeHtml(store.state.settings.tahunAjaran)}</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3 style="margin-bottom:4px;">Progres Pembayaran</h3>
        <div class="card-sub" style="margin-bottom:16px;">Target pelunasan 12 bulan (1 Tahun Ajaran)</div>
        <div class="progress-container">
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="progress-text">
            <span>${lunasCount} Bulan Lunas</span>
            <span>${progressPercent}%</span>
          </div>
        </div>
      </div>
      
      <div class="stat-row">
        <div class="stat-card ${tunggakan.jumlahBulan > 0 ? 'rust' : 'gold'}">
          <div class="stat-icon">${iconAlertTri()}</div>
          <div class="label">Status Tunggakan</div>
          <div class="value">${tunggakan.jumlahBulan === 0 ? 'Lunas' : tunggakan.jumlahBulan + ' Bulan'}</div>
          <div class="foot">Tunggakan hingga bulan berjalan</div>
        </div>
        <div class="stat-card ${tunggakan.totalKurang > 0 ? 'rust' : 'gold'}">
          <div class="stat-icon">${iconWallet()}</div>
          <div class="label">Kekurangan Pembayaran</div>
          <div class="value">${fmtRupiah(tunggakan.totalKurang)}</div>
          <div class="foot">Total yang harus dilunasi saat ini</div>
        </div>
      </div>
      
      <div style="margin-top:20px; display:flex; justify-content:center;">
        <a href="${formatWaLink(store.state.settings.noHpBendahara, `Halo Bendahara ${store.state.settings.namaSekolah}, saya ${s.nama} ingin bertanya seputar SPP.`) || '#'}" target="_blank" class="btn" style="background:#25D366; color:#fff; border:none; display:inline-flex; align-items:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          Hubungi Bendahara via WhatsApp
        </a>
      </div>
    `;
    return;
  }

  // VIEW FOR BENDAHARA
  const cur = currentPeriodeEntry();
  const totalSiswa = store.state.siswa.length;
  
  const totalMasukBulanIni = store.state.pembayaran
    .filter(p=>p.bulan===cur.bulan && p.tahun===cur.tahun)
    .reduce((a,p)=>a+p.nominal,0);

  let lunasCount = 0, parsialCount = 0, nunggakCount = 0;
  store.state.siswa.forEach(s=>{
    const st = siswaStatusBulan(s.id, cur.bulan, cur.tahun);
    if(st==='lunas') lunasCount++; else if(st==='parsial') parsialCount++; else nunggakCount++;
  });

  let totalPiutang = 0;
  store.state.siswa.forEach(s=>{ totalPiutang += siswaTunggakan(s.id).totalKurang; });

  const now = new Date();
  const months = [];
  for(let i=5;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({ bulan: d.getMonth()+1, tahun: d.getFullYear() });
  }
  const totals = months.map(m => store.state.pembayaran.filter(p=>p.bulan===m.bulan && p.tahun===m.tahun).reduce((a,p)=>a+p.nominal,0));
  const maxTotal = Math.max(...totals, 1);

  if(totalSiswa===0){
    el.innerHTML = emptyState(iconEmptyUsers(), 'Belum ada data siswa', 'Tambahkan data siswa terlebih dahulu di menu Data Siswa untuk mulai mencatat pembayaran SPP.', 'Tambah Data Siswa', () => {
      store.ui.page = 'siswa';
      triggerRender();
    });
    return;
  }

  el.innerHTML = `
    <div class="stat-row">
      <div class="stat-card gold">
        <div class="stat-icon">${iconMoney()}</div>
        <div class="label">Masuk Bulan ${BULAN[cur.bulan-1]}</div>
        <div class="value">${fmtRupiah(totalMasukBulanIni)}</div>
        <div class="foot">dari ${store.state.pembayaran.filter(p=>p.bulan===cur.bulan&&p.tahun===cur.tahun).length} transaksi</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">${iconUserCheck()}</div>
        <div class="label">Siswa Lunas Bulan Ini</div>
        <div class="value">${lunasCount} <span style="font-size:13px;color:var(--ink-soft);font-weight:400;">/ ${totalSiswa}</span></div>
        <div class="foot">${totalSiswa? Math.round(lunasCount/totalSiswa*100):0}% dari total siswa</div>
      </div>
      <div class="stat-card rust">
        <div class="stat-icon">${iconAlertTri()}</div>
        <div class="label">Belum / Kurang Bayar</div>
        <div class="value">${nunggakCount+parsialCount}</div>
        <div class="foot">${nunggakCount} belum bayar · ${parsialCount} sebagian</div>
      </div>
      <div class="stat-card rust">
        <div class="stat-icon">${iconWallet()}</div>
        <div class="label">Total Piutang Berjalan</div>
        <div class="value">${fmtRupiah(totalPiutang)}</div>
        <div class="foot">akumulasi tunggakan tahun ajaran ini</div>
      </div>
    </div>

    <div class="card">
      <h3>Tren Pemasukan 6 Bulan Terakhir</h3>
      <div class="card-sub">Total SPP diterima per bulan</div>
      <div class="chart-wrap">
        ${months.map((m,i)=>`
          <div class="bar-col">
            <span class="amt">${totals[i]>0? fmtRupiah(totals[i]).replace('Rp',''):''}</span>
            <div class="bar" style="height:${Math.max(4, totals[i]/maxTotal*100)}%"></div>
            <span class="lbl">${BULAN[m.bulan-1].slice(0,3)}</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Perlu Ditindaklanjuti</h3>
      <div class="card-sub">Siswa dengan tunggakan terbesar tahun ajaran ${store.state.settings.tahunAjaran}</div>
      ${renderTopTunggakan()}
    </div>
  `;
}
