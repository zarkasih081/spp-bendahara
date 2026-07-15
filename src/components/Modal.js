import { escapeHtml } from '../utils/helpers.js';

export function openModal(html, size){
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.className = 'modal' + (size==='wide' ? ' wide' : '');
  box.innerHTML = html;
  
  // Animate in
  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
  
  const closeBtn = document.getElementById('modal-close');
  const cancelBtn = document.getElementById('modal-cancel');
  if(closeBtn) closeBtn.addEventListener('click', closeModal);
  if(cancelBtn) cancelBtn.addEventListener('click', closeModal);
}

export function closeModal(){ 
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('active');
  // Wait for animation to finish before hiding
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 250);
}

export function setupModalEvents() {
  const overlay = document.getElementById('modal-overlay');
  overlay.addEventListener('click', e=>{ 
    if(e.target.id==='modal-overlay') closeModal(); 
  });
  // Close on Escape key
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && overlay.classList.contains('active')) {
      closeModal();
    }
  });
}

export function openConfirm(msg, onConfirm){
  openModal(`
    <div class="modal-head"><h3>Konfirmasi</h3><button class="close-x" id="modal-close">&times;</button></div>
    <div class="modal-body"><p style="margin:0; font-size:13.5px; line-height:1.6;">${escapeHtml(msg)}</p></div>
    <div class="modal-foot"><button class="btn" id="modal-cancel">Batal</button><button class="btn btn-danger" id="modal-confirm">Ya, Lanjutkan</button></div>
  `);
  document.getElementById('modal-confirm').addEventListener('click', ()=>{ closeModal(); onConfirm(); });
}
