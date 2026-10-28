import { storage, AUTH_KEY } from './storage.js';

export async function hashPassword(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function saveAuth(user, remember = true) {
  try {
    if (user) {
      if (remember) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
        sessionStorage.removeItem(AUTH_KEY);
      } else {
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(user));
        localStorage.removeItem(AUTH_KEY);
      }
    } else {
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(AUTH_KEY);
    }
  } catch(e) {}
}

export async function loadAuth() {
  try {
    // Check session first, then local
    let val = sessionStorage.getItem(AUTH_KEY);
    if (!val) {
      val = localStorage.getItem(AUTH_KEY);
    }
    if (val) {
      return JSON.parse(val);
    }
  } catch(e) {}
  return null;
}
