import { store } from '../../app/state.js';
import { BULAN } from '../../utils/helpers.js';
import { fmtDate, fmtRupiah, escapeHtml, formatWaLink } from '../../utils/formatters.js';
import { LOGO_BASE64 } from '../../utils/constants.js';
import { openModal } from '../../components/Modal.js';

export function cetakKwitansi(siswa, months, nominal, noKwitansi, tanggal, jenis) {
  const s = store.state.settings;
  const itemText = jenis === 'spp' ? 'SPP Bulan ' + months.map(m => `${BULAN[m.bulan-1]} ${m.tahun}`).join(', ') : 'Pembayaran Ijazah';
  
  const area = document.getElementById('kwitansi-print-area');
  area.innerHTML = `
    <div class="receipt">
      <div class="receipt-head">
        <img src="${LOGO_BASE64}" class="seal" alt="Logo">
        <div class="sekolah">${escapeHtml(s.namaSekolah)}</div>
        <div class="ta">Tahun Ajaran ${escapeHtml(s.tahunAjaran)}</div>
      </div>
      <div class="receipt-title">${jenis === 'spp' ? 'KUITANSI PEMBAYARAN SPP' : 'KUITANSI PEMBAYARAN IJAZAH'}</div>
      <div class="receipt-row"><span class="k">No. Kuitansi</span><span class="v">${noKwitansi}</span></div>
      <div class="receipt-row"><span class="k">Tanggal</span><span class="v">${fmtDate(tanggal)}</span></div>
      <div class="receipt-row"><span class="k">Nama Siswa</span><span class="v">${escapeHtml(siswa.nama)}</span></div>
      <div class="receipt-row"><span class="k">Kelas</span><span class="v">${escapeHtml(siswa.kelas)}</span></div>
      <div class="receipt-row"><span class="k">NIS</span><span class="v">${escapeHtml(siswa.nis||'-')}</span></div>
      <div class="receipt-row"><span class="k">Pembayaran</span><span class="v">${itemText}</span></div>
      <div class="receipt-amt">
        <div class="lbl">Jumlah Dibayar</div>
        <div class="amt">${fmtRupiah(nominal)}</div>
      </div>
      <div class="receipt-sign">
        <div>Diterima oleh,</div>
        <div class="line">${escapeHtml(s.bendahara || 'Bendahara Sekolah')}</div>
      </div>
      <div class="receipt-foot">Kuitansi digital ini merupakan bukti pembayaran yang sah untuk keperluan arsip.</div>
    </div>
  `;
  openKwitansiModal(noKwitansi, siswa, itemText, nominal, tanggal, jenis);
}

function openKwitansiModal(noKwitansi, siswa, itemText, nominal, tanggal, jenis) {
  const hasWa = !!siswa.noHp;
  openModal(`
    <div class="modal-head"><h3>Kuitansi ${noKwitansi}</h3><button class="close-x" id="modal-close">&times;</button></div>
    <div class="modal-body" id="kwitansi-preview-slot" style="background:var(--paper-dim); padding:24px 8px;"></div>
    <div class="modal-foot" style="flex-wrap:wrap;">
      <button class="btn" id="modal-cancel">Tutup</button>
      <div style="flex:1"></div>
      ${hasWa ? `<button class="btn" id="btn-wa-kwitansi" style="background:#25D366; color:white; border-color:#25D366;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Kirim via WA</button>` : ''}
      <button class="btn btn-primary" id="btn-cetak-kwitansi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18h12v4H6v-4zM4 9h16v7H4z"/></svg> Cetak / PDF</button>
    </div>
    <div style="padding:0 20px 14px; text-align:right; font-size:11.5px; color:var(--ink-soft);">Tips: Pastikan setelan Margin adalah "None" saat mencetak.</div>
  `, 'wide');
  document.getElementById('kwitansi-preview-slot').innerHTML = document.getElementById('kwitansi-print-area').innerHTML;
  document.getElementById('btn-cetak-kwitansi').addEventListener('click', ()=>{ window.print(); });
  
  if(hasWa){
    document.getElementById('btn-wa-kwitansi').addEventListener('click', ()=>{
      const teks = `*KUITANSI PEMBAYARAN ${jenis==='spp'?'SPP':'IJAZAH'}*
*${store.state.settings.namaSekolah.toUpperCase()}*
------------------------------------------------------

Kepada Yth. Bapak/Ibu Wali Murid dari *${siswa.nama}*,

Dengan hormat,
Melalui pesan ini kami menginformasikan bahwa kami telah menerima pembayaran ${jenis==='spp'?'SPP':'Ijazah'} dengan rincian sebagai berikut:

📋 *Data Siswa*
Nama  : ${siswa.nama}
Kelas : ${siswa.kelas}
NIS   : ${siswa.nis || '-'}

📝 *Rincian Pembayaran*
No. Kuitansi : ${noKwitansi}
Tanggal      : ${fmtDate(tanggal)}
Pembayaran   : ${itemText}
Total Bayar  : *${fmtRupiah(nominal)}*

------------------------------------------------------
Kuitansi digital ini diterbitkan secara otomatis oleh sistem dan merupakan bukti pembayaran yang sah. Mohon simpan pesan ini sebagai referensi.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,
*Bendahara ${store.state.settings.namaSekolah}*`;
      
      const url = formatWaLink(siswa.noHp, teks);
      window.open(url, '_blank');
    });
  }
}
