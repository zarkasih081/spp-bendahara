import { store, saveAuth, hashPassword } from '../state/store.js';
import { triggerRender } from '../utils/events.js';
import { escapeHtml, toast } from '../utils/helpers.js';
import { LOGO_BASE64 } from '../utils/constants.js';
import { openModal } from '../components/Modal.js';

export function renderLogin() {
  const loginPage = document.getElementById('page-login');
  
  const hour = new Date().getHours();
  let greeting = "Selamat Datang";
  if (hour < 11) greeting = "Selamat Pagi, Semangat Belajar!";
  else if (hour < 15) greeting = "Selamat Siang, Siswa Hebat!";
  else if (hour < 18) greeting = "Selamat Sore, Waktunya Bersantai!";
  else greeting = "Selamat Malam, Jangan Lupa Istirahat!";

  loginPage.innerHTML = `
    <button class="theme-toggle" id="theme-toggle" title="Toggle Dark Mode">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    </button>
    <div class="login-container">
      <div class="login-left">
        <div class="login-left-pattern"></div>
        <h1>SPPKu</h1>
        <p>Aplikasi pencatatan pembayaran SPP dan Ijazah sekolah yang modern, cepat, dan transparan.</p>
        <div class="login-quote-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="quote-icon"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path></svg>
          <p id="login-quote" class="quote-text"></p>
          <div style="margin-top:32px;">
            <button id="btn-install" style="display:none; background: rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.4); color:#fff; padding:10px 20px; border-radius:30px; cursor:pointer; font-weight:500; align-items:center; gap:8px; backdrop-filter:blur(5px); transition:0.3s;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Install Aplikasi
            </button>
          </div>
        </div>
      </div>
      <div class="login-right">
        <div class="login-card">
          <div class="login-logo" id="secret-trigger" style="background: transparent; box-shadow: none; width: auto; height: auto; cursor: default; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; user-select: none; outline: none;">
            <img src="${LOGO_BASE64}" alt="Logo Sekolah" draggable="false" style="width: 80px; height: 80px; object-fit: contain; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15)); margin-bottom: -10px; pointer-events: none; user-select: none; -webkit-user-drag: none; -webkit-touch-callout: none;">
          </div>
          <h2 id="dynamic-greeting">${greeting}</h2>
          <p class="subtitle">Silakan masuk untuk melihat rincian pembayaran</p>
          
          <form id="form-login-bendahara" class="login-form">
            <div class="form-group form-floating">
              <input type="text" id="login-admin-user" placeholder=" " required>
              <label for="login-admin-user">Username Bendahara</label>
            </div>
            <div class="form-group form-floating">
              <div class="password-wrapper">
                <input type="password" id="login-admin-pass" placeholder=" " required>
                <label for="login-admin-pass">Password Bendahara</label>
                <button type="button" class="password-toggle" tabindex="-1" title="Tampilkan/Sembunyikan">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              </div>
            </div>
            
            <div class="login-options" style="display:flex; justify-content:space-between; align-items:center;">
              <label><input type="checkbox" id="remember-admin"> Ingat saya</label>
            </div>

            <button type="submit" class="login-btn" id="btn-login-bendahara">
              <span>Masuk Bendahara</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </form>

          <form id="form-login-siswa" class="login-form active">
            <div class="form-group form-floating">
              <input type="text" id="login-siswa-nis" placeholder=" " required>
              <label for="login-siswa-nis">NIS (Nomor Induk Siswa)</label>
            </div>
            <div class="form-group form-floating">
              <div class="password-wrapper">
                <input type="password" id="login-siswa-pin" placeholder=" " required>
                <label for="login-siswa-pin">PIN / Kata Sandi Siswa</label>
                <button type="button" class="password-toggle" tabindex="-1" title="Tampilkan/Sembunyikan">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              </div>
            </div>

            <div class="login-options" style="display:flex; justify-content:space-between; align-items:center;">
              <label><input type="checkbox" id="remember-siswa"> Ingat saya</label>
              <a href="#" id="lupa-pin" style="color:var(--green); font-size:14px; text-decoration:none;">Lupa PIN?</a>
            </div>

            <button type="submit" class="login-btn" id="btn-login-siswa">
              <span>Masuk Siswa</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Quotes Logic
  const quotes = [
    "\"Pendidikan adalah senjata paling ampuh yang bisa digunakan untuk mengubah dunia.\" — Nelson Mandela",
    "\"Kejujuran dan transparansi adalah fondasi dari setiap institusi pendidikan yang hebat.\"",
    "\"Investasi dalam pengetahuan selalu membayar bunga terbaik.\" — Benjamin Franklin",
    "\"Masa depan adalah milik mereka yang menyiapkan hari ini.\"",
    "\"Kelola keuangan dengan bijak, untuk pendidikan yang lebih layak.\""
  ];
  const quoteEl = document.getElementById('login-quote');
  if(quoteEl) quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];

  // Auto-focus on load
  setTimeout(() => {
    const siswaNis = document.getElementById('login-siswa-nis');
    if(siswaNis) siswaNis.focus();
  }, 100);

  // Theme Toggle Logic
  const themeToggle = document.getElementById('theme-toggle');
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
  }
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
    }
  });

  // Show/Hide Password Logic
  const pwToggles = loginPage.querySelectorAll('.password-toggle');
  pwToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      // The input is two siblings before the toggle button (input -> label -> button)
      let input = toggle.previousElementSibling;
      if (input && input.tagName.toLowerCase() === 'label') {
        input = input.previousElementSibling;
      }
      
      if (input && input.type === 'password') {
        input.type = 'text';
        toggle.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
      } else if (input) {
        input.type = 'password';
        toggle.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
      }
    });
  });

  // Secret Door Logic (3 clicks)
  let clickCount = 0;
  let clickTimer;
  const secretTrigger = document.getElementById('secret-trigger');
  const forms = loginPage.querySelectorAll('.login-form');
  
  secretTrigger.addEventListener('click', () => {
    clickCount++;
    clearTimeout(clickTimer);
    
    if (clickCount >= 3) {
      clickCount = 0;
      const bendaharaForm = document.getElementById('form-login-bendahara');
      const siswaForm = document.getElementById('form-login-siswa');
      
      if (bendaharaForm.classList.contains('active')) {
        bendaharaForm.classList.remove('active');
        siswaForm.classList.add('active');
        document.getElementById('dynamic-greeting').textContent = greeting;
        document.getElementById('login-siswa-nis').focus();
      } else {
        siswaForm.classList.remove('active');
        bendaharaForm.classList.add('active');
        document.getElementById('dynamic-greeting').textContent = "Selamat Datang Bendahara";
        document.getElementById('login-admin-user').focus();
        toast('Portal Admin Terbuka', 'success');
      }
    }
    
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 1000);
  });

  const handleLoginSubmit = (e, role) => {
    e.preventDefault();
    const btn = document.getElementById(`btn-login-${role}`);
    const originalContent = btn.innerHTML;
    
    // Simulate Loading
    btn.innerHTML = '<div class="spinner"></div>';
    btn.disabled = true;

    setTimeout(async () => {
      btn.innerHTML = originalContent;
      btn.disabled = false;
      
      if (role === 'bendahara') {
        const user = document.getElementById('login-admin-user').value.trim();
        const pass = document.getElementById('login-admin-pass').value;
        const remember = document.getElementById('remember-admin').checked;
        const hashedPass = await hashPassword(pass);
        if(user === 'admin' && hashedPass === store.state.settings.adminPassword) {
          store.ui.currentUser = { role: 'bendahara' };
          if(remember) saveAuth(store.ui.currentUser);
          store.ui.page = 'dashboard';
          triggerRender();
          toast('Login berhasil sebagai Bendahara', 'success');
        } else {
          toast('Username atau Password salah!', 'error');
        }
      } else {
        const nis = document.getElementById('login-siswa-nis').value.trim();
        const pin = document.getElementById('login-siswa-pin').value.trim();
        const pinContainer = document.getElementById('pin-otp-container');
        
        if(!nis) {
          toast('NIS tidak boleh kosong', 'error');
          return;
        }
        if(!pin) {
          toast('PIN tidak boleh kosong', 'error');
          const pinInput = document.getElementById('login-siswa-pin');
          if(pinInput) {
            pinInput.classList.add('shake');
            setTimeout(() => pinInput.classList.remove('shake'), 400);
          }
          return;
        }

        const siswa = store.state.siswa.find(s => s.nis === nis);
        if(!siswa) {
          toast('NIS tidak terdaftar', 'error');
          const nisInput = document.getElementById('login-siswa-nis');
          if(nisInput) {
            nisInput.classList.add('shake');
            setTimeout(() => nisInput.classList.remove('shake'), 400);
          }
          return;
        }

        const correctPin = siswa.pin || siswa.nis;
        const remember = document.getElementById('remember-siswa').checked;
        if(pin === correctPin) {
          store.ui.currentUser = { role: 'siswa', id: siswa.id, nama: siswa.nama };
          if(remember) saveAuth(store.ui.currentUser);
          store.ui.page = 'dashboard';
          triggerRender();
          toast('Login berhasil sebagai Siswa', 'success');
        } else {
          toast('PIN salah!', 'error');
          const pinInput = document.getElementById('login-siswa-pin');
          if(pinInput) {
            pinInput.classList.add('shake');
            setTimeout(() => pinInput.classList.remove('shake'), 400);
          }
        }
      }
    }, 600); // 600ms loading simulation
  };

  // Removed OTP Logic as it's no longer used

  const formAdmin = document.getElementById('form-login-bendahara');
  formAdmin.addEventListener('submit', (e) => handleLoginSubmit(e, 'bendahara'));

  const formSiswa = document.getElementById('form-login-siswa');
  formSiswa.addEventListener('submit', (e) => handleLoginSubmit(e, 'siswa'));

  // Lupa PIN
  const lupaPin = document.getElementById('lupa-pin');
  if(lupaPin) {
    lupaPin.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(`
        <div class="modal-head"><h3>Lupa PIN?</h3><button class="close-x" id="modal-close">&times;</button></div>
        <div class="modal-body">
          <p style="margin:0; font-size:14px; line-height:1.6; color:var(--ink);">Silakan hubungi Bendahara ${store.state.settings.namaSekolah} untuk melakukan reset PIN Anda.</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-primary" id="modal-cancel" style="width:100%;">Tutup</button>
        </div>
      `);
    });
  }

  // Install PWA
  const btnInstall = document.getElementById('btn-install');
  if(btnInstall && window.deferredPrompt) {
    btnInstall.style.display = 'inline-flex';
  }
  if(btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        const { outcome } = await window.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          btnInstall.style.display = 'none';
        }
        window.deferredPrompt = null;
      }
    });
  }
}
