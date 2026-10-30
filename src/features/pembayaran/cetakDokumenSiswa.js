import { store } from '../../app/state.js';
import { BULAN, getPeriode, siswaTotalBulan, getActiveTahunMulai } from '../../utils/helpers.js';
import { fmtDate, fmtRupiah, escapeHtml } from '../../utils/formatters.js';
import { LOGO_BASE64 } from '../../utils/constants.js';
import { openModal } from '../../components/Modal.js';
import { parseLocalDate } from '../absensi/absensiService.js';

export function cetakSuratBebasAdministrasi(siswa) {
  const s = store.state.settings;
  const now = new Date();
  const tglStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const noSurat = `421.2/SKB-${String(siswa.nis || '001')}/${now.getFullYear()}`;
  
  const ttl = (siswa.tempatLahir || siswa.tanggalLahir) 
    ? `${siswa.tempatLahir || '-'}${siswa.tanggalLahir ? ', ' + fmtDate(siswa.tanggalLahir) : ''}`
    : '-';

  const area = document.getElementById('kwitansi-print-area');
  area.innerHTML = `
    <div class="print-surat-bebas" style="max-width:680px; margin:0 auto; padding:32px 36px; background:#fff; color:#0f172a; font-family:'Inter', Arial, sans-serif; font-size:13.5px; line-height:1.6; border:1px solid #e2e8f0;">
      <!-- Kop Surat Resmi -->
      <div style="display:flex; align-items:center; gap:16px; border-bottom:3px double #0f172a; padding-bottom:14px; margin-bottom:20px;">
        <img src="${LOGO_BASE64}" alt="Logo" style="width:68px; height:68px; object-fit:contain;" />
        <div style="text-align:center; flex:1;">
          <div style="font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#475569;">YAYASAN PENDIDIKAN ISLAM</div>
          <div style="font-size:20px; font-weight:800; letter-spacing:0.04em; color:#0f172a; text-transform:uppercase;">${escapeHtml(s.namaSekolah || 'MADRASAH TSANAWIYAH YASTA BUNTER')}</div>
          <div style="font-size:12px; color:#475569; margin-top:2px;">Kecamatan Sukadana, Kabupaten Ciamis — Jawa Barat</div>
          <div style="font-size:11px; color:#64748b;">Tahun Pelajaran ${escapeHtml(s.tahunAjaran || '')}</div>
        </div>
      </div>

      <!-- Judul Surat -->
      <div style="text-align:center; margin-bottom:22px;">
        <div style="font-size:16px; font-weight:800; text-decoration:underline; text-transform:uppercase; letter-spacing:0.05em;">SURAT KETERANGAN BEBAS BIAYA ADMINISTRASI</div>
        <div style="font-size:12px; color:#475569; margin-top:3px;">Nomor: ${noSurat}</div>
      </div>

      <!-- Pernyataan -->
      <p style="margin-bottom:14px; text-align:justify;">
        Yang bertanda tangan di bawah ini, Bendahara / Kepala Sekolah <strong>${escapeHtml(s.namaSekolah)}</strong>, menerangkan dengan sebenarnya bahwa:
      </p>

      <div style="display:flex; gap:16px; align-items:flex-start; margin-bottom:16px;">
        <table style="flex:1; border-collapse:collapse; font-size:13px;">
          <tr>
            <td style="width:160px; padding:4px 0; font-weight:600;">Nama Siswa</td>
            <td style="width:12px; padding:4px 0;">:</td>
            <td style="padding:4px 0; font-weight:700; color:#0f172a;">${escapeHtml(siswa.nama)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0; font-weight:600;">Nomor Induk Siswa (NIS)</td>
            <td style="padding:4px 0;">:</td>
            <td style="padding:4px 0; font-family:monospace;">${escapeHtml(siswa.nis || '-')}</td>
          </tr>
          <tr>
            <td style="padding:4px 0; font-weight:600;">NISN</td>
            <td style="padding:4px 0;">:</td>
            <td style="padding:4px 0; font-family:monospace;">${escapeHtml(siswa.nisn || '-')}</td>
          </tr>
          <tr>
            <td style="padding:4px 0; font-weight:600;">Kelas</td>
            <td style="padding:4px 0;">:</td>
            <td style="padding:4px 0;">${escapeHtml(siswa.kelas)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0; font-weight:600;">Tempat, Tgl Lahir</td>
            <td style="padding:4px 0;">:</td>
            <td style="padding:4px 0;">${escapeHtml(ttl)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0; font-weight:600;">Nama Orang Tua / Wali</td>
            <td style="padding:4px 0;">:</td>
            <td style="padding:4px 0;">${escapeHtml(siswa.namaWali || '-')}</td>
          </tr>
          <tr>
            <td style="padding:4px 0; font-weight:600;">Alamat</td>
            <td style="padding:4px 0;">:</td>
            <td style="padding:4px 0;">${escapeHtml(siswa.alamat || '-')}</td>
          </tr>
        </table>
        <div style="flex-shrink:0; width:80px; height:105px; border:1px solid #cbd5e1; border-radius:4px; padding:2px; display:flex; align-items:center; justify-content:center; background:#f8fafc;">
          ${siswa.foto 
            ? `<img src="${escapeAttr(siswa.foto)}" alt="Foto" style="width:100%; height:100%; object-fit:cover; border-radius:2px;">` 
            : `<div style="font-size:10px; color:#94a3b8; text-align:center;">Pasfoto<br>3 x 4</div>`
          }
        </div>
      </div>

      <!-- Status Pelunasan -->
      <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:12px 16px; margin-bottom:18px;">
        <div style="display:flex; align-items:center; gap:8px; font-weight:700; color:#166534; font-size:13.5px; margin-bottom:4px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;"><polyline points="20 6 9 17 4 12"/></svg>
          DINYATAKAN LUNAS DAN BEBAS DARI SELURUH TUNGGAKAN KEUANGAN
        </div>
        <div style="font-size:12.5px; color:#15803d; line-height:1.5;">
          Siswa tersebut di atas telah menyelesaikan seluruh kewajiban administrasi <strong>SPP (12 Bulan Penuh)</strong> dan <strong>Administrasi Ijazah/Kelulusan</strong> untuk Tahun Pelajaran <strong>${escapeHtml(s.tahunAjaran)}</strong>.
        </div>
      </div>

      <p style="margin-bottom:28px; text-align:justify;">
        Demikian Surat Keterangan Bebas Administrasi ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagai syarat pengambilan Ijazah, Rapor, maupun keperluan administrasi lainnya.
      </p>

      <!-- Tanda Tangan -->
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:24px;">
        <div style="text-align:center; width:200px;">
          <div style="font-size:12.5px;">Mengetahui,</div>
          <div style="font-size:12.5px; margin-bottom:54px;">Orang Tua / Wali Siswa</div>
          <div style="font-weight:700; border-bottom:1px solid #0f172a; padding-bottom:2px;">${escapeHtml(siswa.namaWali || '( ................................. )')}</div>
        </div>
        <div style="text-align:center; width:220px;">
          <div style="font-size:12.5px;">Bunter, ${tglStr}</div>
          <div style="font-size:12.5px; margin-bottom:54px;">Bendahara Sekolah,</div>
          <div style="font-weight:700; border-bottom:1px solid #0f172a; padding-bottom:2px;">${escapeHtml(s.bendahara || 'Bendahara Madrasah')}</div>
          <div style="font-size:11px; color:#64748b; margin-top:3px;">NIP / ID: ${escapeHtml(s.noHpBendahara || '-')}</div>
        </div>
      </div>
    </div>
  `;

  openModal(`
    <div class="modal-head">
      <h3>Surat Keterangan Bebas Administrasi</h3>
      <button class="close-x" id="modal-close">&times;</button>
    </div>
    <div class="modal-body" style="background:var(--paper-dim); padding:16px; overflow-x:auto;">
      <div style="background:#fff; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.08); overflow:hidden;">
        ${area.innerHTML}
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="modal-cancel">Tutup</button>
      <button class="btn btn-primary" id="btn-print-surat-bebas" style="display:inline-flex; align-items:center; gap:6px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Cetak Surat (Print / PDF)
      </button>
    </div>
  `);

  document.getElementById('btn-print-surat-bebas')?.addEventListener('click', () => {
    window.print();
  });
}

