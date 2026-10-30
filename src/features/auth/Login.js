import { store } from '../../app/state.js';
import { saveAuth, hashPassword } from '../../data/authStorage.js';
import { triggerRender } from '../../utils/events.js';
import { toast, getSchoolLogo } from '../../utils/helpers.js';
import { escapeHtml, formatWaLink } from '../../utils/formatters.js';
import { openModal } from '../../components/Modal.js';

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
        <h1>EduPass</h1>
        <p>Portal pintar presensi kartu QR dan administrasi keuangan sekolah yang modern, cepat, dan transparan.</p>
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
            <img src="${getSchoolLogo()}" alt="Logo Sekolah" draggable="false" style="width: 80px; height: 80px; object-fit: contain; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15)); margin-bottom: -10px; pointer-events: none; user-select: none; -webkit-user-drag: none; -webkit-touch-callout: none;">
          </div>
          <div class="login-role-switcher" style="display:flex; background:var(--paper-dim); border:1px solid var(--line); border-radius:12px; padding:4px; margin-bottom:20px; gap:4px;">
            <button type="button" class="login-role-tab active" id="tab-login-siswa" style="flex:1; border:none; padding:8px 12px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; background:var(--primary); color:#fff; transition:all 0.2s;">
              Siswa
            </button>
            <button type="button" class="login-role-tab" id="tab-login-bendahara" style="flex:1; border:none; padding:8px 12px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; background:transparent; color:var(--ink-soft); transition:all 0.2s;">
              Bendahara
            </button>
          </div>

          <h2 id="dynamic-greeting">${greeting}</h2>
          <p class="subtitle" id="dynamic-subtitle">Silakan masuk untuk melihat presensi dan tagihan SPP</p>
          
          <form id="form-login-bendahara" class="login-form">
            <div class="form-group form-floating">
              <input type="text" id="login-admin-user" placeholder=" " autocomplete="username" required>
              <label for="login-admin-user">Username Bendahara</label>
            </div>
            <div class="form-group form-floating">
              <div class="password-wrapper">
                <input type="password" id="login-admin-pass" placeholder=" " autocomplete="current-password" required>
                <label for="login-admin-pass">Password Bendahara</label>
                <button type="button" class="password-toggle" tabindex="-1" title="Tampilkan/Sembunyikan">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              </div>
            </div>
            
            <div class="login-options">
              <label><input type="checkbox" id="remember-admin" checked> Ingat saya di perangkat ini</label>
            </div>

            <button type="submit" class="login-btn" id="btn-login-bendahara">
              <span>Masuk Bendahara</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </form>

          <form id="form-login-siswa" class="login-form active">
            <div class="form-group form-floating">
              <input type="text" id="login-siswa-nis" autocomplete="username" placeholder=" " required>
              <label for="login-siswa-nis">NIS / NISN Siswa</label>
            </div>
            <div class="form-group form-floating">
              <div class="password-wrapper">
                <input type="password" id="login-siswa-pin" inputmode="numeric" autocomplete="current-password" placeholder=" " required>
                <label for="login-siswa-pin">PIN / Kata Sandi Siswa</label>
                <button type="button" class="password-toggle" tabindex="-1" title="Tampilkan/Sembunyikan">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              </div>
            </div>

            <div class="login-options">
              <label><input type="checkbox" id="remember-siswa" checked> Ingat saya di perangkat ini</label>
              <a href="#" id="lupa-pin">Lupa PIN?</a>
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
  const sunSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
  const moonSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
  }
  themeToggle.innerHTML = document.body.classList.contains('dark-mode') ? sunSvg : moonSvg;
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.innerHTML = isDark ? sunSvg : moonSvg;
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

  // Role Switcher Tabs (Siswa / Bendahara)
  const tabSiswa = document.getElementById('tab-login-siswa');
  const tabBendahara = document.getElementById('tab-login-bendahara');
  const bendaharaForm = document.getElementById('form-login-bendahara');
  const siswaForm = document.getElementById('form-login-siswa');
  const greetingEl = document.getElementById('dynamic-greeting');
  const subtitleEl = document.getElementById('dynamic-subtitle');

  const switchRole = (targetRole) => {
    if (targetRole === 'bendahara') {
      tabBendahara.classList.add('active');
      tabBendahara.style.background = 'var(--primary)';
      tabBendahara.style.color = '#fff';
      tabSiswa.classList.remove('active');
      tabSiswa.style.background = 'transparent';
      tabSiswa.style.color = 'var(--ink-soft)';

      siswaForm.classList.remove('active');
      bendaharaForm.classList.add('active');
      greetingEl.textContent = "Masuk Bendahara";
      subtitleEl.textContent = "Akses modul keuangan, absensi & administrasi sekolah";
      document.getElementById('login-admin-user').focus();
    } else {
      tabSiswa.classList.add('active');
      tabSiswa.style.background = 'var(--primary)';
      tabSiswa.style.color = '#fff';
      tabBendahara.classList.remove('active');
      tabBendahara.style.background = 'transparent';
      tabBendahara.style.color = 'var(--ink-soft)';

      bendaharaForm.classList.remove('active');
      siswaForm.classList.add('active');
      greetingEl.textContent = greeting;
      subtitleEl.textContent = "Silakan masuk untuk melihat presensi dan tagihan SPP";
      document.getElementById('login-siswa-nis').focus();
    }
  };

  tabSiswa?.addEventListener('click', () => switchRole('siswa'));
  tabBendahara?.addEventListener('click', () => switchRole('bendahara'));

  // Secret Door Logic (also triggers switch to bendahara)
  let clickCount = 0;
  let clickTimer;
  const secretTrigger = document.getElementById('secret-trigger');
  
  secretTrigger?.addEventListener('click', () => {
    clickCount++;
    clearTimeout(clickTimer);
    
    if (clickCount >= 3) {
      clickCount = 0;
      if (bendaharaForm.classList.contains('active')) {
        switchRole('siswa');
      } else {
        switchRole('bendahara');
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
    
    // Simulate Loading (crisp 250ms)
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
          store.ui.currentUser = { role: 'bendahara', nama: 'Bendahara Sekolah' };
          saveAuth(store.ui.currentUser, remember);
          store.ui.page = 'dashboard';
          triggerRender();
          toast('Login berhasil sebagai Bendahara', 'success');
        } else {
          toast('Username atau Password salah!', 'error');
        }
      } else {
        const nis = document.getElementById('login-siswa-nis').value.trim();
        const pin = document.getElementById('login-siswa-pin').value.trim();
        const remember = document.getElementById('remember-siswa').checked;
        
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

        const siswa = store.state.siswa.find(s => 
          (s.nis && s.nis.trim() === nis) || 
          (s.nisn && s.nisn.trim() === nis) || 
          (s.rfidUid && s.rfidUid.trim() === nis)
        );
        if(!siswa) {
          toast('NIS / NISN tidak terdaftar di sistem', 'error');
          const nisInput = document.getElementById('login-siswa-nis');
          if(nisInput) {
            nisInput.classList.add('shake');
            setTimeout(() => nisInput.classList.remove('shake'), 400);
          }
          return;
        }

        const correctPin = siswa.pin || siswa.nis || siswa.nisn;
        if(pin === correctPin) {
          store.ui.currentUser = { role: 'siswa', id: siswa.id, nama: siswa.nama, nis: siswa.nis, kelas: siswa.kelas };
          saveAuth(store.ui.currentUser, remember);
          store.ui.page = 'dashboard';
          triggerRender();
          toast('Selamat datang, ' + siswa.nama, 'success');
        } else {
          toast('PIN salah!', 'error');
          const pinInput = document.getElementById('login-siswa-pin');
          if(pinInput) {
            pinInput.classList.add('shake');
            setTimeout(() => pinInput.classList.remove('shake'), 400);
          }
        }
      }
    }, 250);
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
      const noHp = store.state.settings.noHpBendahara;
      const waLink = noHp ? formatWaLink(noHp, `Halo Bendahara ${store.state.settings.namaSekolah}, saya siswa/orang tua ingin meminta bantuan reset PIN login portal SPP sekolah.`) : null;
      openModal(`
        <div class="modal-head"><h3>Lupa PIN Login?</h3><button class="close-x" id="modal-close">&times;</button></div>
        <div class="modal-body">
          <p style="margin:0 0 14px 0; font-size:14px; line-height:1.6; color:var(--ink);">
            PIN bawaan standar siswa adalah sama dengan <strong>Nomor Induk Siswa (NIS)</strong> Anda.
          </p>
          <div style="background:var(--paper-dim); border:1px solid var(--line); border-radius:8px; padding:10px 12px; font-size:12.5px; color:var(--ink-soft); line-height:1.5;">
            Jika Anda sudah mengubah PIN dan lupa kombinasi barunya, silakan hubungi Bendahara Sekolah untuk mereset kata sandi Anda.
          </div>
        </div>
        <div class="modal-foot" style="display:flex; gap:8px;">
          <button class="btn" id="modal-cancel" style="flex:1;">Tutup</button>
          ${waLink ? `
            <a href="${waLink}" target="_blank" class="btn btn-primary" style="flex:1.4; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:6px; background:#25D366; border-color:#25D366;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span>Hubungi Bendahara</span>
            </a>
          ` : ''}
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
