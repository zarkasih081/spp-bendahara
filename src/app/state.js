export const store = {
  state: null,
  ui: { 
    page: 'dashboard', 
    siswaSearch: '', 
    siswaKelasFilter: '', 
    riwayatSearch: '', 
    riwayatKelasFilter: '', 
    riwayatStatusFilter: '', 
    laporanBulan: null, 
    laporanTahun: null, 
    laporanKelas: '', 
    bayarSiswaId: null, 
    bayarSelectedMonths: [], 
    pageSiswa: 1, 
    pageRiwayat: 1, 
    activeTahunMulai: null,
    currentUser: null,
    absensiTanggal: '',
    absensiKelasFilter: '',
    absensiStatusFilter: '',
    absensiTab: 'scan'
  },
  isDataCorrupt: false
};
