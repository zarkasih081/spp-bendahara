import { store } from '../state/store.js';
import { triggerRender } from '../utils/events.js';
import { escapeHtml, toast } from '../utils/helpers.js';

export function renderLogin() {
  const loginPage = document.getElementById('page-login');
  loginPage.innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <h2 style="text-align:center; margin-bottom: 24px;">Login SPP Bendahara</h2>
        
        <div class="login-tabs">
          <button class="login-tab active" data-role="bendahara">Bendahara</button>
          <button class="login-tab" data-role="siswa">Siswa</button>
        </div>

        <form id="form-login-bendahara" class="login-form active">
          <div class="form-group">
            <label>Password Bendahara</label>
            <input type="password" id="login-admin-pass" placeholder="Password (default: admin)" style="width:100%;">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Masuk sebagai Bendahara</button>
        </form>

        <form id="form-login-siswa" class="login-form">
          <div class="form-group">
            <label>NIS (Nomor Induk Siswa)</label>
            <input type="text" id="login-siswa-nis" placeholder="Masukkan NIS Anda" style="width:100%;">
          </div>
          <div class="form-group">
            <label>PIN</label>
            <input type="password" id="login-siswa-pin" placeholder="Masukkan PIN (default: sama dengan NIS)" style="width:100%;">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Masuk sebagai Siswa</button>
        </form>
      </div>
    </div>
  `;

  const tabs = loginPage.querySelectorAll('.login-tab');
  const forms = loginPage.querySelectorAll('.login-form');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      forms.forEach(f => f.classList.remove('active'));
      
      e.target.classList.add('active');
      const role = e.target.dataset.role;
      loginPage.querySelector(`#form-login-${role}`).classList.add('active');
    });
  });

  const formAdmin = document.getElementById('form-login-bendahara');
  formAdmin.addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = document.getElementById('login-admin-pass').value;
    if(pass === store.state.settings.adminPassword) {
      store.ui.currentUser = { role: 'bendahara' };
      store.ui.page = 'dashboard';
      triggerRender();
      toast('Login berhasil sebagai Bendahara', 'success');
    } else {
      toast('Password bendahara salah!', 'error');
    }
  });

  const formSiswa = document.getElementById('form-login-siswa');
  formSiswa.addEventListener('submit', (e) => {
    e.preventDefault();
    const nis = document.getElementById('login-siswa-nis').value.trim();
    const pin = document.getElementById('login-siswa-pin').value.trim();
    
    if(!nis) {
      toast('NIS tidak boleh kosong', 'error');
      return;
    }

    const siswa = store.state.siswa.find(s => s.nis === nis);
    if(!siswa) {
      toast('NIS tidak terdaftar', 'error');
      return;
    }

    // Default PIN is NIS if not explicitly set
    const correctPin = siswa.pin || siswa.nis;
    if(pin === correctPin) {
      store.ui.currentUser = { role: 'siswa', id: siswa.id, nama: siswa.nama };
      store.ui.page = 'dashboard';
      triggerRender();
      toast('Login berhasil sebagai Siswa', 'success');
    } else {
      toast('PIN salah!', 'error');
    }
  });
}