export function cetakKartuSppTahunan(siswa, targetTahunMulai) {
  const s = store.state.settings;
  const nominal = s.nominalSPP;
  const periode = getPeriode();
  const activeTaStart = targetTahunMulai || getActiveTahunMulai();
  const allPayments = store.state.pembayaran.filter(p => p.siswaId === siswa.id && (!p.jenis || p.jenis === 'spp'));
  const now = new Date();
  const tglStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  let totalKewajiban = 0;
  let totalTerbayar = 0;

  const rowHtml = periode.map((p, idx) => {
    totalKewajiban += nominal;
    const paid = siswaTotalBulan(siswa.id, p.bulan, p.tahun);
    totalTerbayar += paid;
    const isLunas = paid >= nominal;
    const payRec = allPayments.find(pay => pay.bulan === p.bulan && pay.tahun === p.tahun);
    const tglBayar = payRec ? parseLocalDate(payRec.tanggal).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '-';
    const noKwit = payRec?.noKwitansi || '-';

    return `
      <tr style="border-bottom:1px solid #e2e8f0; ${idx % 2 === 1 ? 'background:#f8fafc;' : ''}">
        <td style="padding:6px 8px; text-align:center;">${idx + 1}</td>
        <td style="padding:6px 8px; font-weight:600;">${BULAN[p.bulan-1]} ${p.tahun}</td>
        <td style="padding:6px 8px; text-align:right;">${fmtRupiah(nominal)}</td>
        <td style="padding:6px 8px; text-align:right; font-weight:700; color:${paid > 0 ? '#059669' : '#64748b'};">${paid > 0 ? fmtRupiah(paid) : '-'}</td>
        <td style="padding:6px 8px; text-align:center; font-size:11.5px;">${tglBayar}</td>
        <td style="padding:6px 8px; text-align:center; font-family:monospace; font-size:11px;">${noKwit}</td>
        <td style="padding:6px 8px; text-align:center;">
          <span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; ${isLunas ? 'background:#dcfce7; color:#166534;' : paid > 0 ? 'background:#fef3c7; color:#92400e;' : 'background:#fee2e2; color:#991b1b;'}">
            ${isLunas ? 'LUNAS' : paid > 0 ? 'SEBAGIAN' : 'BELUM'}
          </span>
        </td>
        <td style="padding:6px 8px; text-align:center; color:#64748b; font-size:11px;">
          ${isLunas ? 'Sah' : '—'}
        </td>
      </tr>
    `;
  }).join('');

  const sisaTunggakan = Math.max(0, totalKewajiban - totalTerbayar);

  const area = document.getElementById('kwitansi-print-area');
  area.innerHTML = `
    <div class="print-kartu-spp" style="max-width:720px; margin:0 auto; padding:28px 32px; background:#fff; color:#0f172a; font-family:'Inter', Arial, sans-serif; font-size:12.5px; line-height:1.5; border:1px solid #e2e8f0;">
      <!-- Kop Surat Resmi -->
      <div style="display:flex; align-items:center; gap:16px; border-bottom:3px double #0f172a; padding-bottom:12px; margin-bottom:16px;">
        <img src="${LOGO_BASE64}" alt="Logo" style="width:60px; height:60px; object-fit:contain;" />
        <div style="text-align:center; flex:1;">
          <div style="font-size:10.5px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:#475569;">KARTU KONTROL PEMBAYARAN SPP</div>
          <div style="font-size:18px; font-weight:800; letter-spacing:0.03em; color:#0f172a; text-transform:uppercase;">${escapeHtml(s.namaSekolah || 'MADRASAH TSANAWIYAH YASTA BUNTER')}</div>
          <div style="font-size:11.5px; color:#475569;">Tahun Pelajaran ${activeTaStart}/${activeTaStart+1}</div>
        </div>
      </div>

      <!-- Info Siswa -->
      <div style="display:flex; align-items:center; gap:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:12px;">
        <div style="flex-shrink:0; width:52px; height:68px; border:1px solid #cbd5e1; border-radius:4px; padding:2px; display:flex; align-items:center; justify-content:center; background:#fff;">
          ${siswa.foto 
            ? `<img src="${escapeAttr(siswa.foto)}" alt="Foto" style="width:100%; height:100%; object-fit:cover; border-radius:2px;">` 
            : `<div style="font-size:9.5px; color:#94a3b8; text-align:center;">Foto<br>3 x 4</div>`
          }
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; flex:1;">
          <div>
            <div>Nama Siswa: <strong style="font-size:13px; color:#0f172a;">${escapeHtml(siswa.nama)}</strong></div>
            <div style="margin-top:2px;">Kelas: <strong>${escapeHtml(siswa.kelas)}</strong></div>
            <div style="margin-top:2px;">Nama Orang Tua/Wali: <strong>${escapeHtml(siswa.namaWali || '-')}</strong></div>
          </div>
          <div>
            <div>NIS: <strong class="monospace">${escapeHtml(siswa.nis || '-')}</strong></div>
            <div style="margin-top:2px;">NISN: <strong class="monospace">${escapeHtml(siswa.nisn || '-')}</strong></div>
            <div style="margin-top:2px;">Ketetapan SPP: <strong>${fmtRupiah(nominal)} / bulan</strong></div>
          </div>
        </div>
      </div>

      <!-- Tabel 12 Bulan -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:12px; border:1px solid #cbd5e1;">
        <thead>
          <tr style="background:#0f172a; color:#ffffff;">
            <th style="padding:6px 8px; text-align:center; width:36px;">No</th>
            <th style="padding:6px 8px; text-align:left;">Bulan</th>
            <th style="padding:6px 8px; text-align:right;">Kewajiban</th>
            <th style="padding:6px 8px; text-align:right;">Terbayar</th>
            <th style="padding:6px 8px; text-align:center;">Tgl Bayar</th>
            <th style="padding:6px 8px; text-align:center;">No. Kwitansi</th>
            <th style="padding:6px 8px; text-align:center;">Status</th>
            <th style="padding:6px 8px; text-align:center; width:60px;">Paraf</th>
          </tr>
        </thead>
        <tbody>
          ${rowHtml}
        </tbody>
        <tfoot>
          <tr style="background:#f1f5f9; font-weight:700; border-top:2px solid #cbd5e1;">
            <td colspan="2" style="padding:8px; text-align:right;">TOTAL:</td>
            <td style="padding:8px; text-align:right;">${fmtRupiah(totalKewajiban)}</td>
            <td style="padding:8px; text-align:right; color:#059669;">${fmtRupiah(totalTerbayar)}</td>
            <td colspan="4" style="padding:8px; text-align:right;">
              Sisa Tunggakan: <strong style="color:${sisaTunggakan > 0 ? '#dc2626' : '#059669'}; font-size:13px;">${sisaTunggakan > 0 ? fmtRupiah(sisaTunggakan) : 'LUNAS (Rp 0)'}</strong>
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- Tanda Tangan -->
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:20px; font-size:12px;">
        <div style="text-align:center; width:180px;">
          <div>Orang Tua / Wali Siswa,</div>
          <div style="height:48px;"></div>
          <div style="font-weight:700; border-bottom:1px solid #0f172a;">${escapeHtml(siswa.namaWali || '( ................................. )')}</div>
        </div>
        <div style="text-align:center; width:200px;">
          <div>Bunter, ${tglStr}</div>
          <div>Bendahara Sekolah,</div>
          <div style="height:48px;"></div>
          <div style="font-weight:700; border-bottom:1px solid #0f172a;">${escapeHtml(s.bendahara || 'Bendahara Madrasah')}</div>
        </div>
      </div>
    </div>
  `;

  openModal(`
    <div class="modal-head">
      <h3>Kartu SPP Tahunan (Rekap 12 Bulan)</h3>
      <button class="close-x" id="modal-close">&times;</button>
    </div>
    <div class="modal-body" style="background:var(--paper-dim); padding:16px; overflow-x:auto;">
      <div style="background:#fff; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.08); overflow:hidden;">
        ${area.innerHTML}
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="modal-cancel">Tutup</button>
      <button class="btn btn-primary" id="btn-print-kartu-spp-tahunan" style="display:inline-flex; align-items:center; gap:6px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Cetak Kartu SPP (Print / PDF)
      </button>
    </div>
  `);

  document.getElementById('btn-print-kartu-spp-tahunan')?.addEventListener('click', () => {
    window.print();
  });
}

