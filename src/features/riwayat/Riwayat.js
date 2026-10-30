import { store } from '../../app/state.js';
import { currentPeriodeEntry, getPeriode, getActiveTahunMulai, siswaTunggakan, siswaStatusBulan, siswaTotalBulan, BULAN, emptyState, toast } from '../../utils/helpers.js';
import { escapeHtml, escapeAttr, fmtRupiah, formatWaLink } from '../../utils/formatters.js';
import { triggerRender } from '../../utils/events.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { cetakKwitansi } from '../pembayaran/kwitansi.js';
import { cetakKartuSppTahunan } from '../pembayaran/cetakDokumenSiswa.js';
import { parseLocalDate } from '../absensi/absensiService.js';

export function renderRiwayat(){
  const el = document.getElementById('page-riwayat');
  const user = store.ui.currentUser;

  // VIEW FOR SISWA
  if (user && user.role === 'siswa') {
    const s = store.state.siswa.find(x => x.id === user.id);
    if (!s) { el.innerHTML = emptyState('', 'Data tidak ditemukan', '', ''); return; }
    
    const activeTaStart = getActiveTahunMulai();
    const baseTa = store.state.settings.tahunMulai || new Date().getFullYear();
    const taOptions = [];
    for (let y = baseTa - 2; y <= baseTa + 2; y++) {
      taOptions.push(y);
    }

    const periode = getPeriode();
    const t = siswaTunggakan(s.id);
    const nominal = store.state.settings.nominalSPP;
    const nominalIjazah = store.state.settings.nominalIjazah || 500000;
    const jenisFilter = store.ui.siswaRiwayatJenisFilter || 'all';
    
    // Get their payments
    const payments = store.state.pembayaran.filter(p => p.siswaId === s.id).sort((a,b)=> parseLocalDate(b.tanggal) - parseLocalDate(a.tanggal));
    const filteredPayments = payments.filter(p => {
      if (jenisFilter === 'spp') return !p.jenis || p.jenis === 'spp';
      if (jenisFilter === 'ijazah') return p.jenis === 'ijazah';
      return true;
    });
    const ijazahTerbayar = payments.filter(p=>p.jenis==='ijazah').reduce((sum, p)=>sum+p.nominal, 0);
    const cur = currentPeriodeEntry();

    el.innerHTML = `
      <!-- 12-Month Academic Year Payment Timeline -->
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="margin:0; font-size:16px;">Jadwal & Status SPP per Bulan</h3>
            <div class="card-sub" style="margin-top:2px;">Tahun Ajaran ${activeTaStart}/${activeTaStart+1} • ${t.jumlahBulan > 0 ? `<span style="color:#DC2626; font-weight:700;">${t.jumlahBulan} Bulan Menunggak (${fmtRupiah(t.totalKurang)})</span>` : `<span style="color:#059669; font-weight:700;">Semua Bulan Berjalan Lunas</span>`}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <select id="siswa-riwayat-ta" style="font-size:12.5px; padding:6px 10px;">
              ${taOptions.map(y => `<option value="${y}" ${y === activeTaStart ? 'selected' : ''}>TA ${y}/${y+1}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-sm btn-outline" id="btn-siswa-cetak-kartu-spp" style="display:inline-flex; align-items:center; gap:5px;" title="Cetak Rekap Pembayaran 12 Bulan Resmi">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>Cetak Kartu SPP 1 Tahun</span>
            </button>
            ${t.totalKurang > 0 ? `
              <button type="button" class="btn btn-sm" id="btn-siswa-wa-tagihan" style="background:#25D366; color:#fff; border-color:#25D366;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span>Konfirmasi WA</span>
              </button>
            ` : ''}
          </div>
        </div>

        <div class="student-academic-grid">
          ${periode.map(p => {
            const total = siswaTotalBulan(s.id, p.bulan, p.tahun);
            const isPastOrCurrent = (p.tahun < cur.tahun) || (p.tahun === cur.tahun && p.bulan <= cur.bulan);
            
            let cardClass = 'future';
            let chipClass = 'future';
            let chipText = 'Akan Datang';

            if (total >= nominal) {
              cardClass = 'paid';
              chipClass = 'paid';
              chipText = '✓ Lunas';
            } else if (total > 0) {
              cardClass = 'due';
              chipClass = 'due';
              chipText = `Kurang ${fmtRupiah(nominal - total)}`;
            } else if (isPastOrCurrent) {
              cardClass = 'due';
              chipClass = 'due';
              chipText = '! Menunggak';
            }

            const matchingPayment = payments.find(pay => pay.bulan === p.bulan && pay.tahun === p.tahun && (!pay.jenis || pay.jenis === 'spp'));

            return `
              <div class="timeline-month-card ${cardClass}">
                <div class="tm-top">
                  <span class="tm-month-name">${BULAN[p.bulan-1]} ${p.tahun}</span>
                  <span class="tm-chip ${chipClass}">${chipText}</span>
                </div>
                <div class="tm-amount">${total > 0 ? fmtRupiah(total) : fmtRupiah(nominal)}</div>
                <div class="tm-foot">
                  <span>${total >= nominal ? 'Kewajiban: Lunas' : `Kewajiban: ${fmtRupiah(nominal)}`}</span>
                  ${matchingPayment ? `
                    <button type="button" class="btn-tm-receipt" data-month-b="${p.bulan}" data-month-t="${p.tahun}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span>Kwitansi</span>
                    </button>
                  ` : `<span>${total >= nominal ? 'Terbayar' : (isPastOrCurrent ? 'Belum bayar' : 'Jatuh tempo tgl 10')}</span>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- Status Tabungan Ijazah -->
      <div class="card" style="margin-top:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <h3 style="margin:0; font-size:15px;">Administrasi / Tabungan Ijazah</h3>
            <div class="card-sub" style="margin-top:2px;">Biaya kelulusan dan penulisan ijazah resmi</div>
          </div>
          <span class="badge ${ijazahTerbayar >= nominalIjazah ? 'lunas' : 'parsial'}">
            ${ijazahTerbayar >= nominalIjazah ? 'Lunas 100%' : `Sisa ${fmtRupiah(Math.max(0, nominalIjazah - ijazahTerbayar))}`}
          </span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:14px;">
          <div style="background:var(--paper-dim); padding:12px 14px; border-radius:10px; border:1px solid var(--line);">
            <div style="font-size:11px; color:var(--ink-soft); text-transform:uppercase;">Total Ketetapan</div>
            <div style="font-size:16px; font-weight:800; font-family:'IBM Plex Mono', monospace; margin-top:2px;">${fmtRupiah(nominalIjazah)}</div>
          </div>
          <div style="background:rgba(16,185,129,0.08); padding:12px 14px; border-radius:10px; border:1px solid rgba(16,185,129,0.25);">
            <div style="font-size:11px; color:#059669; text-transform:uppercase; font-weight:600;">Sudah Terbayar</div>
            <div style="font-size:16px; font-weight:800; font-family:'IBM Plex Mono', monospace; color:#10B981; margin-top:2px;">${fmtRupiah(ijazahTerbayar)}</div>
          </div>
          <div style="background:rgba(239,68,68,0.08); padding:12px 14px; border-radius:10px; border:1px solid rgba(239,68,68,0.25);">
            <div style="font-size:11px; color:#DC2626; text-transform:uppercase; font-weight:600;">Sisa Pembayaran</div>
            <div style="font-size:16px; font-weight:800; font-family:'IBM Plex Mono', monospace; color:#EF4444; margin-top:2px;">${fmtRupiah(Math.max(0, nominalIjazah - ijazahTerbayar))}</div>
          </div>
        </div>
      </div>

      <!-- Informasi Rekening Resmi Pembayaran Sekolah -->
      <div class="card" style="margin-top:18px; background:linear-gradient(135deg, rgba(67,56,202,0.04), rgba(59,130,246,0.06)); border:1.5px solid rgba(67,56,202,0.22); border-radius:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:32px; height:32px; border-radius:8px; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <div>
              <h3 style="margin:0; font-size:15px; color:var(--primary-strong);">Rekening Resmi Pembayaran Sekolah</h3>
              <div class="card-sub" style="font-size:11.5px; margin-top:1px;">Gunakan rekening berikut untuk pembayaran transfer bank / m-Banking</div>
            </div>
          </div>
          <span class="badge" style="background:rgba(67,56,202,0.12); color:var(--primary); font-weight:700;">Transfer Bank Resmi</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:12px;">
          <div style="background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:12px 14px;">
            <div style="font-size:11px; text-transform:uppercase; color:var(--ink-soft); font-weight:600;">Nama Bank</div>
            <div style="font-size:15px; font-weight:800; color:var(--ink); margin-top:2px;">${escapeHtml(store.state.settings.namaBank || 'Bank BRI / BSI')}</div>
          </div>
          <div style="background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:11px; text-transform:uppercase; color:var(--ink-soft); font-weight:600;">Nomor Rekening</div>
              <div style="font-size:16px; font-weight:800; font-family:'IBM Plex Mono', monospace; color:var(--primary); margin-top:2px;" id="val-no-rek">${escapeHtml(store.state.settings.noRekening || '0123-01-000000-50-0')}</div>
            </div>
            <button type="button" class="btn btn-sm btn-ghost" id="btn-copy-no-rek" style="padding:6px 10px;" title="Salin Nomor Rekening">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Salin</span>
            </button>
          </div>
          <div style="background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:12px 14px;">
            <div style="font-size:11px; text-transform:uppercase; color:var(--ink-soft); font-weight:600;">Atas Nama</div>
            <div style="font-size:14.5px; font-weight:700; color:var(--ink); margin-top:2px;">${escapeHtml(store.state.settings.atasNamaRekening || 'Bendahara Madrasah')}</div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding-top:10px; border-top:1px dashed rgba(67,56,202,0.2);">
          <div style="font-size:12px; color:var(--ink-soft);">
            💡 <em>Catatan:</em> Cantumkan Nama <strong>${escapeHtml(s.nama)}</strong> (${escapeHtml(s.kelas)}) di berita transfer dan kirim bukti transfer ke bendahara.
          </div>
          <button type="button" class="btn btn-sm btn-primary" id="btn-konfirmasi-transfer-wa" style="background:#25D366; border-color:#25D366; display:inline-flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <span>Kirim Bukti Transfer WA</span>
          </button>
        </div>
      </div>
      
      <!-- Riwayat Transaksi & Kwitansi -->
      <div class="card" style="margin-top:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div>
            <h3 style="margin:0; font-size:15px;">Daftar Transaksi & Kwitansi Resmi</h3>
            <div class="card-sub" style="margin-top:2px;">Seluruh setoran yang telah diverifikasi oleh Bendahara</div>
          </div>
          <div class="tabs" style="padding:3px;">
            <button type="button" class="tab-btn ${jenisFilter === 'all' ? 'active' : ''}" data-st-jenis="all" style="padding:5px 12px; font-size:12px;">Semua (${payments.length})</button>
            <button type="button" class="tab-btn ${jenisFilter === 'spp' ? 'active' : ''}" data-st-jenis="spp" style="padding:5px 12px; font-size:12px;">SPP</button>
            <button type="button" class="tab-btn ${jenisFilter === 'ijazah' ? 'active' : ''}" data-st-jenis="ijazah" style="padding:5px 12px; font-size:12px;">Ijazah</button>
          </div>
        </div>
        ${filteredPayments.length === 0 ? '<div class="empty-state" style="padding:28px;">Belum ada transaksi pembayaran pada kategori ini.</div>' : `
          <div class="transaction-list" style="margin-top:12px;">
            ${filteredPayments.map(p => `
              <div class="transaction-item">
                <div class="ti-left">
                  <div class="ti-icon" style="${p.jenis === 'ijazah' ? 'background:rgba(59,130,246,0.12); color:#2563EB;' : ''}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div>
                    <div class="ti-title">${(!p.jenis || p.jenis === 'spp') ? 'SPP Bulan ' + BULAN[(p.bulan||1)-1] + ' ' + (p.tahun||'') : 'Pembayaran Ijazah'}</div>
                    <div class="ti-date">
                      ${parseLocalDate(p.tanggal).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}
                      ${p.noKwitansi ? ` • <span class="monospace" style="color:var(--primary); font-weight:600;">${escapeHtml(p.noKwitansi)}</span>` : ''}
                    </div>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                  <div class="ti-amount">+ ${fmtRupiah(p.nominal)}</div>
                  <button type="button" class="btn btn-secondary btn-print-single-pay" data-pay-id="${p.id}" style="padding:6px 12px; font-size:12px; display:inline-flex; align-items:center; gap:5px;" title="Buka & Cetak Kwitansi Resmi">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M6 9V3h12v6M6 18h12v4H6v-4zM4 9h16v7H4z"/></svg>
                    <span>Kwitansi</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    document.getElementById('siswa-riwayat-ta')?.addEventListener('change', e => {
      store.ui.activeTahunMulai = parseInt(e.target.value, 10);
      renderRiwayat();
    });

    document.getElementById('btn-siswa-cetak-kartu-spp')?.addEventListener('click', () => {
      cetakKartuSppTahunan(s, store.ui.activeTahunMulai);
    });

    document.getElementById('btn-copy-no-rek')?.addEventListener('click', () => {
      const rekText = (store.state.settings.noRekening || '0123-01-000000-50-0').replace(/\s+/g, '');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(rekText);
        toast('Nomor rekening berhasil disalin ke clipboard!', 'success');
      } else {
        toast(`Nomor Rekening: ${rekText}`, 'info');
      }
    });

    document.getElementById('btn-konfirmasi-transfer-wa')?.addEventListener('click', () => {
      const noHp = store.state.settings.noHpBendahara;
      if (!noHp) {
        toast('Nomor WhatsApp bendahara belum disetel oleh sekolah.', 'info');
        return;
      }
      const pesan = `Halo Bendahara ${store.state.settings.namaSekolah},\n\nSaya ingin mengirimkan *Bukti Transfer Pembayaran*:\nNama Siswa : *${s.nama}*\nKelas      : *${s.kelas}*\nNIS        : *${s.nis || '-'}*\n\nMohon dicek dan dicatat ke sistem. Berikut lampiran struk transfernya. Terima kasih.`;
      window.open(formatWaLink(noHp, pesan), '_blank');
    });

    document.getElementById('btn-siswa-wa-tagihan')?.addEventListener('click', () => {
      const noHpBendahara = store.state.settings.noHpBendahara;
      if (!noHpBendahara) {
        toast('Nomor WhatsApp Bendahara belum diatur oleh sekolah.', 'info');
        return;
      }
      const rincian = t.bulanBelum.map(m => `- ${BULAN[m.bulan-1]} ${m.tahun} (${fmtRupiah(m.kurang)})`).join('\n');
      const teks = `Halo Bendahara ${store.state.settings.namaSekolah},\n\nSaya *${s.nama}* (Kelas ${s.kelas}, NIS: ${s.nis || '-'}) ingin melakukan konfirmasi / pembayaran tagihan SPP:\n\n${rincian}\n*Total: ${fmtRupiah(t.totalKurang)}*\n\nTerima kasih.`;
      window.open(formatWaLink(noHpBendahara, teks), '_blank');
    });

    el.querySelectorAll('[data-st-jenis]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.ui.siswaRiwayatJenisFilter = btn.dataset.stJenis;
        renderRiwayat();
      });
    });

    // Attach kwitansi click listeners
    el.querySelectorAll('.btn-tm-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        const b = +btn.dataset.monthB;
        const th = +btn.dataset.monthT;
        const totalBulan = siswaTotalBulan(s.id, b, th);
        const latestPay = payments.find(pay => pay.bulan === b && pay.tahun === th && (!pay.jenis || pay.jenis === 'spp'));
        if (latestPay) {
          cetakKwitansi(s, [{ bulan: b, tahun: th }], totalBulan, latestPay.noKwitansi || 'KW-ONLINE', latestPay.tanggal, 'spp');
        }
      });
    });

    el.querySelectorAll('.btn-print-single-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = payments.find(x => x.id === btn.dataset.payId);
        if (p) {
          const months = (!p.jenis || p.jenis === 'spp') ? [{ bulan: p.bulan, tahun: p.tahun }] : [];
          cetakKwitansi(s, months, p.nominal, p.noKwitansi || 'KW-ONLINE', p.tanggal, p.jenis || 'spp');
        }
      });
    });

    return;
  }

  // VIEW FOR BENDAHARA
  if(store.state.siswa.length===0){
    el.innerHTML = emptyState('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>', 'Belum ada data siswa', 'Data riwayat akan muncul setelah kamu menambahkan siswa dan mencatat pembayaran.', 'Tambah Data Siswa', () => {
      store.ui.page = 'siswa';
      triggerRender();
      setTimeout(()=>{ 
        const b = document.getElementById('btn-add-siswa'); 
        if(b) b.click(); 
      }, 30); 
    });
    return;
  }
  const wasSearchFocused = document.activeElement?.id === 'riwayat-search';
  const selStart = wasSearchFocused ? document.activeElement.selectionStart : null;
  const selEnd = wasSearchFocused ? document.activeElement.selectionEnd : null;
  const kelasList = [...new Set(store.state.siswa.map(s=>s.kelas))].sort();
  const cur = currentPeriodeEntry();

  let rows = store.state.siswa.map(s=>{
    const t = siswaTunggakan(s.id);
    const st = siswaStatusBulan(s.id, cur.bulan, cur.tahun);
    return { s, t, st };
  });
  rows = rows.filter(r=>{
    const matchSearch = !store.ui.riwayatSearch || r.s.nama.toLowerCase().includes(store.ui.riwayatSearch.toLowerCase());
    const matchKelas = !store.ui.riwayatKelasFilter || r.s.kelas === store.ui.riwayatKelasFilter;
    const matchStatus = !store.ui.riwayatStatusFilter || r.st === store.ui.riwayatStatusFilter;
    return matchSearch && matchKelas && matchStatus;
  }).sort((a,b)=> b.t.totalKurang - a.t.totalKurang);

  el.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <input class="search-input" id="riwayat-search" placeholder="Cari nama siswa..." value="${escapeAttr(store.ui.riwayatSearch)}">
        <select id="riwayat-kelas-filter"><option value="">Semua Kelas</option>${kelasList.map(k=>`<option value="${escapeAttr(k)}" ${store.ui.riwayatKelasFilter===k?'selected':''}>${escapeHtml(k)}</option>`).join('')}</select>
        <select id="riwayat-status-filter">
          <option value="">Semua Status</option>
          <option value="lunas" ${store.ui.riwayatStatusFilter==='lunas'?'selected':''}>Lunas bulan ini</option>
          <option value="parsial" ${store.ui.riwayatStatusFilter==='parsial'?'selected':''}>Sebagian</option>
          <option value="nunggak" ${store.ui.riwayatStatusFilter==='nunggak'?'selected':''}>Belum bayar</option>
        </select>
      </div>
    </div>
    <div class="card" style="padding:0;">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Nama</th><th>Kelas</th><th>Status Bulan Ini</th><th class="num">Sisa Ijazah</th><th class="num">Bulan Tertunggak</th><th class="num">Tunggakan SPP</th><th style="width:50px;"></th></tr></thead>
          <tbody id="riwayat-tbody"></tbody>
        </table>
      </div>
    </div>
    <div id="riwayat-pagination"></div>
  `;
  const tbody = document.getElementById('riwayat-tbody');
  
  const ITEMS_PER_PAGE = 50;
  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE) || 1;
  if(store.ui.pageRiwayat > totalPages) store.ui.pageRiwayat = totalPages;
  const paged = rows.slice((store.ui.pageRiwayat-1)*ITEMS_PER_PAGE, store.ui.pageRiwayat*ITEMS_PER_PAGE);

  if(paged.length===0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Tidak ada data yang cocok dengan filter.</td></tr>`;
  } else {
    tbody.innerHTML = paged.map(r=>`<tr>
      <td>${escapeHtml(r.s.nama)}</td>
      <td><span class="kelas-chip">${escapeHtml(r.s.kelas)}</span></td>
      <td><span class="badge ${r.st}">${r.st==='lunas'?'Lunas':r.st==='parsial'?'Sebagian':'Belum Bayar'}</span></td>
      <td class="num">${fmtRupiah(Math.max(0, (store.state.settings.nominalIjazah || 500000) - store.state.pembayaran.filter(p=>p.siswaId===r.s.id && p.jenis==='ijazah').reduce((sum, p)=>sum+p.nominal, 0)))}</td>
      <td class="num">${r.t.jumlahBulan}</td>
      <td class="num">${fmtRupiah(r.t.totalKurang)}</td>
      <td style="display:flex; gap:4px; justify-content:flex-end;">
        ${r.s.noHp && r.t.totalKurang > 0 ? `<button class="btn btn-sm btn-ghost" style="color:#25D366;" data-wa-tagihan="${r.s.id}" title="Kirim Tagihan WA"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button>` : ''}
        <button class="btn btn-sm btn-secondary" data-bayar-riw="${r.s.id}" title="Catat Pembayaran Siswa Ini">Bayar</button>
        <button class="btn btn-sm btn-ghost" data-detail="${r.s.id}">Detail</button>
      </td>
    </tr>`).join('');
  }

  const paginationEl = document.getElementById('riwayat-pagination');
  if(totalPages > 1){
    paginationEl.innerHTML = `
      <div style="display:flex; justify-content:center; gap:8px; margin-top:14px; align-items:center;">
        <button class="btn btn-sm" id="btn-prev-riw" ${store.ui.pageRiwayat===1?'disabled':''}>Sebelumnya</button>
        <span style="font-size:12px; color:var(--ink-soft);">Halaman ${store.ui.pageRiwayat} dari ${totalPages}</span>
        <button class="btn btn-sm" id="btn-next-riw" ${store.ui.pageRiwayat===totalPages?'disabled':''}>Selanjutnya</button>
      </div>`;
    const btnPrev = document.getElementById('btn-prev-riw');
    const btnNext = document.getElementById('btn-next-riw');
    if(btnPrev) btnPrev.addEventListener('click', ()=>{ store.ui.pageRiwayat--; renderRiwayat(); });
    if(btnNext) btnNext.addEventListener('click', ()=>{ store.ui.pageRiwayat++; renderRiwayat(); });
  }

  const searchInputEl = document.getElementById('riwayat-search');
  searchInputEl.addEventListener('input', e=>{ store.ui.riwayatSearch=e.target.value; store.ui.pageRiwayat=1; renderRiwayat(); });
  if (wasSearchFocused && searchInputEl) {
    searchInputEl.focus();
    if (selStart !== null) searchInputEl.setSelectionRange(selStart, selEnd);
  }
  document.getElementById('riwayat-kelas-filter').addEventListener('change', e=>{ store.ui.riwayatKelasFilter=e.target.value; store.ui.pageRiwayat=1; renderRiwayat(); });
  document.getElementById('riwayat-status-filter').addEventListener('change', e=>{ store.ui.riwayatStatusFilter=e.target.value; store.ui.pageRiwayat=1; renderRiwayat(); });
  tbody.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click', ()=>openDetailSiswa(b.dataset.detail)));
  tbody.querySelectorAll('[data-bayar-riw]').forEach(b=>b.addEventListener('click', ()=>{
    store.ui.bayarSiswaId = b.dataset.bayarRiw;
    store.ui.bayarSelectedMonths = [];
    store.ui.page = 'bayar';
    triggerRender();
  }));
  tbody.querySelectorAll('[data-wa-tagihan]').forEach(b=>b.addEventListener('click', ()=>{
    const id = b.dataset.waTagihan;
    const s = store.state.siswa.find(x=>x.id===id);
    const t = siswaTunggakan(id);
    const bulanTeks = t.bulanBelum.map(m=>`- ${BULAN[m.bulan-1]} ${m.tahun} (Kurang: ${fmtRupiah(m.kurang)})`).join('\n');
    const teks = `Halo Bapak/Ibu,\n\nKami menginformasikan bahwa terdapat tunggakan pembayaran SPP atas nama *${s.nama}* (Kelas ${s.kelas}).\n\nRincian Tunggakan:\n${bulanTeks}\n\n*Total Tunggakan: ${fmtRupiah(t.totalKurang)}*\n\nMohon untuk segera melakukan pembayaran. Jika sudah membayar, abaikan pesan ini.\n\nTerima kasih,\nBendahara ${store.state.settings.namaSekolah}`;
    const url = formatWaLink(s.noHp, teks);
    window.open(url, '_blank');
  }));
}

