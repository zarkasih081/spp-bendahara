export const STORAGE_KEY = 'spp-data-v1';
export const AUTH_KEY = 'spp-auth-v1';

export const storage = {
  async get(key) {
    if (window.storage) {
      return await window.storage.get(key);
    }
    return { value: localStorage.getItem(key) };
  },
  async set(key, value) {
    if (window.storage) {
      return await window.storage.set(key, value);
    }
    localStorage.setItem(key, value);
  },
  async remove(key) {
    if (window.storage && window.storage.remove) {
      return await window.storage.remove(key);
    }
    localStorage.removeItem(key);
  }
};
