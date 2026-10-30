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
      if (jenisFilter === 'lainnya') return p.jenis && p.jenis !== 'spp' && p.jenis !== 'ijazah';
      return true;
    });
    const ijazahTerbayar = payments.filter(p=>p.jenis==='ijazah').reduce((sum, p)=>sum+p.nominal, 0);
    const lainnyaCount = payments.filter(p => p.jenis && p.jenis !== 'spp' && p.jenis !== 'ijazah').length;
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
            <button type="button" class="btn btn-sm btn-outline" id="btn-siswa-share-tagihan" style="display:inline-flex; align-items:center; gap:5px;" title="Bagikan Ringkasan Tagihan & Rekening Resmi ke WhatsApp">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              <span>Kirim Tagihan ke WA Saya</span>
            </button>
            ${t.totalKurang > 0 ? `
              <button type="button" class="btn btn-sm" id="btn-siswa-wa-tagihan" style="background:#25D366; color:#fff; border-color:#25D366;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span>Konfirmasi Bendahara</span>
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
              chipText = 'Lunas';
            } else if (total > 0) {
              cardClass = 'due';
              chipClass = 'due';
              chipText = `Kurang ${fmtRupiah(nominal - total)}`;
            } else if (isPastOrCurrent) {
              cardClass = 'due';
              chipClass = 'due';
              chipText = 'Menunggak';
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

      <!-- Status Pos Tagihan Sekolah Lainnya -->
      ${(store.state.posTagihan || []).length > 0 ? `
        <div class="card" style="margin-top:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <h3 style="margin:0; font-size:15px;">Kewajiban & Tagihan Sekolah Lainnya</h3>
              <div class="card-sub" style="margin-top:2px;">Uang gedung, seragam, ujian, dan administrasi kesiswaan</div>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:14px;">
            ${(store.state.posTagihan || []).map(pos => {
              const terbayar = payments.filter(p => p.jenis === pos.id).reduce((sum, p) => sum + p.nominal, 0);
              const sisa = Math.max(0, pos.nominal - terbayar);
              const isLunas = terbayar >= pos.nominal;
              return `
                <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:10px; padding:12px 14px;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                      <div style="font-size:13.5px; font-weight:700; color:var(--ink);">${escapeHtml(pos.nama)}</div>
                      <div style="font-size:11px; color:var(--ink-soft); text-transform:uppercase; margin-top:1px;">Ketetapan: ${fmtRupiah(pos.nominal)}</div>
                    </div>
                    <span class="badge ${isLunas ? 'lunas' : 'parsial'}" style="font-size:10.5px;">
                      ${isLunas ? 'Lunas' : 'Belum Lunas'}
                    </span>
                  </div>
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-top:8px; padding-top:6px; border-top:1px dashed var(--line);">
                    <span style="color:#059669; font-weight:600;">Terbayar: ${fmtRupiah(terbayar)}</span>
                    <span style="color:${sisa > 0 ? '#DC2626' : '#10B981'}; font-weight:700;">${sisa > 0 ? `Sisa: ${fmtRupiah(sisa)}` : 'Selesai'}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

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
          <div style="font-size:12px; color:var(--ink-soft); display:flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary); flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span><em>Catatan:</em> Cantumkan Nama <strong>${escapeHtml(s.nama)}</strong> (${escapeHtml(s.kelas)}) di berita transfer dan kirim bukti transfer ke bendahara.</span>
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
            ${lainnyaCount > 0 ? `<button type="button" class="tab-btn ${jenisFilter === 'lainnya' ? 'active' : ''}" data-st-jenis="lainnya" style="padding:5px 12px; font-size:12px;">Tagihan Lain (${lainnyaCount})</button>` : ''}
          </div>
        </div>
        ${filteredPayments.length === 0 ? '<div class="empty-state" style="padding:28px;">Belum ada transaksi pembayaran pada kategori ini.</div>' : `
          <div class="transaction-list" style="margin-top:12px;">
            ${filteredPayments.map(p => {
              let posNama = 'SPP';
              if (p.jenis === 'ijazah') {
                posNama = 'Pembayaran Ijazah';
              } else if (!p.jenis || p.jenis === 'spp') {
                posNama = 'SPP Bulan ' + BULAN[(p.bulan||1)-1] + ' ' + (p.tahun||'');
              } else {
                const foundPos = (store.state.posTagihan || []).find(x => x.id === p.jenis);
                posNama = foundPos ? foundPos.nama : (p.namaTagihan || 'Tagihan Lainnya');
              }

              return `
              <div class="transaction-item">
                <div class="ti-left">
                  <div class="ti-icon" style="${p.jenis === 'ijazah' ? 'background:rgba(59,130,246,0.12); color:#2563EB;' : (p.jenis && p.jenis !== 'spp' ? 'background:rgba(16,185,129,0.12); color:#059669;' : '')}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div>
                    <div class="ti-title">${escapeHtml(posNama)}</div>
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
            `;
            }).join('')}
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

    document.getElementById('btn-siswa-share-tagihan')?.addEventListener('click', () => {
      const sNama = s.nama;
      const sKelas = s.kelas;
      const sNis = s.nis || '-';
      const settings = store.state.settings;
      const rincianSPP = t.bulanBelum.length > 0 
        ? t.bulanBelum.map(m => `  • ${BULAN[m.bulan-1]} ${m.tahun} : ${fmtRupiah(m.kurang)}`).join('\n')
        : '  • Seluruh bulan berjalan LUNAS';
      const sisaIjazah = Math.max(0, (settings.nominalIjazah || 500000) - ijazahTerbayar);
      const targetPhone = s.noHp || s.telepon || '';

      const posList = store.state.posTagihan || [];
      let rincianPosLain = '';
      let totalSisaPos = 0;
      if (posList.length > 0) {
        rincianPosLain = `\n*3. Kewajiban & Tagihan Sekolah Lainnya:*\n`;
        posList.forEach(pos => {
          const terbayar = payments.filter(p => p.jenis === pos.id).reduce((sum, p) => sum + p.nominal, 0);
          const sisa = Math.max(0, pos.nominal - terbayar);
          totalSisaPos += sisa;
          rincianPosLain += `  • ${pos.nama} : Ketetapan ${fmtRupiah(pos.nominal)} | Sisa ${sisa > 0 ? fmtRupiah(sisa) : 'Lunas'}\n`;
        });
      }

      const totalKewajiban = t.totalKurang + sisaIjazah + totalSisaPos;

      const pesanWa = `*RINCIAN TAGIHAN & KEUANGAN SISWA*\n` +
        `Sekolah: *${settings.namaSekolah}*\n` +
        `Tahun Ajaran: ${activeTaStart}/${activeTaStart+1}\n\n` +
        `Nama Siswa : *${sNama}*\n` +
        `Kelas      : *${sKelas}*\n` +
        `NIS        : *${sNis}*\n\n` +
        `*1. Tagihan SPP Bulanan:*\n` +
        `${rincianSPP}\n` +
        `Total Tagihan SPP: *${fmtRupiah(t.totalKurang)}*\n\n` +
        `*2. Tabungan Administrasi Ijazah:*\n` +
        `  • Ketetapan : ${fmtRupiah(settings.nominalIjazah || 500000)}\n` +
        `  • Terbayar  : ${fmtRupiah(ijazahTerbayar)}\n` +
        `  • Sisa      : *${fmtRupiah(sisaIjazah)}*\n` +
        `${rincianPosLain}\n` +
        `*TOTAL SELURUH KEWAJIBAN: ${fmtRupiah(totalKewajiban)}*\n\n` +
        `*Rekening Resmi Pembayaran:*\n` +
        `Bank       : ${settings.namaBank || 'Bank BRI / BSI'}\n` +
        `No. Rek    : *${settings.noRekening || '0123-01-000000-50-0'}*\n` +
        `Atas Nama  : *${settings.atasNamaRekening || 'Bendahara Madrasah'}*\n\n` +
        `_Konfirmasi transfer dapat langsung menghubungi Bendahara Madrasah. Terima kasih._`;

      openModal(`
        <div class="modal-head">
          <h3>Kirim Ringkasan Tagihan via WhatsApp</h3>
          <button class="close-x" id="modal-close">&times;</button>
        </div>
        <div class="modal-body" style="padding:16px;">
          <div style="font-size:13px; color:var(--ink-soft); margin-bottom:12px;">
            Kirimkan rincian tagihan ini ke nomor WhatsApp Anda atau orang tua/wali untuk pengingat dan panduan transfer.
          </div>
          <div class="form-group">
            <label>Nomor WhatsApp Tujuan</label>
            <input id="wa-share-phone" type="tel" style="width:100%;" value="${escapeAttr(targetPhone)}" placeholder="cth. 081234567890">
            <div class="helper-text">Nomor HP siswa atau orang tua/wali siswa.</div>
          </div>
          <div class="form-group" style="margin-top:12px;">
            <label>Pratinjau Pesan</label>
            <textarea id="wa-share-preview" readonly style="width:100%; height:130px; font-size:11.5px; font-family:monospace; background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; padding:8px;">${escapeHtml(pesanWa)}</textarea>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" id="modal-cancel">Batal</button>
          <button class="btn btn-outline" id="btn-copy-wa-preview">Salin Pesan</button>
          <button class="btn btn-primary" id="btn-send-wa-share" style="background:#25D366; border-color:#25D366; display:inline-flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            Buka di WhatsApp
          </button>
        </div>
      `);

      document.getElementById('btn-copy-wa-preview')?.addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(pesanWa);
          toast('Pesan tagihan berhasil disalin ke clipboard!', 'success');
        } else {
          toast('Gagal menyalin otomatis, silakan salin manual dari kotak teks.', 'info');
        }
      });

      document.getElementById('btn-send-wa-share')?.addEventListener('click', () => {
        const phone = document.getElementById('wa-share-phone')?.value.trim();
        if (!phone) {
          toast('Masukkan nomor WhatsApp tujuan terlebih dahulu.', 'warning');
          return;
        }
        window.open(formatWaLink(phone, pesanWa), '_blank');
        closeModal();
      });
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
      <div class="toolbar-right">
        <button class="btn btn-primary" id="btn-broadcast-wa-kelas" style="display:inline-flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          <span>Tagihan Kolektif Kelas (Broadcast WA)</span>
        </button>
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
  document.getElementById('btn-broadcast-wa-kelas')?.addEventListener('click', () => {
    openModalBroadcastKelas(store.ui.riwayatKelasFilter || kelasList[0] || '');
  });
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

function openModalBroadcastKelas(activeKelas) {
  const kelasList = [...new Set(store.state.siswa.map(s => s.kelas))].sort();
  const selectedKelas = activeKelas || kelasList[0] || '';
  const settings = store.state.settings || {};

  const renderModalContent = (k) => {
    const studentsInClass = store.state.siswa.filter(s => s.kelas === k);
    const nunggakList = studentsInClass.map(s => ({
      siswa: s,
      tunggakan: siswaTunggakan(s.id)
    })).filter(item => item.tunggakan.totalKurang > 0)
      .sort((a,b) => b.tunggakan.totalKurang - a.tunggakan.totalKurang);

    const totalTunggakanKelas = nunggakList.reduce((sum, item) => sum + item.tunggakan.totalKurang, 0);

    const daftarTeksGrup = nunggakList.map((item, idx) => {
      const s = item.siswa;
      const t = item.tunggakan;
      return `${idx + 1}. *${s.nama}* — ${t.jumlahBulan} Bulan (${fmtRupiah(t.totalKurang)})`;
    }).join('\n');

    const pesanGrupWa = `*PEMBERITAHUAN ADMINISTRASI SPP SISWA*\n` +
      `*Madrasah: ${settings.namaSekolah.toUpperCase()}*\n` +
      `Kelas: *${k}* • Tahun Ajaran: ${settings.tahunAjaran || ''}\n` +
      `------------------------------------------------------\n` +
      `Kepada Yth. Bapak/Ibu Orang Tua / Wali Murid Kelas ${k},\n\n` +
      `Berikut kami sampaikan rekap pengingat administrasi SPP bulan berjalan bagi siswa yang belum menyelesaikan pembayaran:\n\n` +
      (nunggakList.length > 0 ? daftarTeksGrup : `Alhamdulillah, seluruh siswa kelas ${k} telah LUNAS.\n`) +
      `\n*Total Tunggakan Kelas: ${fmtRupiah(totalTunggakanKelas)}*\n\n` +
      `*Rekening Resmi Pembayaran:*\n` +
      `Bank      : ${settings.namaBank || 'Bank BRI / BSI'}\n` +
      `No. Rek   : *${settings.noRekening || '0123-01-000000-50-0'}*\n` +
      `Atas Nama : *${settings.atasNamaRekening || 'Bendahara Madrasah'}*\n\n` +
      `Bukti transfer mohon dikirimkan ke Bendahara Madrasah. Apabila Bapak/Ibu telah melakukan pembayaran, mohon abaikan pesan ini.\n` +
      `Terima kasih atas kerja sama dan perhatian Bapak/Ibu sekalian.`;

    return `
      <div class="modal-head">
        <div>
          <h3 style="margin:0;">Tagihan Kolektif Kelas (Broadcast WA)</h3>
          <div style="font-size:12px; color:var(--ink-soft); margin-top:2px;">Pengingat tagihan SPP per kelas untuk grup WhatsApp atau pesan pribadi</div>
        </div>
        <button class="close-x" id="modal-close">&times;</button>
      </div>
      <div class="modal-body" style="padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="margin:0; font-size:13px; font-weight:600;">Pilih Kelas:</label>
            <select id="bc-select-kelas" style="font-size:13px; font-weight:700; padding:6px 12px;">
              ${kelasList.map(c => `<option value="${escapeAttr(c)}" ${c === k ? 'selected' : ''}>Kelas ${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex; gap:8px;">
            <span class="badge ${nunggakList.length > 0 ? 'menunggak' : 'lunas'}">
              ${nunggakList.length} Siswa Menunggak (${fmtRupiah(totalTunggakanKelas)})
            </span>
          </div>
        </div>

        <div class="tabs" style="margin-bottom:12px; padding:3px;">
          <button type="button" class="tab-btn active" id="tab-bc-group" style="padding:5px 12px; font-size:12px;">Pesan Grup WhatsApp Wali Murid</button>
          <button type="button" class="tab-btn" id="tab-bc-japri" style="padding:5px 12px; font-size:12px;">Antrean Kirim Japri (${nunggakList.length})</button>
        </div>

        <!-- Section 1: Pesan Grup WA -->
        <div id="sec-bc-group">
          <div style="font-size:12px; color:var(--ink-soft); margin-bottom:6px;">
            Salin draf pengumuman resmi di bawah ini lalu tempel (paste) ke grup WhatsApp wali murid kelas ${escapeHtml(k)}.
          </div>
          <textarea id="bc-text-grup" readonly style="width:100%; height:190px; font-family:monospace; font-size:12px; background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; padding:10px; line-height:1.45;">${escapeHtml(pesanGrupWa)}</textarea>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
            <button class="btn btn-outline" id="btn-copy-grup-wa" style="display:inline-flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Salin Pesan Pengumuman Grup</span>
            </button>
          </div>
        </div>

        <!-- Section 2: Japri One-Click -->
        <div id="sec-bc-japri" style="display:none;">
          ${nunggakList.length === 0 ? '<div class="empty-state" style="padding:20px;">Semua siswa di kelas ini telah lunas.</div>' : `
            <div style="max-height:240px; overflow-y:auto; border:1px solid var(--line); border-radius:8px;">
              <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
                <thead>
                  <tr style="background:var(--paper-dim); border-bottom:1px solid var(--line);">
                    <th style="padding:8px 10px; text-align:left;">Siswa</th>
                    <th style="padding:8px 10px; text-align:left;">No. WhatsApp</th>
                    <th style="padding:8px 10px; text-align:right;">Tunggakan</th>
                    <th style="padding:8px 10px; text-align:right;">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${nunggakList.map(item => {
                    const s = item.siswa;
                    const t = item.tunggakan;
                    const hasPhone = Boolean(s.noHp || s.telepon);
                    const bulanStr = t.bulanBelum.map(b => `${BULAN[b.bulan-1]} ${b.tahun}`).join(', ');
                    const pesanJapri = `Halo Bapak/Ibu Wali Murid dari *${s.nama}* (Kelas ${s.kelas}),\n\nKami menginformasikan bahwa terdapat tunggakan pembayaran SPP sebesar *${fmtRupiah(t.totalKurang)}* (${t.jumlahBulan} bulan: ${bulanStr}).\n\nPembayaran dapat ditransfer ke rekening resmi madrasah:\nBank: ${settings.namaBank || 'Bank BRI / BSI'}\nNo. Rek: *${settings.noRekening || '0123-01-000000-50-0'}*\nA.N: *${settings.atasNamaRekening || 'Bendahara Madrasah'}*\n\nMohon kirimkan bukti transfer ke nomor ini. Terima kasih.\n- Bendahara ${settings.namaSekolah}`;

                    return `
                      <tr style="border-bottom:1px solid var(--line);">
                        <td style="padding:8px 10px;">
                          <strong>${escapeHtml(s.nama)}</strong>
                          <div style="font-size:11px; color:var(--ink-soft);">${escapeHtml(s.nis || '-')} • ${t.jumlahBulan} bln</div>
                        </td>
                        <td style="padding:8px 10px; font-family:monospace; color:${hasPhone ? 'var(--ink)' : 'var(--rust)'};">
                          ${escapeHtml(s.noHp || s.telepon || '(Belum ada No. HP)')}
                        </td>
                        <td style="padding:8px 10px; text-align:right; font-family:monospace; color:#DC2626; font-weight:700;">
                          ${fmtRupiah(t.totalKurang)}
                        </td>
                        <td style="padding:8px 10px; text-align:right; white-space:nowrap;">
                          ${hasPhone ? `
                            <button type="button" class="btn btn-sm btn-bc-japri" data-phone="${escapeAttr(s.noHp || s.telepon)}" data-msg="${escapeAttr(pesanJapri)}" style="background:#25D366; color:#fff; border-color:#25D366; padding:4px 10px; font-size:11.5px; display:inline-flex; align-items:center; gap:4px;">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                              Kirim WA
                            </button>
                          ` : '<span style="font-size:11px; color:var(--ink-soft);">-</span>'}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" id="modal-cancel">Tutup</button>
      </div>
    `;
  };

  openModal(renderModalContent(selectedKelas), 'wide');

  const setupEvents = (curK) => {
    document.getElementById('bc-select-kelas')?.addEventListener('change', e => {
      const nextK = e.target.value;
      const modalBody = document.querySelector('.modal-content');
      if (modalBody) {
        modalBody.innerHTML = renderModalContent(nextK);
        setupEvents(nextK);
      }
    });

    const tabGroup = document.getElementById('tab-bc-group');
    const tabJapri = document.getElementById('tab-bc-japri');
    const secGroup = document.getElementById('sec-bc-group');
    const secJapri = document.getElementById('sec-bc-japri');

    tabGroup?.addEventListener('click', () => {
      tabGroup.classList.add('active');
      tabJapri?.classList.remove('active');
      if (secGroup) secGroup.style.display = 'block';
      if (secJapri) secJapri.style.display = 'none';
    });

    tabJapri?.addEventListener('click', () => {
      tabJapri.classList.add('active');
      tabGroup?.classList.remove('active');
      if (secJapri) secJapri.style.display = 'block';
      if (secGroup) secGroup.style.display = 'none';
    });

    document.getElementById('btn-copy-grup-wa')?.addEventListener('click', () => {
      const text = document.getElementById('bc-text-grup')?.value;
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text);
        toast('Pesan pengumuman grup WA berhasil disalin!', 'success');
      } else {
        toast('Salin manual dari kotak teks di atas.', 'info');
      }
    });

    document.querySelectorAll('.btn-bc-japri').forEach(btn => {
      btn.addEventListener('click', () => {
        const phone = btn.dataset.phone;
        const msg = btn.dataset.msg;
        window.open(formatWaLink(phone, msg), '_blank');
        btn.textContent = 'Terkirim';
        btn.style.background = '#64748B';
        btn.style.borderColor = '#64748B';
      });
    });
  };

  setupEvents(selectedKelas);
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
          return `<div class="month-pill ${cls}">${BULAN[p.bulan-1]} '${String(p.tahun).slice(2)}<span class="chk">${total>=nominal?'Lunas':total>0?fmtRupiah(total):'—'}</span></div>`;
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