function openDetailSiswa(id){
  const s = store.state.siswa.find(x=>x.id===id);
  const t = siswaTunggakan(id);
  const periode = getPeriode();
  openModal(`
    <div class="modal-head"><h3>${escapeHtml(s.nama)}</h3><button class="close-x" id="modal-close">&times;</button></div>
    <div class="modal-body">
      <div class="kpi-line">
        <div class="kpi"><span class="n">${escapeHtml(s.kelas)}</span><span class="l">Kelas</span></div>
        <div class="kpi"><span class="n">${escapeHtml(s.nis||'-')}</span><span class="l">NIS</span></div>
        <div class="kpi"><span class="n">${fmtRupiah(t.totalKurang)}</span><span class="l">Tunggakan SPP</span></div>
      </div>
      <div class="divider"></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:12px; background:var(--paper-dim); padding:10px; border-radius:6px;">
        <span>Sisa Tagihan Ijazah:</span>
        <strong style="color:var(--rust);">${fmtRupiah(Math.max(0, (store.state.settings.nominalIjazah || 500000) - store.state.pembayaran.filter(p=>p.siswaId===s.id && p.jenis==='ijazah').reduce((sum, p)=>sum+p.nominal, 0)))}</strong>
      </div>
      <label>Status SPP per bulan — Tahun Ajaran ${store.state.settings.tahunAjaran}</label>
      <div class="month-grid">
        ${periode.map(p=>{
          const total = siswaTotalBulan(s.id, p.bulan, p.tahun);
          const nominal = store.state.settings.nominalSPP;
          const cls = total>=nominal ? 'paid' : '';
          return `<div class="month-pill ${cls}">${BULAN[p.bulan-1]} '${String(p.tahun).slice(2)}<span class="chk">${total>=nominal?'✓ Lunas':total>0?fmtRupiah(total):'—'}</span></div>`;
        }).join('')}
      </div>
    </div>
    <div class="modal-foot">
      ${s.noHp && t.totalKurang > 0 ? `<button class="btn" id="btn-wa-tagihan" style="background:#25D366; color:white; border-color:#25D366; margin-right:auto;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Kirim Tagihan WA</button>` : ''}
      <button class="btn" id="modal-cancel">Tutup</button>
      <button class="btn btn-primary" id="btn-detail-bayar">Input Pembayaran</button>
    </div>
  `, 'wide');

  document.getElementById('btn-detail-bayar')?.addEventListener('click', () => {
    closeModal();
    store.ui.bayarSiswaId = s.id;
    store.ui.bayarSelectedMonths = [];
    store.ui.page = 'bayar';
    triggerRender();
  });

  if (s.noHp && t.totalKurang > 0) {
    document.getElementById('btn-wa-tagihan').addEventListener('click', ()=>{
      const bulanTeks = t.bulanBelum.map(b=>`- ${BULAN[b.bulan-1]} ${b.tahun} (Kurang: ${fmtRupiah(b.kurang)})`).join('\n');
      const teks = `Halo Bapak/Ibu,\n\nKami menginformasikan bahwa terdapat tunggakan pembayaran SPP atas nama *${s.nama}* (Kelas ${s.kelas}).\n\nRincian Tunggakan:\n${bulanTeks}\n\n*Total Tunggakan: ${fmtRupiah(t.totalKurang)}*\n\nMohon untuk segera melakukan pembayaran. Jika sudah membayar, abaikan pesan ini.\n\nTerima kasih,\nBendahara ${store.state.settings.namaSekolah}`;
      const url = formatWaLink(s.noHp, teks);
      window.open(url, '_blank');
    });
  }
}
