document.addEventListener('DOMContentLoaded', () => {

  // ─── CEK SESI LOGIN & STRICT ROLE GUARD (ADMIN) ───
  const userDataString = localStorage.getItem('talentflow_user');
  if (!userDataString) {
    window.location.href = '../index.html'; // Jika belum login, usir
    return;
  }

  const userData = JSON.parse(userDataString);

  // BARIKADE KEAMANAN: Cegah Pelamar masuk ke halaman Admin
  if (userData.role !== 'admin' && userData.role !== 'hr') {
    const deniedModal = document.getElementById('accessDeniedModal');
    const countdownSpan = document.getElementById('redirectCountdown');
    const btnForce = document.getElementById('btnForceRedirect');
    
    if (deniedModal) {
      deniedModal.classList.add('show');
      let timeLeft = 3;
      
      const countdownInterval = setInterval(() => {
        timeLeft--;
        if(countdownSpan) countdownSpan.innerText = timeLeft;
        
        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          window.location.href = '../user/index.html'; // Lempar kembali ke user
        }
      }, 1000);

      if(btnForce) {
        btnForce.onclick = () => {
          clearInterval(countdownInterval);
          window.location.href = '../user/index.html'; // Lempar kembali ke user
        };
      }
    } else {
      window.location.href = '../user/index.html';
    }
    
    return; // Hentikan proses render halaman Admin
  }

  // ─── 1. LOGIKA PERPINDAHAN HALAMAN (TAB SWITCHING) ───
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page-view');
  const topbarTitle = document.querySelector('.topbar-title');

  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      const target = this.getAttribute('data-page');
      // Jika tidak ada data-page (misal: menu kuis berupa link eksternal), abaikan sistem tab
      if (!target) return; 

      e.preventDefault(); 
      
      // Reset semua filter & search input saat pindah halaman
      resetSearchFilters();

      // Ubah warna menu aktif
      navItems.forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
      
      // Sembunyikan semua halaman, lalu munculkan yang dipilih
      pages.forEach(page => {
        page.classList.remove('active');
        if(page.id === `page-${target}`) {
          page.classList.add('active');
        }
      });

      // Update Judul Topbar
      if(target === 'dashboard') topbarTitle.innerText = 'Dashboard';
      else if(target === 'psikotes') topbarTitle.innerText = 'Manajemen Psikotes';  
      else if(target === 'pendaftar') topbarTitle.innerText = 'Daftar Pendaftar';
      else if(target === 'laporan') topbarTitle.innerText = 'Laporan Psikogram';
      else if(target === 'formulir') topbarTitle.innerText = 'Formulir Pendaftaran';
      else if(target === 'performa') topbarTitle.innerText = 'Performa Assessment';
      else if(target === 'pengaturan') topbarTitle.innerText = 'Pengaturan Sistem';
      else if(target === 'bank-soal') {
        topbarTitle.innerText = 'Manajemen Bank Soal';
        if (typeof window.loadQuizListForBank === 'function') window.loadQuizListForBank(); 
      }
      else topbarTitle.innerText = target.charAt(0).toUpperCase() + target.slice(1);
    });
  });

// ─── 2. LOGIKA SIDEBAR (MOBILE & DESKTOP STAGGERED ANIMATION) ───
  const mobileToggle = document.getElementById('mobileToggle');
  const sidebar = document.querySelector('.sidebar');
  const btnDesktopCollapse = document.getElementById('btnDesktopCollapse');

  if (mobileToggle) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.innerWidth <= 768) {
        // Layar HP: Memicu animasi ombak untuk BUKA sidebar
        document.body.classList.toggle('mobile-open');
      } else {
        // Layar Desktop: Memicu animasi ombak untuk MENGEMBALIKAN sidebar
        document.body.classList.remove('desktop-closed');
        mobileToggle.style.display = 'none'; // Sembunyikan lagi garis tiga
      }
    });
  }

  if (btnDesktopCollapse) {
    btnDesktopCollapse.addEventListener('click', () => {
      // Layar Desktop: Memicu animasi ombak untuk MENUTUP sidebar
      document.body.classList.add('desktop-closed');
      // Kosongkan style inline agar bisa diatur CSS
      if (mobileToggle) mobileToggle.style.display = ''; 
    });
  }

  // Klik di luar sidebar untuk menutup otomatis (Khusus Layar HP)
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && document.body.classList.contains('mobile-open')) {
      if (sidebar && !sidebar.contains(e.target) && mobileToggle && !mobileToggle.contains(e.target)) {
        document.body.classList.remove('mobile-open');
      }
    }
  });

  // ─── 3. UNIVERSAL SEARCH (SMART FILTER — PAGE-SCOPED) ───
  const searchInput = document.getElementById('searchInput');

  // Helper: Reset semua filter ke keadaan semula saat pindah halaman
  function resetSearchFilters() {
    if (searchInput) searchInput.value = '';
    
    // Kembalikan semua elemen yang mungkin disembunyikan oleh pencarian sebelumnya
    const allSearchableElements = document.querySelectorAll(`
        #applicantTableBody .trow, 
        #allApplicantTableBody .trow, 
        #performaKuisContainer .progress-item,
        #scrollableQuizList .scroll-stack-card,
        #listSoalContainer > div,
        #discTableBody .trow,
        #page-psikotes .kuis-row,
        #laporanPsikogramBody .trow,
        #performaTableBody .trow,
        .setting-item
    `);
    
    allSearchableElements.forEach(el => {
        if (!el.classList.contains('thead')) {
            el.style.display = '';
        }
    });

    // Khusus untuk mereset menu grup pengaturan
    document.querySelectorAll('.settings-group').forEach(group => {
        group.style.visibility = 'visible';
        group.style.height = '';
        group.style.overflow = '';
        group.style.marginBottom = '';
    });
  }

  if (searchInput) {
    searchInput.addEventListener('keyup', function() {
      const keyword = this.value.toLowerCase();
      
      // Deteksi halaman mana yang sedang aktif / dibuka oleh Admin
      const activePage = document.querySelector('.page-view.active');
      if (!activePage) return;
      const activePageId = activePage.id;

      // Fungsi helper untuk memfilter NodeList dengan mudah
      const filterElements = (elements) => {
          elements.forEach(el => {
              if (el.classList.contains('thead')) return; // Jangan sembunyikan header tabel
              // Cari kecocokan teks di seluruh isi baris tersebut
              el.style.display = el.innerText.toLowerCase().includes(keyword) ? '' : 'none';
          });
      };

      // Terapkan target pencarian berdasarkan halaman yang sedang dibuka
      switch (activePageId) {
          case 'page-dashboard':
              // Di Dashboard: Cari nama pendaftar terbaru DAN performa kuis sekaligus!
              filterElements(document.querySelectorAll('#applicantTableBody .trow'));
              filterElements(document.querySelectorAll('#performaKuisContainer .progress-item'));
              break;
          
          case 'page-pendaftar':
              // Di Menu Pendaftar: Cari nama pendaftar / NIK / Email / Posisi
              filterElements(document.querySelectorAll('#allApplicantTableBody .trow'));
              break;

          case 'page-bank-soal':
              // Di Menu Bank Soal: Cari nama kuis di kotak scroll ATAU cari teks pertanyaan di layar
              filterElements(document.querySelectorAll('#scrollableQuizList .scroll-stack-card'));
              filterElements(document.querySelectorAll('#listSoalContainer > div'));
              break;

          case 'page-bank-disc':
              // Di Menu DISC: Cari teks pernyataan kepribadian
              filterElements(document.querySelectorAll('#discTableBody .trow'));
              break;

          case 'page-psikotes':
              // Di Menu Psikotes: Cari alat tes (Kraepelin, DISC, PAPI)
              filterElements(document.querySelectorAll('#page-psikotes .kuis-row'));
              break;

          case 'page-laporan':
              // Di Laporan: Cari metrik atau nama tes
              filterElements(document.querySelectorAll('#laporanPsikogramBody .trow'));
              break;

          case 'page-performa':
              // Di Performa: Cari nama kuis akademik atau prodi
              filterElements(document.querySelectorAll('#performaTableBody .trow'));
              break;

          case 'page-pengaturan':
              // Di Pengaturan: Logika khusus agar grup (kotak luar) ikut tertutup jika isinya tidak cocok
              document.querySelectorAll('#page-pengaturan .settings-group').forEach(group => {
                  let hasVisibleItem = false;
                  group.querySelectorAll('.setting-item').forEach(item => {
                      const match = item.innerText.toLowerCase().includes(keyword);
                      item.style.display = match ? 'flex' : 'none';
                      if (match) hasVisibleItem = true;
                  });
                  group.style.visibility = hasVisibleItem ? 'visible' : 'hidden';
                  group.style.height = hasVisibleItem ? '' : '0';
                  group.style.overflow = hasVisibleItem ? '' : 'hidden';
                  group.style.marginBottom = hasVisibleItem ? '' : '0';
              });
              break;
      }
    });
  }

 // ─── 4. LOGIKA INTEGRASI API & TALENT CARD ───
  const detailModal = document.getElementById('detailModal');
  const detailContent = document.getElementById('detailContent');
  let modalCharts = [];

  const closeDetail = document.getElementById('closeDetail');
  
  // 1. Tutup saat tombol X diklik
  if (closeDetail) {
    closeDetail.addEventListener('click', () => {
      detailModal.classList.remove('show');
    });
  }

  // 2. Tutup saat area gelap di luar kotak diklik
  window.addEventListener('click', (e) => {
    if (e.target === detailModal) {
      detailModal.classList.remove('show');
    }
  });

  // B. FUNGSI MENGAMBIL DATA DARI SERVER (CLEAN SWEEP - NO DUMMY)
  // ─── FUNGSI MENGAMBIL DATA PELAMAR (CLEAN SWEEP - NO DUMMY DATA) ───
  async function fetchPelamar() {
    const tableBodyRecent = document.getElementById('applicantTableBody'); 
    const tableBodyAll = document.getElementById('allApplicantTableBody'); 

    try {
      const response = await fetch('http://localhost:3000/api/pelamar');
      const data = await response.json(); 
      
      if (tableBodyRecent) tableBodyRecent.innerHTML = ''; 
      if (tableBodyAll) tableBodyAll.innerHTML = ''; 
      // Suntikkan angka total pendaftar ke layar
      const teksTotal = document.getElementById('teksTotalPendaftar');
      if (teksTotal) teksTotal.innerText = `${data.length} Total Pendaftar`;

      data.forEach((pelamar, index) => {
        let inisial = "NN";
        if(pelamar.nama_lengkap) {
           const namaSplit = pelamar.nama_lengkap.split(' ');
           inisial = namaSplit.length > 1 ? (namaSplit[0][0] + namaSplit[1][0]).toUpperCase() : namaSplit[0].substring(0,2).toUpperCase();
        }

        // Format Tanggal Standar Indonesia
        const tgl = new Date(pelamar.tanggal_daftar);
        const formatTgl = `${tgl.getDate()} ${tgl.toLocaleString('id-ID', { month: 'short' })} ${tgl.getFullYear()}`;

        // Logika Status Tahapan
        const tahapan = pelamar.status_pelamar || 'Review'; 
        let bgGradient = 'linear-gradient(135deg,#3b82f6,#8b5cf6)'; 
        let statusPill = `<span class="status-pill pill-review">${tahapan}</span>`;

        if (tahapan === 'Diterima' || tahapan === 'Hired') {
          bgGradient = 'linear-gradient(135deg,#10b981,#047857)';
          statusPill = `<span class="status-pill" style="background: rgba(16,185,129,0.15); color: #10b981;">Diterima</span>`;
        } else if (tahapan === 'Tidak Lolos' || tahapan === 'Rejected') {
          bgGradient = 'linear-gradient(135deg,#ef4444,#b91c1c)';
          statusPill = `<span class="status-pill" style="background: rgba(239,68,68,0.15); color: #ef4444;">Tidak Lolos</span>`;
        }

        // Logika Status Kuis dari Database
        const sudahKuis = pelamar.kuis_selesai > 0;
        const kuisPill = sudahKuis 
          ? `<span class="status-pill" style="background: rgba(16,185,129,0.15); color: #10b981;">Selesai (${pelamar.kuis_selesai})</span>`
          : `<span class="status-pill" style="background: rgba(245,158,11,0.1); color: #f59e0b;">Belum Ujian</span>`;

        // TEMPLATE 1: DASHBOARD UTAMA
        const rowDashboard = `
          <div class="trow" data-email="${pelamar.email}" data-wa="${pelamar.no_whatsapp}">
            <div class="applicant-info">
              <div class="ap-avatar" style="background:${bgGradient}">${inisial}</div>
              <div><div class="ap-name">${pelamar.nama_lengkap}</div><div class="ap-pos">NIK: ${pelamar.nik}</div></div>
            </div>
            <div class="cell">${pelamar.posisi_dilamar || 'Belum Ditentukan'}</div>
            <div class="cell">${formatTgl}</div>
            <div class="status-cell">${statusPill}</div>
            <div><button class="action-btn"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
          </div>
        `;

        // TEMPLATE 2: MENU SEMUA PENDAFTAR
        const rowMenuPendaftar = `
          <div class="trow" data-email="${pelamar.email}" data-wa="${pelamar.no_whatsapp}">
            <div class="applicant-info">
              <div class="ap-avatar" style="background:${bgGradient}">${inisial}</div>
              <div><div class="ap-name">${pelamar.nama_lengkap}</div><div class="ap-pos">NIK: ${pelamar.nik}</div></div>
            </div>
            <div class="cell">${pelamar.posisi_dilamar || 'Belum Ditentukan'}</div>
            <div class="cell">${formatTgl}</div>
            <div class="status-cell">${kuisPill}</div>
            <div><button class="action-btn"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
          </div>
        `;

        if (tableBodyAll) tableBodyAll.innerHTML += rowMenuPendaftar;
        if (tableBodyRecent && index < 5) tableBodyRecent.innerHTML += rowDashboard;
      });

      attachRowClickEvents();
    } catch (error) {
      console.error('Gagal memuat data:', error);
    }
  }

  // C. FUNGSI TALENT CARD

 // ─── FUNGSI TALENT CARD & GRAFIK (BERLAKU UNTUK SEMUA TABEL) ───
  function attachRowClickEvents() {
    // PERBAIKAN: Menargetkan baris di tabel Dashboard DAN tabel Semua Pendaftar
    const rows = document.querySelectorAll('#applicantTableBody .trow, #allApplicantTableBody .trow');
    
    rows.forEach(row => {
      // Gunakan teknik cloning untuk mencegah event klik ganda (berkali-kali)
      const newRow = row.cloneNode(true);
      row.parentNode.replaceChild(newRow, row);

      newRow.addEventListener('click', async function() {
        const nama = this.querySelector('.ap-name').innerText;
        const nikText = this.querySelector('.ap-pos').innerText;
        const nik = nikText.match(/\d+/) ? nikText.match(/\d+/)[0] : null;
        
        if (!nik) return alert("Data NIK tidak valid!");

        const inisial = this.querySelector('.ap-avatar').innerText;
        const avatarStyle = this.querySelector('.ap-avatar').style.background;
        const posisiText = this.querySelector('.cell').innerText; 
        const statusHTML = this.querySelector('.status-cell').innerHTML; 
        const emailInfo = this.getAttribute('data-email');
        const waInfo = this.getAttribute('data-wa');

      // --- MESIN ANALISIS PSIKOLOGI & KAMUS RATUSAN JABATAN DUNIA ---
          function getInterpretasiPsikologi(dataTes) {
              let html = '<div style="margin-top: 20px; padding: 20px; background: rgba(16,185,129,0.05); border: 1px solid #10b981; border-radius: 12px; text-align: left; width: 100%; max-height: 400px; overflow-y: auto;">';
              html += '<h3 style="color: #10b981; font-family: \'Syne\'; font-size: 16px; margin-bottom: 15px; display:flex; align-items:center; gap:8px;"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="20" height="20"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> AI Psychological Interpretation & Job Matching</h3>';

              // 1. ANALISIS KRAEPELIN (KETAHANAN & FOKUS)
              if (dataTes.kraepelin && dataTes.kraepelin.length > 0) {
                  const rataRata = dataTes.kraepelin.reduce((a, b) => a + b, 0) / dataTes.kraepelin.length;
                  let kLabel = "", kJobs = "";
                  if (rataRata >= 14) {
                      kLabel = "SANGAT TINGGI (Daya Tahan Tekanan Luar Biasa)";
                      kJobs = "Air Traffic Controller (ATC), Pialang Saham, Operator Reaktor Nuklir, Ahli Bedah Saraf, Pilot Komersial, Trader Crypto/Forex, Data Entry Specialist, Kasir Bank Tingkat Tinggi, Dispatcher Gawat Darurat (911/112).";
                  } else if (rataRata >= 10) {
                      kLabel = "STABIL / NORMAL (Kinerja Perkantoran Sangat Baik)";
                      kJobs = "Akuntan, Administrator Database, Manajer Proyek, Programmer, Staf HRD, Pegawai Negeri Sipil, Auditor Keuangan, Guru/Dosen, Arsitek, Insinyur Sipil, Manajer Logistik, Sekretaris Eksekutif.";
                  } else {
                      kLabel = "RENDAH (Cenderung Bosan pada Rutinitas, Cocok untuk Fleksibilitas)";
                      kJobs = "Desainer Grafis, Seniman, Penulis Skenario, Fotografer Lepas, Konsultan Kreatif, Jurnalis Lapangan, Event Organizer, Musisi, Sutradara Film, Social Media Influencer.";
                  }
                  html += `<div style="margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px;">
                              <strong style="color: #ef4444; font-size: 14px;">Ketahanan Kerja (Kraepelin): ${kLabel}</strong><br>
                              <span style="color: #8fa0be; font-size: 13px;">Kecocokan Profesi: <span style="color:#e8edf5;">${kJobs}</span></span>
                           </div>`;
              }

              // 2. ANALISIS DISC (GAYA KOMUNIKASI & KEPEMIMPINAN)
              if (dataTes.disc && dataTes.disc.length === 4) {
                  const discKeys = ['D', 'I', 'S', 'C'];
                  const maxScore = Math.max(...dataTes.disc);
                  const tipe = discKeys[dataTes.disc.indexOf(maxScore)];

                  const dictDISC = {
                      'D': {
                          judul: 'DOMINANCE (Berorientasi Hasil & Ketegasan)',
                          pekerjaan: 'Chief Executive Officer (CEO), Chief Operating Officer (COO), Pengusaha Independen, Direktur Perusahaan, Manajer Konstruksi, Kepala Kepolisian, Perwira Militer Senior, Hakim, Jaksa Penuntut, Manajer Penjualan (Sales Director), Politisi Eksekutif, Produser Eksekutif, Kepala Pabrik.'
                      },
                      'I': {
                          judul: 'INFLUENCE (Berorientasi Orang & Komunikasi)',
                          pekerjaan: 'Public Relations (PR) Director, Juru Bicara Kepresidenan, Duta Besar, Motivator Internasional, Presenter Televisi, Sales Representative, Marketing Executive, Content Creator, Event Director, Agen Real Estate, Headhunter/Perekrut Eksekutif, Konsultan Media, Fashion Stylist, Diplomat.'
                      },
                      'S': {
                          judul: 'STEADINESS (Stabil, Empati & Konsisten)',
                          pekerjaan: 'Psikolog Klinis, Dokter Anak, Konselor Pernikahan, Perawat, Terapis Fisik, Guru Sekolah Dasar, Pekerja Sosial, Customer Service Manager, Manajer Operasional Klinik, Pustakawan Kepala, Spesialis HR (Employee Relations), Dokter Gigi, Ahli Gizi, Asisten Pribadi Tingkat Tinggi.'
                      },
                      'C': {
                          judul: 'COMPLIANCE (Akurasi, Sistem & Analisis)',
                          pekerjaan: 'Chief Financial Officer (CFO), Data Scientist, Aktuaris, Auditor Investigasi, Insinyur Perangkat Lunak (Software Engineer), Ahli Forensik Digital, Analis Intelijen, Arsitek Enterprise, Spesialis Keamanan Siber (Cybersecurity), Pengacara Korporat, Konsultan Pajak, Peneliti Ilmiah, Ahli Bedah Jantung, Quality Assurance (QA) Director.'
                      }
                  };
                  html += `<div style="margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px;">
                              <strong style="color: #f59e0b; font-size: 14px;">Gaya Interaksi (DISC): ${dictDISC[tipe].judul}</strong><br>
                              <span style="color: #8fa0be; font-size: 13px;">Kecocokan Profesi: <span style="color:#e8edf5;">${dictDISC[tipe].pekerjaan}</span></span>
                           </div>`;
              }

              // 3. ANALISIS PAPI KOSTICK (20 DIMENSI KARAKTER KERJA)
              if (dataTes.papi && dataTes.papi.length === 20) {
                  const papiLabels = ['G','L','I','T','V','S','R','D','C','E','N','A','P','X','B','O','K','F','W','Z'];
                  // Cari 2 dimensi tertinggi
                  let sortedIndices = dataTes.papi.map((skor, index) => ({ skor, index })).sort((a, b) => b.skor - a.skor);
                  const top1 = papiLabels[sortedIndices[0].index];
                  const top2 = papiLabels[sortedIndices[1].index];

                  const dictPAPI = {
                      'G': 'Pekerja Keras Ekstrem (Manajer Lapangan, Atlet, Konsultan).',
                      'L': 'Pemimpin Bawaan (Direktur, Supervisor, Manajer Eksekutif).',
                      'I': 'Pengambil Keputusan (Hakim, Arbiter, Pimpinan Strategi).',
                      'T': 'Cepat Tanggap (Pemadam Kebakaran, Pilot, Responden Darurat).',
                      'V': 'Penuh Stamina Fisik (Insinyur Lapangan, Militer, Ekspedisi).',
                      'S': 'Ahli Negosiasi (Diplomat, Sales B2B, Pengacara).',
                      'R': 'Teoretis & Pemikir (Ilmuwan, Dosen, Peneliti R&D).',
                      'D': 'Tegas & Berani (Komandan, Eksekutor Proyek, Debt Collector).',
                      'C': 'Sangat Rapi & Terstruktur (Akuntan, Arsiparis, Data Engineer).',
                      'E': 'Emosi Super Stabil (Psikiater, Negosiator Sandera, Terapis).',
                      'N': 'Penyelesai Masalah gigih (Programmer, Detektif, Auditor).',
                      'A': 'Ambisius (Pengusaha, Politisi, Atlet Profesional).',
                      'P': 'Pengatur Orang Lain (HR Manager, Konduktor, Mandor).',
                      'X': 'Mencari Perhatian/Panggung (Aktor, Model, Public Speaker).',
                      'B': 'Kebutuhan Diterima Kelompok (Staf Pendukung, Community Manager).',
                      'O': 'Sangat Dekat secara Personal (Konselor, Perawat, Guru).',
                      'K': 'Agresif / Kompetitif (Trader Wall Street, Atlet Bela Diri, Sales Hardsell).',
                      'F': 'Loyal pada Atasan (Ajudan, Asisten Eksekutif, Staf Administrasi).',
                      'W': 'Taat SOP Mutlak (Inspektur Keselamatan, Petugas Pajak, Quality Control).',
                      'Z': 'Kebutuhan Berubah/Inovasi (Desainer, Seniman, Arsitek, Creative Director).'
                  };

                  html += `<div style="margin-bottom: 5px;">
                              <strong style="color: #3b82f6; font-size: 14px;">Dimensi Perilaku Dominan (PAPI Kostick):</strong><br>
                              <ul style="color: #e8edf5; font-size: 13px; margin-top: 5px; padding-left: 15px;">
                                 <li><strong>Tipe ${top1}</strong>: ${dictPAPI[top1]}</li>
                                 <li><strong>Tipe ${top2}</strong>: ${dictPAPI[top2]}</li>
                              </ul>
                           </div>`;
              }

              if (!dataTes.disc && !dataTes.kraepelin && !dataTes.papi) {
                  html += `<span style="color: var(--muted); font-size: 13px;">Belum ada data psikotes yang diselesaikan.</span>`;
              }

              html += '</div>';
              return html;
          }  
        // 1. Munculkan Modal dalam keadaan "Loading"
        detailContent.innerHTML = '<div style="padding: 60px 20px; text-align: center; color: var(--muted);"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="30" height="30" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><br><br>Memuat riwayat asesmen...</div>';
        detailModal.classList.add('show');

        try {
          // 2. Tarik Data Nyata dari MySQL
          const response = await fetch(`http://localhost:3000/api/admin/pelamar/${nik}/detail`);
          const result = await response.json();

          if (!result.success) throw new Error("Gagal mengambil data");
          const dataTes = result.data;

          // Hitung Akademik
          let totalSkor = 0; let jumlahTesDiikuti = 0; let htmlAkademik = '';
          for (const [mapel, skor] of Object.entries(dataTes.akademik)) {
            if (skor !== "blm test") {
              totalSkor += skor; jumlahTesDiikuti++;
              htmlAkademik += `<div class="akademik-row"><span class="akademik-name">${mapel}</span><span class="akademik-score">${skor}</span></div>`;
            } else {
              htmlAkademik += `<div class="akademik-row"><span class="akademik-name">${mapel}</span><span class="akademik-null">blm test</span></div>`;
            }
          }
          const overallRating = jumlahTesDiikuti > 0 ? Math.round(totalSkor / jumlahTesDiikuti) : 0;

          // Fungsi Pembuat HTML Canvas vs Empty State
          const renderChartArea = (dataArray, canvasId) => {
            if (!dataArray || dataArray.length === 0) {
              return `<div style="height: 220px; width: 100%; display: grid; place-items: center; border: 1px dashed var(--border); border-radius: 8px; background: rgba(0,0,0,0.2);">
                        <span style="color: var(--muted); font-size: 13px; font-style: italic;">Belum melakukan psikotes ini</span>
                      </div>`;
            }
            return `<div style="height: 220px; width: 100%;"><canvas id="${canvasId}"></canvas></div>`;
          };

          // 3. Render HTML Utuh
          detailContent.innerHTML = `
            <div class="fifa-card-layout">
              <div class="fifa-profile-side">
                <div class="fifa-overall-wrap">
                  <div class="fifa-avatar" style="background: ${avatarStyle}">${inisial}</div>
                  <div class="fifa-rating">
                    <span class="fifa-rating-num">${overallRating}</span>
                    <span class="fifa-rating-label">OVR AVG</span>
                  </div>
                </div>
                <h2 style="font-family: 'Syne'; font-size: 18px; margin-bottom: 5px;">${nama}</h2>
                <span style="font-size: 12px; color: var(--accent); font-weight: 600;">${posisiText}</span>
                <div style="margin-top: 25px; text-align: left; width: 100%;">
                  <div class="fifa-info-label">Email</div><div class="fifa-info-val">${emailInfo}</div>
                  <div class="fifa-info-label">WhatsApp</div><div class="fifa-info-val">${waInfo}</div>
                  <div class="fifa-info-label">Status Tes</div><div class="fifa-info-val" style="margin-top:5px;">${statusHTML}</div>
                </div>
                
                ${getInterpretasiPsikologi(dataTes)}

              </div>

              <div class="fifa-stats-side">
                <div class="carousel-track" id="statsTrack">
                  <div class="carousel-slide">
                    <div class="slide-title">Statistik Tes Akademik</div>
                    <div style="display:flex; flex-direction:column; gap: 5px;">${htmlAkademik || '<div style="color:var(--muted); font-size:13px;">Belum ada data akademik</div>'}</div>
                  </div>
                  <div class="carousel-slide">
                    <div class="slide-title">Ketahanan Kerja (Kraepelin)</div>
                    ${renderChartArea(dataTes.kraepelin, 'chartKrapelin')}
                  </div>
                  <div class="carousel-slide">
                    <div class="slide-title">Gaya Komunikasi (DISC)</div>
                    ${renderChartArea(dataTes.disc, 'chartDisc')}
                  </div>
                  <div class="carousel-slide" style="overflow-y: auto; padding-right: 5px;">
                    <div class="slide-title">Dimensi Perilaku (PAPI)</div>
                    ${renderChartArea(dataTes.papi, 'chartPapi')}
                    
                    ${dataTes.papi && dataTes.papi.length > 0 ? `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: var(--muted); margin-top: 15px; text-align: left; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.05);">
                        <div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">G:</strong> Pekerja Keras</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">L:</strong> Kepemimpinan</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">I:</strong> Buat Keputusan</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">T:</strong> Cepat Tanggap</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">V:</strong> Stamina Fisik</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">S:</strong> Hub. Sosial</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">R:</strong> Pemikir/Teoretis</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">D:</strong> Tegas & Berani</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">C:</strong> Terstruktur</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">E:</strong> Emosi Stabil</div>
                        </div>
                        <div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">N:</strong> Gigih (Masalah)</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">A:</strong> Ambisius</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">P:</strong> Mengatur Orang</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">X:</strong> Cari Panggung</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">B:</strong> Diterima Tim</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">O:</strong> Dekat Personal</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">K:</strong> Kompetitif</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">F:</strong> Loyal (Atasan)</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">W:</strong> Taat Aturan (SOP)</div>
                            <div style="margin-bottom:3px;"><strong style="color:#10b981;">Z:</strong> Butuh Inovasi</div>
                        </div>
                    </div>` : ''}
                  </div>
                </div>
                <div class="carousel-nav">
                  <button class="nav-btn" id="btnPrevSlide"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg></button>
                  <button class="nav-btn" id="btnNextSlide"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg></button>
                </div>
              </div>
            </div>
          `;

          // 4. Inisialisasi Slider
          const track = document.getElementById('statsTrack');
          let currentSlide = 0;
          document.getElementById('btnNextSlide').onclick = (e) => { e.stopPropagation(); currentSlide = (currentSlide + 1) % 4; track.style.transform = `translateX(-${currentSlide * 100}%)`; };
          document.getElementById('btnPrevSlide').onclick = (e) => { e.stopPropagation(); currentSlide = (currentSlide - 1 + 4) % 4; track.style.transform = `translateX(-${currentSlide * 100}%)`; };

          // 5. Eksekusi Gambar Chart (HANYA JIKA ADA DATA)
          modalCharts.forEach(chart => chart.destroy()); modalCharts = [];
          Chart.defaults.color = '#8fa0be'; Chart.defaults.font.family = "'DM Sans', sans-serif";

          if (dataTes.kraepelin && dataTes.kraepelin.length > 0) {
            modalCharts.push(new Chart(document.getElementById('chartKrapelin'), { type: 'line', data: { labels: dataTes.kraepelin.map((_, i) => 'Int '+(i+1)), datasets: [{ label: 'Baris Terjawab', data: dataTes.kraepelin, borderColor: '#3b82f6', borderWidth: 2, tension: 0.2, fill: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }));
          }
          if (dataTes.disc && dataTes.disc.length > 0) {
            modalCharts.push(new Chart(document.getElementById('chartDisc'), { type: 'bar', data: { labels: ['D', 'I', 'S', 'C'], datasets: [{ label: 'Persentase', data: dataTes.disc, backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'], borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }));
          }
          if (dataTes.papi && dataTes.papi.length > 0) {
            modalCharts.push(new Chart(document.getElementById('chartPapi'), { type: 'radar', data: { labels: ['G','L','I','T','V','S','R','D','C','E','N','A','P','X','B','O','K','F','W','Z'], datasets: [{ label: 'Skor', data: dataTes.papi, backgroundColor: 'rgba(16,185,129,0.2)', borderColor: '#10b981', pointBackgroundColor: '#10b981', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { ticks: { display: false, max: 10 } } }, plugins: { legend: { display: false } } } }));
          }

        } catch (err) {
          detailContent.innerHTML = `<div style="padding:40px; text-align:center; color:var(--danger);">Gagal menarik data dari server.</div>`;
        }
      });
    });
  }
  // --- Jangan lupa hapus objek variabel dbPsikotes (data dummy) yang ada di atas fungsi attachRowClickEvents Anda sebelumnya. ---

  // ─── FUNGSI MENGAMBIL DATA KUIS DARI API (DENGAN LOGIKA AUTO-AKTIF) ───
  async function fetchKuis() {
    const kuisTableBody = document.getElementById('kuisTableBody');
    if (!kuisTableBody) return;

    try {
      const response = await fetch('http://localhost:3000/api/admin/kuis');
      const result = await response.json();

      if (result.success) {
        kuisTableBody.innerHTML = ''; 
        let totalAktifReal = 0; 

        // Tarik jumlah soal NYATA dari database untuk masing-masing kuis secara kilat (Promise.all)
        const quizzesWithRealCount = await Promise.all(result.data.map(async (kuis) => {
            try {
                const resSoal = await fetch(`http://localhost:3000/api/admin/soal/${kuis.id}`);
                const soalResult = await resSoal.json();
                const realCount = soalResult.success ? soalResult.data.length : 0;
                return { ...kuis, realCount };
            } catch (e) {
                return { ...kuis, realCount: 0 };
            }
        }));

        quizzesWithRealCount.forEach(kuis => {
          const tgl = new Date(kuis.jadwal_ujian);
          const formatTgl = `${tgl.getDate()} ${tgl.toLocaleString('id-ID', { month: 'short' })} ${tgl.getFullYear()}`;
          const inisial = kuis.nama_kuis.charAt(0).toUpperCase();

          const isAktif = kuis.realCount >= kuis.jumlah_soal;
          const statusText = isAktif ? 'Aktif' : 'Tdk Aktif';
          const statusClass = isAktif ? 'pill-done' : '';
          const statusStyle = isAktif ? 'background: rgba(16,185,129,0.15); color: #10b981;' : 'background: rgba(239,68,68,0.1); color: #ef4444;';
          const teksSoalStyle = isAktif ? 'font-size:11px; color: var(--muted);' : 'font-size:11px; color: var(--danger); font-weight: bold;';

          if (isAktif) totalAktifReal++;

          // LOGIKA BARU: Ditaruh di LUAR teks HTML agar dieksekusi oleh JavaScript
          const targetDisplay = kuis.target_posisi_dinamis || kuis.target_posisi || 'Belum Ditentukan';
          const targetText = targetDisplay.length > 35 ? targetDisplay.substring(0, 35) + '...' : targetDisplay;

          kuisTableBody.innerHTML += `
            <div class="trow kuis-row" data-id="${kuis.id}" data-rumpun="${kuis.rumpun_ilmu}" data-pohon="${kuis.pohon_ilmu}" data-prodi="${kuis.program_studi}" data-jadwal="${kuis.jadwal_ujian.split('T')[0]}" data-soal="${kuis.jumlah_soal}" data-bank="${kuis.bank_soal}">
              
              <div class="applicant-info">
                <div class="ap-avatar" style="background: rgba(59,130,246,0.2); color: var(--accent2);">${inisial}</div>
                <div>
                  <div class="ap-name">${kuis.nama_kuis}</div>
                  <div class="ap-pos">${kuis.rumpun_ilmu} | <strong class="row-jadwal" style="color: var(--accent);">${formatTgl}</strong></div>
                </div>
              </div>
              
              <div class="cell" title="${targetDisplay}">${targetText}</div>
              
              <div class="cell">
                <strong style="color:var(--text);">${kuis.durasi_menit} Menit</strong> <br>
                <span class="row-soal-teks" style="${teksSoalStyle}">(${kuis.realCount} Terisi dari Target ${kuis.jumlah_soal})</span>
              </div>
              
              <div><span class="status-pill ${statusClass}" style="${statusStyle}">${statusText}</span></div>
              
              <div>
                <button class="action-btn btn-kelola" title="Kelola Kuis">
                  <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </div>

            </div>
          `;
        });

        // UPDATE STATISTIK UI DI ATAS DASHBOARD
        const statTotal = document.getElementById('statTotalKuis');
        const statTerjadwal = document.getElementById('statKuisTerjadwal');
        const statAktif = document.getElementById('statKuisAktif');
        
        if(statTotal) statTotal.innerText = result.stats.total;
        if(statTerjadwal) statTerjadwal.innerText = result.stats.terjadwal;
        if(statAktif) statAktif.innerText = totalAktifReal; 

        attachKelolaKuisEvents();
        if (window.refreshKuisFilters) window.refreshKuisFilters(); 
      }
    } catch (error) {
      console.error('Gagal memuat kuis:', error);
    }
  }

  // Jalankan fungsi
  fetchKuis();
  fetchPelamar();

  // ─── 5. LOGIKA TOMBOL "LIHAT LAPORAN" DI DASHBOARD ───
  const btnLihatLaporan = document.getElementById('btnLihatLaporan');
  if (btnLihatLaporan) {
    btnLihatLaporan.addEventListener('click', () => {
      // Karena Laporan sekarang ada di web Kuis, arahkan tombol ini ke sana
      window.open('kuis.html', '_blank');
    });
  }

  // ─── 6. LOGIKA DROPDOWN FILTER & NOTIFIKASI ───
  const btnFilter = document.getElementById('btnFilter');
  const dropdownFilter = document.getElementById('dropdownFilter');
  const btnNotif = document.getElementById('btnNotif');
  const dropdownNotif = document.getElementById('dropdownNotif');

  if (btnFilter && dropdownFilter) {
    btnFilter.addEventListener('click', (e) => {
      e.stopPropagation();
      if(dropdownNotif) dropdownNotif.classList.remove('show');
      dropdownFilter.classList.toggle('show');
    });
  }

  if (btnNotif && dropdownNotif) {
    btnNotif.addEventListener('click', (e) => {
      e.stopPropagation();
      if(dropdownFilter) dropdownFilter.classList.remove('show');
      dropdownNotif.classList.toggle('show');
    });
  }

  window.addEventListener('click', (e) => {
    if (dropdownFilter && !dropdownFilter.contains(e.target) && !btnFilter.contains(e.target)) {
      dropdownFilter.classList.remove('show');
    }
    if (dropdownNotif && !dropdownNotif.contains(e.target) && !btnNotif.contains(e.target)) {
      dropdownNotif.classList.remove('show');
    }
  });

  // ─── 7. LOGIKA KLIK KARTU STATISTIK ───
  const cardTotalPendaftar = document.getElementById('cardTotalPendaftar');
  const cardKuisSelesai = document.getElementById('cardKuisSelesai');
  const cardRataRataSkor = document.getElementById('cardRataRataSkor');
  
  // Mengarahkan ke Tab Pendaftar
  if (cardTotalPendaftar) {
    cardTotalPendaftar.addEventListener('click', () => {
      const navPendaftar = document.querySelector('.nav-item[data-page="pendaftar"]');
      if (navPendaftar) navPendaftar.click();
    });
  }

  // Mengarahkan Kartu Kuis ke Web Eksternal
  if (cardKuisSelesai) {
    cardKuisSelesai.addEventListener('click', () => {
      window.open('kuis.html', '_blank'); 
    });
  }

  // Mengarahkan ke Tab Performa Kuis
  if (cardRataRataSkor) {
    cardRataRataSkor.addEventListener('click', () => {
      const navPerforma = document.querySelector('.nav-item[data-page="performa"]');
      if (navPerforma) navPerforma.click();
    });
  }
  // Mengarahkan tombol "Lihat Semua ->" ke Tab Pendaftar
  const linkLihatSemuaPendaftar = document.getElementById('linkLihatSemuaPendaftar');
  if (linkLihatSemuaPendaftar) {
    linkLihatSemuaPendaftar.addEventListener('click', (e) => {
      e.preventDefault(); // Mencegah layar melompat ke atas karena href="#"
      const navPendaftar = document.querySelector('.nav-item[data-page="pendaftar"]');
      if (navPendaftar) navPendaftar.click();
    });
  }

// ─── 8. LOGIKA SORTING & FILTERING PERFORMA KUIS (DINAMIS DARI DATABASE) ───
  let performaData = []; // Variabel kosong untuk menampung data dari MySQL
  
  const sortKriteria = document.getElementById('sortKriteria');
  const sortArah = document.getElementById('sortArah');
  const performaTableBody = document.getElementById('performaTableBody');
  const countPerforma = document.getElementById('countPerforma');

  // A. Fungsi Menarik Data Performa dari Node.js
  async function fetchPerformaKuis() {
    if (!performaTableBody) return; // Abaikan jika bukan di halaman ini
    
    try {
      const response = await fetch('http://localhost:3000/api/admin/performa-kuis');
      const result = await response.json();
      
      if (result.success) {
        // Modifikasi data mentah dari MySQL agar memiliki warna dan ikon yang tepat
        performaData = result.data.map(item => {
          let colorClass = "rgba(16,185,129,0.2)"; let textColor = "var(--accent3)"; // Default hijau (Matematika dll)
          if(item.prodi === 'it') { colorClass = "rgba(59,130,246,0.2)"; textColor = "var(--accent2)"; } // Biru
          if(item.prodi === 'kesehatan') { colorClass = "rgba(239,68,68,0.2)"; textColor = "var(--danger)"; } // Merah
          if(item.prodi === 'bahasa') { colorClass = "rgba(139,92,246,0.2)"; textColor = "#8b5cf6"; } // Ungu

          return {
            ...item,
            avatar: item.nama.charAt(0).toUpperCase(),
            color: colorClass,
            textColor: textColor,
            prodi: item.prodi.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) // Rapikan teks prodi
          };
        });
        
        renderPerforma(); // Render tabel setelah data siap
      }
    } catch (error) {
      console.error("Gagal menarik data performa:", error);
    }
  }

  // B. Fungsi Merender & Menyortir Tabel
  function renderPerforma() {
    if (!performaTableBody) return;

    const kriteria = sortKriteria.value;
    const arah = sortArah.value;

    let sortedData = [...performaData];

    // Proses Sorting (Mengurutkan data)
    sortedData.sort((a, b) => {
      let valA = a[kriteria];
      let valB = b[kriteria];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return arah === 'asc' ? -1 : 1;
      if (valA > valB) return arah === 'asc' ? 1 : -1;
      return 0;
    });

    if (countPerforma) countPerforma.innerText = `${sortedData.length} Modul Kuis Aktif`;
    performaTableBody.innerHTML = '';
    
    sortedData.forEach(item => {
      // Warna nilai: Hijau jika >= 80, Oranye jika < 80 tapi ada isinya, Abu-abu jika 0
      const nilaiColor = item.nilai >= 80 ? 'var(--accent3)' : (item.nilai > 0 ? 'var(--accent)' : 'var(--muted)');

      performaTableBody.innerHTML += `
        <div class="trow">
          <div class="applicant-info">
            <div class="ap-avatar" style="background: ${item.color}; color: ${item.textColor};">${item.avatar}</div>
            <div>
              <div class="ap-name">${item.nama}</div>
            </div>
          </div>
          <div class="cell">${item.prodi}</div>
          <div class="cell"><strong>${item.peserta}</strong> <span style="font-size:11px; color:var(--muted);">Orang</span></div>
          <div><span style="font-weight: 800; font-size: 16px; color: ${nilaiColor};">${item.nilai}</span> <span style="font-size: 11px; color: var(--muted);">/ 100 avg</span></div>
          <div>
            <button class="action-btn" title="Lihat Top 5" onclick="showLeaderboard(${item.id}, \`${item.nama}\`)">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
      `;
    });
  }

  // C. Pasang Event Listener ke Dropdown Filter
  if (sortKriteria && sortArah) {
    sortKriteria.addEventListener('change', renderPerforma);
    sortArah.addEventListener('change', renderPerforma);
    
    // Panggil fungsi tarik data saat halaman pertama dimuat
    fetchPerformaKuis(); 
  }
  
  // ─── 9. LOGIKA LAMPU TEMA (DARK/LIGHT MODE) ───
  const lampToggle = document.getElementById('lampToggle');
  const bodyElement = document.body;

  // Cek apakah user sebelumnya sudah memilih Light Mode (simpan di LocalStorage)
  if (localStorage.getItem('theme') === 'light') {
    bodyElement.classList.add('light-mode');
  }

  if (lampToggle) {
    lampToggle.addEventListener('click', () => {
      // Tambahkan/hilangkan class light-mode di tag body
      bodyElement.classList.toggle('light-mode');
      
      // Simpan pilihan ke LocalStorage agar tidak hilang saat di-refresh
      if (bodyElement.classList.contains('light-mode')) {
        localStorage.setItem('theme', 'light');
      } else {
        localStorage.setItem('theme', 'dark');
      }
    });
  }

  // ─── 10. LOGIKA NAVIGASI PENGATURAN BERTINGKAT ───
  const settingItems = document.querySelectorAll('.setting-item[data-goto]');
  const backButtons = document.querySelectorAll('.back-settings-btn[data-back]');
  const settingPanels = document.querySelectorAll('.settings-panel');

  // Fungsi untuk mengganti panel pengaturan yang aktif
  function switchSettingsPanel(targetId) {
    settingPanels.forEach(panel => {
      panel.classList.remove('active');
      if (panel.id === targetId) {
        panel.classList.add('active');
      }
    });
  }

  // Jika item menu diklik (Masuk ke dalam)
  settingItems.forEach(item => {
    item.addEventListener('click', function() {
      const target = this.getAttribute('data-goto');
      if (target) switchSettingsPanel(target);
    });
  });

  // Jika tombol panah kembali diklik (Keluar)
  backButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const target = this.getAttribute('data-back');
      if (target) switchSettingsPanel(target);
    });
  });

  // ─── 11. LOGIKA PEMILIHAN BAHASA ───
  const langOptions = document.querySelectorAll('.lang-option');
  const currentLangText = document.getElementById('currentLangText');
  
  // A. Cek memori (LocalStorage) saat halaman pertama kali dibuka
  const savedLang = localStorage.getItem('app_language') || 'id'; // default 'id'
  
  langOptions.forEach(opt => {
    // Sesuaikan ceklis dengan bahasa yang tersimpan
    if (opt.getAttribute('data-lang') === savedLang) {
      opt.classList.add('active');
      // Update teks di menu luar sesuai bahasa yang tersimpan
      if (currentLangText) {
        currentLangText.innerText = opt.querySelector('.setting-title').innerText;
      }
    } else {
      opt.classList.remove('active');
    }
  });

  // B. Logika saat opsi bahasa diklik
  langOptions.forEach(option => {
    option.addEventListener('click', function() {
      // 1. Pindah ceklis
      langOptions.forEach(opt => opt.classList.remove('active'));
      this.classList.add('active');
      
      // 2. Simpan pilihan ke memori browser
      const selectedLang = this.getAttribute('data-lang');
      localStorage.setItem('app_language', selectedLang);
      
      // 3. UPDATE TEKS DI MENU LUAR
      const selectedText = this.querySelector('.setting-title').innerText;
      if (currentLangText) {
        currentLangText.innerText = selectedText;
      }
    });
  });

  // ─── 12. LOGIKA FILTER BERTINGKAT & PENCARIAN KUIS (DINAMIS 3 TINGKAT) ───
  const filterRumpunTable = document.getElementById('filterRumpun');
  const filterPohonTable = document.getElementById('filterPohon');
  const filterProdiTable = document.getElementById('filterProdi');
  const searchKuisTable = document.getElementById('searchKuis'); // Jika Anda punya input search ber-ID searchKuis

  // Fungsi untuk membaca tabel yang ada dan menyusun daftar filter
  window.refreshKuisFilters = function() {
      const rows = Array.from(document.querySelectorAll('.kuis-row'));

      const currentRumpun = filterRumpunTable ? filterRumpunTable.value : 'all';
      const currentPohon = filterPohonTable ? filterPohonTable.value : 'all';
      const currentProdi = filterProdiTable ? filterProdiTable.value : 'all';

      let availableRumpuns = new Set();
      let availablePohons = new Set();
      let availableProdis = new Set();

      rows.forEach(row => {
          const r = row.getAttribute('data-rumpun');
          const p = row.getAttribute('data-pohon');
          const s = row.getAttribute('data-prodi');

          if (r && r !== 'null') availableRumpuns.add(r);

          // Munculkan Pohon hanya jika Rumpun cocok
          if (p && p !== 'null' && (currentRumpun === 'all' || r === currentRumpun)) {
              availablePohons.add(p);
          }

          // Munculkan Prodi hanya jika Rumpun & Pohon cocok
          if (s && s !== 'null' &&
             (currentRumpun === 'all' || r === currentRumpun) &&
             (currentPohon === 'all' || p === currentPohon)) {
              availableProdis.add(s);
          }
      });

      if (filterRumpunTable) {
          filterRumpunTable.innerHTML = '<option value="all">Semua Rumpun Ilmu</option>';
          [...availableRumpuns].sort().forEach(val => filterRumpunTable.innerHTML += `<option value="${val}">${val}</option>`);
          filterRumpunTable.value = availableRumpuns.has(currentRumpun) ? currentRumpun : 'all';
      }

      if (filterPohonTable) {
          filterPohonTable.innerHTML = '<option value="all">Semua Pohon Ilmu</option>';
          [...availablePohons].sort().forEach(val => filterPohonTable.innerHTML += `<option value="${val}">${val}</option>`);
          filterPohonTable.value = availablePohons.has(currentPohon) ? currentPohon : 'all';
      }

      if (filterProdiTable) {
          filterProdiTable.innerHTML = '<option value="all">Semua Program Studi</option>';
          [...availableProdis].sort().forEach(val => filterProdiTable.innerHTML += `<option value="${val}">${val}</option>`);
          filterProdiTable.value = availableProdis.has(currentProdi) ? currentProdi : 'all';
      }
  };

  // Fungsi menyembunyikan baris yang tidak sesuai filter
  function filterKuisData() {
      const keyword = searchKuisTable && searchKuisTable.value ? searchKuisTable.value.toLowerCase() : '';
      const selectedRumpun = filterRumpunTable ? filterRumpunTable.value : 'all';
      const selectedPohon = filterPohonTable ? filterPohonTable.value : 'all';
      const selectedProdi = filterProdiTable ? filterProdiTable.value : 'all';

      const rows = document.querySelectorAll('.kuis-row');

      rows.forEach(row => {
          const nameElement = row.querySelector('.ap-name');
          const textName = nameElement ? (nameElement.textContent || nameElement.innerText).toLowerCase() : '';

          const rowRumpun = row.getAttribute('data-rumpun');
          const rowPohon = row.getAttribute('data-pohon');
          const rowProdi = row.getAttribute('data-prodi');

          const matchKeyword = textName.indexOf(keyword) > -1;
          const matchRumpun = (selectedRumpun === 'all' || rowRumpun === selectedRumpun);
          const matchPohon = (selectedPohon === 'all' || rowPohon === selectedPohon);
          const matchProdi = (selectedProdi === 'all' || rowProdi === selectedProdi);

          // Jika semua filter cocok, tampilkan!
          if (matchKeyword && matchRumpun && matchPohon && matchProdi) {
              row.style.display = "";
          } else {
              row.style.display = "none";
          }
      });
  }

  // Pasang Mata-mata (Event Listener) ke Kotak Filter
  if (filterRumpunTable) {
      filterRumpunTable.addEventListener('change', () => {
          if(filterPohonTable) filterPohonTable.value = 'all';
          if(filterProdiTable) filterProdiTable.value = 'all';
          window.refreshKuisFilters();
          filterKuisData();
      });
  }
  if (filterPohonTable) {
      filterPohonTable.addEventListener('change', () => {
          if(filterProdiTable) filterProdiTable.value = 'all';
          window.refreshKuisFilters();
          filterKuisData();
      });
  }
  if (filterProdiTable) filterProdiTable.addEventListener('change', filterKuisData);
  if (searchKuisTable) searchKuisTable.addEventListener('keyup', filterKuisData);

// ─── 13. LOGIKA KELOLA KUIS (API INTEGRATION) ───
  const kelolaModal = document.getElementById('kelolaKuisModal');
  const closeKelolaModal = document.getElementById('closeKelolaModal');
  const btnBatalKuis = document.getElementById('btnBatalKuis');
  const btnSimpanKuis = document.getElementById('btnSimpanKuis');
  const btnHapusKuis = document.getElementById('btnHapusKuis');

  const inputJadwal = document.getElementById('editJadwalKuis');
  const inputBankSoal = document.getElementById('editTotalBankSoal'); 
  const inputSoal = document.getElementById('editSoalDiujikan');
  const modalKuisTitle = document.getElementById('modalKuisTitle');

  let idKuisAktif = null; 

  // --- LOGIKA CHECKBOX UNTUK MODAL EDIT ---
  const chkSemuaPosisiEdit = document.getElementById('chkSemuaPosisiEdit');
  const dynamicJobCheckboxesEdit = document.getElementById('dynamicJobCheckboxesEdit');

  async function loadJobTargetsEdit() {
      if (!dynamicJobCheckboxesEdit) return;
      try {
          const res = await fetch('http://localhost:3000/api/admin/pekerjaan');
          const result = await res.json();
          if (result.success) {
              dynamicJobCheckboxesEdit.innerHTML = '';
              result.data.forEach(job => {
                  const label = document.createElement('label');
                  label.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: #fff; font-size: 13px;';
                  label.innerHTML = `
                      <input type="checkbox" class="chk-job-target-edit" value="${job.nama_posisi}">
                      ${job.nama_posisi}
                  `;
                  dynamicJobCheckboxesEdit.appendChild(label);
              });

              if (chkSemuaPosisiEdit) {
                  chkSemuaPosisiEdit.addEventListener('change', (e) => {
                      const isChecked = e.target.checked;
                      document.querySelectorAll('.chk-job-target-edit').forEach(chk => {
                          chk.checked = false;
                          chk.disabled = isChecked; 
                      });
                  });
              }
          }
      } catch (err) { console.error(err); }
  }
  loadJobTargetsEdit();

  // A. Fungsi ini dipanggil otomatis saat tombol aksi/edit diklik
  function attachKelolaKuisEvents() {
    const btnKelolas = document.querySelectorAll('.btn-kelola'); 
    
    btnKelolas.forEach(btn => {
      btn.onclick = async function() { 
        const baris = this.closest('.kuis-row');
        idKuisAktif = baris.getAttribute('data-id'); 
        
        modalKuisTitle.innerText = `Kelola: ${baris.querySelector('.ap-name').innerText}`;
        inputJadwal.value = baris.getAttribute('data-jadwal');
        inputSoal.value = baris.getAttribute('data-soal');

        // Tarik Total Bank Soal 
        if (inputBankSoal) {
            inputBankSoal.type = "text"; inputBankSoal.value = "Menghitung..."; 
            try {
                const resSoal = await fetch(`http://localhost:3000/api/admin/soal/${idKuisAktif}`);
                const dataSoal = await resSoal.json();
                inputBankSoal.type = "number";
                inputBankSoal.value = dataSoal.success ? dataSoal.data.length : 0; 
            } catch (e) { inputBankSoal.value = 0; }
        }

        // --- PRE-CHECK: Tarik Target Posisi Saat Ini ---
        if (chkSemuaPosisiEdit) {
            chkSemuaPosisiEdit.checked = false;
            document.querySelectorAll('.chk-job-target-edit').forEach(c => { c.checked = false; c.disabled = false; });
            
            try {
                const resTarget = await fetch(`http://localhost:3000/api/admin/kuis/${idKuisAktif}/target`);
                const dataTarget = await resTarget.json();
                if (dataTarget.success && dataTarget.data) {
                    if (dataTarget.data.includes('Semua Posisi')) {
                        chkSemuaPosisiEdit.checked = true;
                        document.querySelectorAll('.chk-job-target-edit').forEach(c => c.disabled = true);
                    } else {
                        document.querySelectorAll('.chk-job-target-edit').forEach(c => {
                            if (dataTarget.data.includes(c.value)) c.checked = true;
                        });
                    }
                }
            } catch (e) { console.error("Gagal load target saat ini", e); }
        }

        kelolaModal.classList.add('show');
      };
    });
  }

  // B. Menutup Modal
  const tutupKelolaModal = () => { if(kelolaModal) kelolaModal.classList.remove('show'); idKuisAktif = null; }
  if(closeKelolaModal) closeKelolaModal.onclick = tutupKelolaModal;
  if(btnBatalKuis) btnBatalKuis.onclick = tutupKelolaModal;

  const warningModal = document.getElementById('warningModal');
  const warningText = document.getElementById('warningModalText');
  const btnOkWarning = document.getElementById('btnOkWarning');
  if (btnOkWarning) btnOkWarning.onclick = () => warningModal.classList.remove('show');

  // C. Simpan Perubahan (UPDATE Jadwal & Target Sekaligus)
  if (btnSimpanKuis) {
    btnSimpanKuis.onclick = async () => {
      if (!idKuisAktif) return;

      const jadwalBaru = inputJadwal.value;
      const soalBaru = parseInt(inputSoal.value);
      const bankBaru = parseInt(inputBankSoal.value);

      if (soalBaru > bankBaru) {
          if (warningModal && warningText) {
              warningText.innerText = "Jumlah soal yang diujikan tidak boleh lebih besar dari total Bank Soal yang tersedia!";
              warningModal.classList.add('show');
          } else alert("Peringatan: Jumlah soal tidak boleh lebih besar dari Bank Soal!");
          return;
      }

      // Kumpulkan Target Posisi dari modal Edit
      let targetPosisiArrayEdit = [];
      if (chkSemuaPosisiEdit && chkSemuaPosisiEdit.checked) {
          targetPosisiArrayEdit.push('Semua Posisi');
      } else {
          document.querySelectorAll('.chk-job-target-edit:checked').forEach(chk => targetPosisiArrayEdit.push(chk.value));
      }

      if (targetPosisiArrayEdit.length === 0) {
          if(warningModal && warningText) { warningText.innerText = "Pilih minimal satu target posisi."; warningModal.classList.add('show'); }
          else alert("Pilih minimal satu target posisi.");
          return;
      }

      const teksAsli = btnSimpanKuis.innerText;
      btnSimpanKuis.innerText = "Menyimpan..."; btnSimpanKuis.disabled = true;

      try {
        // Tembak dua API sekaligus: 1 untuk Jadwal/Soal, 1 untuk Target Pivot Table
        const request1 = fetch(`http://localhost:3000/api/kuis/${idKuisAktif}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jadwal_ujian: jadwalBaru, jumlah_soal: soalBaru, bank_soal: bankBaru })
        });
        
        const request2 = fetch(`http://localhost:3000/api/admin/kuis/${idKuisAktif}/target`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_posisi_array: targetPosisiArrayEdit })
        });

        const [res1, res2] = await Promise.all([request1, request2]);

        if (res1.ok && res2.ok) {
          tutupKelolaModal();
          fetchKuis(); // Refresh layar
        } else {
          throw new Error("Sistem gagal memperbarui data ganda.");
        }
      } catch (error) {
        console.error("Gagal update:", error);
        if (warningModal && warningText) { warningText.innerText = "Terjadi kesalahan koneksi ke server."; warningModal.classList.add('show'); }
      } finally {
        btnSimpanKuis.innerText = teksAsli; btnSimpanKuis.disabled = false;
      }
    };
  }

 // ============================================================================
  // ─── 14. LOGIKA VISUALISASI GRAFIK PSIKOTES & LAPORAN DINAMIS ───
  // ============================================================================
  const grafikModal = document.getElementById('grafikModal');
  const closeGrafikModal = document.getElementById('closeGrafikModal');
  const grafikModalTitle = document.getElementById('grafikModalTitle');
  const grafikKeterangan = document.getElementById('grafikKeterangan');
  const laporanPsikogramBody = document.getElementById('laporanPsikogramBody');
  
  let chartInstance = null;
  let dataGrafikDinamic = {}; // Penyimpan data mentah dari server

  if(typeof Chart !== 'undefined') {
    Chart.defaults.color = '#8fa0be'; 
    Chart.defaults.font.family = "'DM Sans', sans-serif";
  }

  // A. FUNGSI TARIK DATA LAPORAN DARI DATABASE
  async function fetchLaporanPsikogram() {
      if (!laporanPsikogramBody) return;
      
      try {
          const response = await fetch('http://localhost:3000/api/admin/laporan-psikogram');
          const result = await response.json();
          
          if (result.success) {
              const d = result.data;
              
              // Simpan data array grafik yang dikirim server ke memori lokal browser
              dataGrafikDinamic = {
                  kraepelin: { chartData: d.kraepelin.chart, peserta: d.kraepelin.peserta },
                  disc: { chartData: d.disc.chart, peserta: d.disc.peserta },
                  papi: { chartData: d.papi.chart, peserta: d.papi.peserta }
              };

              laporanPsikogramBody.innerHTML = `
                  <div class="trow">
                    <div class="applicant-info">
                      <div class="ap-avatar" style="background: rgba(59,130,246,0.2); color: var(--accent2);">K</div>
                      <div><div class="ap-name">Tes Kraepelin (Koran)</div><div class="ap-pos">Kecepatan & Ketelitian</div></div>
                    </div>
                    <div class="cell">Ketahanan Kerja</div>
                    <div class="cell"><strong>${d.kraepelin.peserta}</strong> <span style="font-size:11px; color:var(--muted);">Orang</span></div>
                    <div class="cell">
                      <strong style="color:var(--accent2);">Kecepatan: ${d.kraepelin.speed} baris/menit</strong><br>
                      <span style="font-size:11px; color:var(--muted);">Ketelitian rata-rata: ${d.kraepelin.acc}%</span>
                    </div>
                    <button class="btn btn-outline btn-lihat-grafik" data-jenis="kraepelin" style="padding: 6px 12px; font-size: 12px;">Lihat Grafik</button>
                  </div>

                  <div class="trow">
                    <div class="applicant-info">
                      <div class="ap-avatar" style="background: rgba(245,158,11,0.2); color: var(--accent);">D</div>
                      <div><div class="ap-name">DISC Personality Test</div><div class="ap-pos">Gaya Komunikasi</div></div>
                    </div>
                    <div class="cell">Kepribadian</div>
                    <div class="cell"><strong>${d.disc.peserta}</strong> <span style="font-size:11px; color:var(--muted);">Orang</span></div>
                    <div class="cell">
                      <strong style="color:var(--accent);">Mayoritas: ${d.disc.maj} (${d.disc.pct1}%)</strong><br>
                      <span style="font-size:11px; color:var(--muted);">Diikuti oleh ${d.disc.sub} (${d.disc.pct2}%)</span>
                    </div>
                    <button class="btn btn-outline btn-lihat-grafik" data-jenis="disc" style="padding: 6px 12px; font-size: 12px;">Lihat Grafik</button>
                  </div>

                  <div class="trow">
                    <div class="applicant-info">
                      <div class="ap-avatar" style="background: rgba(16,185,129,0.2); color: var(--accent3);">P</div>
                      <div><div class="ap-name">PAPI Kostick Test</div><div class="ap-pos">Preferensi Gaya Kerja</div></div>
                    </div>
                    <div class="cell">Perilaku & Kepemimpinan</div>
                    <div class="cell"><strong>${d.papi.peserta}</strong> <span style="font-size:11px; color:var(--muted);">Orang</span></div>
                    <div class="cell">
                      <strong style="color:var(--accent3);">Peran Kepemimpinan (L): ${d.papi.l_score}/10</strong><br>
                      <span style="font-size:11px; color:var(--muted);">Ketaatan Aturan (W): ${d.papi.w_score}/10</span>
                    </div>
                    <button class="btn btn-outline btn-lihat-grafik" data-jenis="papi" style="padding: 6px 12px; font-size: 12px;">Lihat Grafik</button>
                  </div>
              `;
          }
      } catch (err) {
          laporanPsikogramBody.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--danger);">Gagal memuat data dari server.</div>';
      }
  }

  fetchLaporanPsikogram();

  // B. FUNGSI RENDER GRAFIK (DATA NYATA)
  document.addEventListener('click', function(e) {
      const btn = e.target.closest('.btn-lihat-grafik');
      if (!btn || !grafikModal) return;
      
      const jenis = btn.getAttribute('data-jenis');
      const targetData = dataGrafikDinamic[jenis];
      const modalBody = document.querySelector('#grafikModal .modal-body');

      // 1. VALIDASI DATA KOSONG (0 Peserta)
      if (!targetData || targetData.peserta === 0) {
          grafikModalTitle.innerText = "Data Belum Tersedia";
          grafikKeterangan.innerText = "Sistem memerlukan minimal 1 pelamar untuk menggenerasi grafik analitik.";
          
          if (chartInstance) chartInstance.destroy();
          modalBody.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:var(--muted); font-size: 14px;">
               <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" width="40" height="40" style="margin-bottom:15px; opacity:0.5;"><path d="M21 21H3v-2h18v2zM3 15h18v2H3v-2zM3 9h18v2H3V9zM3 3h18v2H3V3z"/></svg>
               Belum ada peserta yang menyelesaikan alat tes ini.
            </div>`;
          
          grafikModal.classList.add('show');
          return;
      }

      // 2. RENDER KANVAS GRAFIK & WADAH KETERANGAN
      modalBody.style.height = 'auto'; 
      modalBody.style.minHeight = '400px';
      modalBody.style.flexDirection = 'column';
      modalBody.style.alignItems = 'center';
      
      modalBody.innerHTML = `
        <div style="width: 100%; height: 350px; position: relative;">
            <canvas id="canvasGrafik"></canvas>
        </div>
        <div id="grafikLegend" style="width: 100%;"></div>
      `;
      
      const newCtx = document.getElementById('canvasGrafik');
      const legendContainer = document.getElementById('grafikLegend');
      if (chartInstance) chartInstance.destroy();
      
      let chartConfig = {};

      if (jenis === 'kraepelin') {
          legendContainer.innerHTML = ''; // Kosongkan keterangan bawah
          grafikModalTitle.innerText = "Kurva Rata-Rata Ketahanan Kerja (Kraepelin)";
          grafikKeterangan.innerText = "Grafik menunjukkan rata-rata stabilitas kecepatan menjumlahkan angka dari seluruh pelamar.";
          chartConfig = {
            type: 'line',
            data: {
              labels: ['Int 1', 'Int 2', 'Int 3', 'Int 4', 'Int 5', 'Int 6', 'Int 7', 'Int 8', 'Int 9', 'Int 10'],
              datasets: [{ label: 'Rata-rata Baris Terjawab', data: targetData.chartData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)', borderWidth: 3, tension: 0.3, fill: true }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
          };
      } else if (jenis === 'disc') {
          legendContainer.innerHTML = ''; // Kosongkan keterangan bawah
          grafikModalTitle.innerText = "Distribusi Rata-Rata Kepribadian (DISC)";
          grafikKeterangan.innerText = "Menunjukkan persentase rata-rata kecenderungan gaya komunikasi seluruh pelamar.";
          chartConfig = {
            type: 'bar',
            data: {
              labels: ['Dominance (D)', 'Influence (I)', 'Steadiness (S)', 'Compliance (C)'],
              datasets: [{ label: 'Persentase Populasi (%)', data: targetData.chartData, backgroundColor: ['rgba(239, 68, 68, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(59, 130, 246, 0.8)'], borderRadius: 8 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
          };
      } else if (jenis === 'papi') {
          grafikModalTitle.innerText = "Roda Rata-Rata Dimensi Kepribadian (PAPI Kostick)";
          grafikKeterangan.innerText = "Rata-rata pemetaan 20 dimensi perilaku kerja pelamar.";
          
          // --- MUNCULKAN KAMUS PAPI KOSTICK KETIKA GRAFIK PAPI DIBUKA ---
          legendContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: var(--muted); margin-top: 15px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px dashed var(--border); text-align: left;">
                <div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">G:</strong> Pekerja Keras Ekstrem</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">L:</strong> Pemimpin / Leadership</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">I:</strong> Membuat Keputusan</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">T:</strong> Cepat Tanggap</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">V:</strong> Stamina Fisik Tinggi</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">S:</strong> Negosiasi & Sosial</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">R:</strong> Teoretis & Pemikir</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">D:</strong> Tegas & Berani</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">C:</strong> Rapi & Terstruktur</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">E:</strong> Emosi Stabil & Tenang</div>
                </div>
                <div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">N:</strong> Gigih Selesaikan Masalah</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">A:</strong> Ambisius & Orientasi Target</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">P:</strong> Mengatur Orang Lain</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">X:</strong> Butuh Perhatian / Panggung</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">B:</strong> Ingin Diterima Kelompok</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">O:</strong> Dekat Secara Personal</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">K:</strong> Agresif / Kompetitif</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">F:</strong> Loyal pada Atasan</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">W:</strong> Taat Aturan & SOP Mutlak</div>
                    <div style="margin-bottom:4px;"><strong style="color:#10b981;">Z:</strong> Butuh Inovasi & Perubahan</div>
                </div>
            </div>
          `;

          chartConfig = {
            type: 'radar',
            data: {
              labels: ['G', 'L', 'I', 'T', 'V', 'S', 'R', 'D', 'C', 'E', 'N', 'A', 'P', 'X', 'B', 'O', 'K', 'F', 'W', 'Z'],
              datasets: [{ label: 'Skor Rata-Rata', data: targetData.chartData, backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', pointBackgroundColor: '#10b981', borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { color: 'rgba(255,255,255,0.1)' }, grid: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { font: { size: 10 } }, ticks: { display: false, min: 0, max: 10 } } }, plugins: { legend: { display: false } } }
          };
      }

      chartInstance = new Chart(newCtx, chartConfig);
      grafikModal.classList.add('show');
  });

  const tutupGrafikModal = () => { if(grafikModal) grafikModal.classList.remove('show'); }
  if(closeGrafikModal) closeGrafikModal.addEventListener('click', tutupGrafikModal);
  window.addEventListener('click', (e) => { if(e.target === grafikModal) tutupGrafikModal(); });

// ─── 15. LOGIKA TAMBAH KUIS BARU (ADMIN) ───
  const btnOpenAddModal = document.getElementById('btnOpenAddModal');
  const addQuizModal = document.getElementById('addQuizModal');
  const closeAddQuizModal = document.getElementById('closeAddQuizModal');
  const addQuizForm = document.getElementById('addQuizForm');

  // A. Buka Modal
  if (btnOpenAddModal && addQuizModal) {
      btnOpenAddModal.addEventListener('click', () => {
          addQuizModal.classList.add('show');
      });
  }

  // B. Tutup Modal
  const closeAddModal = () => { if(addQuizModal) addQuizModal.classList.remove('show'); };
  if (closeAddQuizModal) closeAddQuizModal.addEventListener('click', closeAddModal);
  window.addEventListener('click', (e) => { if (e.target === addQuizModal) closeAddModal(); });

  // C. Eksekusi Pengiriman Data ke Node.js
  if (addQuizForm) {
      addQuizForm.addEventListener('submit', async (e) => {
          e.preventDefault(); 

          const btnSimpan = document.getElementById('btnSimpanKuisBaru');
          
          // --- KUMPULKAN ARRAY TARGET POSISI ---
          let targetPosisiArray = [];
          const chkSemua = document.getElementById('chkSemuaPosisiAdd');
          if (chkSemua && chkSemua.checked) {
              targetPosisiArray.push('Semua Posisi');
          } else {
              document.querySelectorAll('.chk-job-target-add:checked').forEach(chk => {
                  targetPosisiArray.push(chk.value);
              });
          }

          if (targetPosisiArray.length === 0) {
              return alert("Gagal: Anda wajib memilih minimal satu Target Posisi Pekerjaan atau centang 'Semua Posisi'.");
          }

          // 1. Kumpulkan Data (Payload)
          const payload = {
              nama_kuis: document.getElementById('inputNamaKuis').value,
              rumpun_ilmu: document.getElementById('inputRumpun').value,
              pohon_ilmu: document.getElementById('inputPohon').value,      
              program_studi: document.getElementById('inputPosisi').value,  
              
              // Ini untuk tampilan tabel lama:
              target_posisi: targetPosisiArray.includes('Semua Posisi') ? 'Semua Posisi' : 'Multipel Posisi', 
              
              // INI YANG BARU UNTUK PIVOT TABLE:
              target_posisi_array: targetPosisiArray, 

              durasi_menit: parseInt(document.getElementById('inputDurasi').value),
              jumlah_soal: parseInt(document.getElementById('inputJmlSoal').value),
              jadwal_ujian: document.getElementById('inputJadwal').value
          };

          // 2. VALIDASI KEKOSONGAN
          if (!payload.rumpun_ilmu || !payload.pohon_ilmu || !payload.program_studi) {
              return alert("Pastikan Anda mengisi Rumpun, Pohon, dan Program Studi dengan lengkap!");
          }

          // 4. LOLOS VALIDASI -> Baru ubah tombol jadi loading
          btnSimpan.innerText = "Menyimpan...";
          btnSimpan.disabled = true;

          try {
              const response = await fetch('http://localhost:3000/api/admin/kuis', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
              });

              const result = await response.json();

              if (result.success) {
                  const successModal = document.getElementById('successAddQuizModal');
                  const btnOkSuccess = document.getElementById('btnOkSuccessQuiz');
                  
                  if (successModal && btnOkSuccess) {
                      successModal.classList.add('show'); 
                      btnOkSuccess.onclick = () => {
                          successModal.classList.remove('show');
                          closeAddModal();
                          addQuizForm.reset(); 
                          fetchKuis(); // Refresh tabel
                      };
                  } else {
                      alert("Berhasil! Assessment baru telah ditambahkan.");
                      closeAddModal();
                      addQuizForm.reset(); 
                      fetchKuis(); 
                  }
              } else {
                  // Gagal Simpan -> Panggil Pop-up Warning
                  const wText = document.getElementById('warningModalText');
                  const wModal = document.getElementById('warningModal');
                  if(wText && wModal) {
                      wText.innerText = "Gagal menyimpan kuis: " + result.message;
                      wModal.classList.add('show');
                  } else {
                      alert("Gagal menyimpan kuis: " + result.message);
                  }
              }
          } catch (error) {
              console.error("Gagal mengirim data:", error);
              // Error Jaringan -> Panggil Pop-up Warning
              const wText = document.getElementById('warningModalText');
              const wModal = document.getElementById('warningModal');
              if(wText && wModal) {
                  wText.innerText = "Terjadi kesalahan koneksi ke server Node.js.";
                  wModal.classList.add('show');
              } else {
                  alert("Terjadi kesalahan koneksi ke server Node.js.");
              }
          } finally {
              // 5. Apapun yang terjadi (sukses/gagal), kembalikan tombol seperti semula
              btnSimpan.innerText = "Simpan Kuis";
              btnSimpan.disabled = false;
          }
      });
  }

  // ─── 16. LOGIKA LEADERBOARD TOP 5 (PERFORMA KUIS) ───
  const leaderboardModal = document.getElementById('leaderboardModal');
  const closeLeaderboardModal = document.getElementById('closeLeaderboardModal');

  // A. Fungsi Penutup Modal
  const tutupLeaderboard = () => { if(leaderboardModal) leaderboardModal.classList.remove('show'); };
  if(closeLeaderboardModal) closeLeaderboardModal.addEventListener('click', tutupLeaderboard);
  window.addEventListener('click', (e) => { if (e.target === leaderboardModal) tutupLeaderboard(); });

  // B. Fungsi Utama yang dipanggil saat tombol mata diklik
  window.showLeaderboard = async function(kuisId, kuisNama) {
      const listContainer = document.getElementById('leaderboardList');
      document.getElementById('leaderboardQuizName').innerText = kuisNama;
      
      // Munculkan tulisan loading
      listContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--muted);">Memuat data juara...</div>';
      leaderboardModal.classList.add('show');
      
      try {
          // Tarik data dari API
          const response = await fetch(`http://localhost:3000/api/admin/kuis/${kuisId}/top5`);
          const result = await response.json();
          
          if (result.success) {
              if (result.data.length === 0) {
                  listContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--muted);">Belum ada pelamar yang menyelesaikan kuis ini.</div>';
                  return;
              }
              
              let html = '';
              result.data.forEach((pelamar, index) => {
                  let trophyIcon = '';
                  let rankStyle = 'color: var(--muted); font-weight: bold; font-size: 16px; width: 30px; text-align: center;';
                  
                  // SVGs Piala dengan warna berbeda
                  const pialaSVG = (color) => `<svg fill="${color}" viewBox="0 0 24 24" width="22" height="22"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

                  if (index === 0) { // Juara 1: Emas
                      trophyIcon = pialaSVG('#f59e0b');
                      rankStyle = 'color: #f59e0b; font-weight: 800; font-size: 20px; width: 30px; text-align: center;';
                  } else if (index === 1) { // Juara 2: Perak
                      trophyIcon = pialaSVG('#9ca3af');
                      rankStyle = 'color: #9ca3af; font-weight: 700; font-size: 18px; width: 30px; text-align: center;';
                  } else if (index === 2) { // Juara 3: Perunggu/Tembaga
                      trophyIcon = pialaSVG('#b45309');
                      rankStyle = 'color: #b45309; font-weight: 700; font-size: 18px; width: 30px; text-align: center;';
                  }
                  
                  // Cetak baris pemenang
                  html += `
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px 25px; border-bottom: 1px solid rgba(255,255,255,0.05); background: ${index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'};">
                          <div style="display: flex; align-items: center; gap: 15px;">
                              <div style="${rankStyle}">${index + 1}</div>
                              <div style="width: 25px; display: flex; justify-content: center;">${trophyIcon}</div>
                              <div style="font-weight: 600; color: #fff; font-size: 15px;">${pelamar.nama}</div>
                          </div>
                          <div style="font-weight: 800; color: var(--accent3); font-size: 18px;">${pelamar.skor}</div>
                      </div>
                  `;
              });
              listContainer.innerHTML = html;
          }
      } catch (err) {
          listContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--danger);">Gagal memuat data. Pastikan server Node.js aktif.</div>';
      }
  };

 // ─── 17. LOGIKA DROPDOWN PROFIL & POP-UP LOGOUT (ADMIN) ───
  const adminProfileBtn = document.getElementById('adminProfileBtn');
  const adminDropdown = document.getElementById('adminDropdown');
  const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');
  
  const logoutConfirmModal = document.getElementById('logoutConfirmModal');
  const btnCancelLogout = document.getElementById('btnCancelLogout');
  const btnConfirmLogout = document.getElementById('btnConfirmLogout');

  // A. Buka/Tutup Dropdown
  if (adminProfileBtn && adminDropdown) {
    adminProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      adminDropdown.style.display = adminDropdown.style.display === 'block' ? 'none' : 'block';
    });
  }

  // B. Tutup Dropdown jika klik di luar
  window.addEventListener('click', (e) => {
    if (adminDropdown && adminProfileBtn && !adminProfileBtn.contains(e.target)) {
      adminDropdown.style.display = 'none';
    }
  });

  // C. Klik Keluar -> Munculkan Modal Merah
  if (btnLogoutAdmin) {
    btnLogoutAdmin.addEventListener('click', (e) => {
      e.preventDefault();
      if (logoutConfirmModal) logoutConfirmModal.classList.add('show');
      if (adminDropdown) adminDropdown.style.display = 'none'; // Sembunyikan dropdown
    });
  }

  // D. Klik Batal di Modal
  if (btnCancelLogout) {
    btnCancelLogout.addEventListener('click', () => {
      if (logoutConfirmModal) logoutConfirmModal.classList.remove('show');
    });
  }

  // E. Klik "Ya, Keluar"
  if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', () => {
      localStorage.removeItem('talentflow_user');
      window.location.href = '../index.html'; // Arahkan ke halaman login
    });
  }

  // ─── 18. LOGIKA MANAJEMEN BANK SOAL (ENDLESS JSON & SCROLLBOX) ───
  const scrollableQuizList = document.getElementById('scrollableQuizList');
  const listSoalContainer = document.getElementById('listSoalContainer');
  const modalFormSoal = document.getElementById('modalFormSoal');
  const btnTambahSoal = document.getElementById('btnTambahSoal');
  const closeModalSoal = document.getElementById('closeModalSoal');
  const btnSimpanSoal = document.getElementById('btnSimpanSoal');
  const inpTipeSoal = document.getElementById('inpTipeSoal');
  const pgOptionsContainer = document.getElementById('pgOptionsContainer');
  const dynamicOptionsWrapper = document.getElementById('dynamicOptionsWrapper');
  const btnAddOption = document.getElementById('btnAddOption');
  const inpKunci = document.getElementById('inpKunci');

  let activeKuisIdForBank = null; 

  // A. Tarik Daftar Kuis ke Scrollbox
  // A. Tarik Daftar Kuis ke Scrollbox (Dengan Indikator Keterisian Real-Time)
  // A. Tarik Daftar Kuis ke Scrollbox (Dengan EFEK SCROLL STACK)
  window.loadQuizListForBank = async function() {
      if (!scrollableQuizList) return;
      try {
          const res = await fetch('http://localhost:3000/api/admin/kuis');
          const result = await res.json();
          
          if(result.success) {
              scrollableQuizList.innerHTML = '';
              if(result.data.length === 0) {
                  scrollableQuizList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">Belum ada assessment dibuat.</div>';
                  return;
              }

              // Tarik jumlah soal NYATA dari database
              const quizzesWithRealCount = await Promise.all(result.data.map(async (kuis) => {
                  try {
                      const resSoal = await fetch(`http://localhost:3000/api/admin/soal/${kuis.id}`);
                      const soalResult = await resSoal.json();
                      const realCount = soalResult.success ? soalResult.data.length : 0;
                      return { ...kuis, realCount };
                  } catch (e) {
                      return { ...kuis, realCount: 0 };
                  }
              }));

              quizzesWithRealCount.forEach((kuis, index) => {
                  const isAktif = kuis.realCount >= kuis.jumlah_soal;
                  const targetStyle = isAktif ? 'color:#10b981; background:rgba(16,185,129,0.15);' : 'color:var(--danger); background:rgba(239,68,68,0.15);';

                  // LOGIKA BARU: Tarik data dinamis dari Pivot Table (sama seperti Dashboard utama)
                  const targetDisplay = kuis.target_posisi_dinamis || kuis.target_posisi || 'Belum Ditentukan';
                  const targetText = targetDisplay.length > 30 ? targetDisplay.substring(0, 30) + '...' : targetDisplay;

                  const item = document.createElement('div');
                  item.className = 'scroll-stack-card'; 
                  
                  const stickyTop = 10 + (index * 12);
                  item.style.top = `${stickyTop}px`;
                  item.style.zIndex = index + 1; 

                  item.innerHTML = `
                      <div style="display: flex; flex-direction: column; gap: 4px;">
                          <span style="font-weight:bold; color:var(--text); font-size: 15px;">${kuis.nama_kuis}</span>
                          <span style="font-size: 11px; color: var(--accent2);" title="${targetDisplay}">${targetText}</span>
                      </div>
                      <span style="font-size:12px; padding:6px 10px; border-radius:6px; font-weight:bold; ${targetStyle}">${kuis.realCount} / ${kuis.jumlah_soal} Terisi</span>
                  `;

                  item.onclick = function() {
                      scrollableQuizList.querySelectorAll('.scroll-stack-card').forEach(el => el.classList.remove('active-card'));
                      this.classList.add('active-card');
                      activeKuisIdForBank = kuis.id;
                      window.loadBankSoal(); 
                  };
                  scrollableQuizList.appendChild(item);
                  
                  if (index === 0) item.click();
              });

              // Beri ruang kosong di bawah agar kartu terakhir bisa digulir sampai atas
              const spacer = document.createElement('div');
              spacer.style.height = '80px';
              scrollableQuizList.appendChild(spacer);
          }
      } catch (e) {
          scrollableQuizList.innerHTML = '<div style="color:var(--danger); padding:15px; text-align:center;">Gagal memuat kuis.</div>';
      }
  };

  // B. Fungsi Opsi Dinamis (ENDLESS & BISA DIHAPUS)
  
  // Fungsi untuk menyusun ulang abjad (A, B, C...) setiap kali ada opsi ditambah/dihapus
  function refreshOptionLabels() {
      const rows = dynamicOptionsWrapper.children;
      inpKunci.innerHTML = ''; 
      
      for(let i=0; i<rows.length; i++) {
          const l = String.fromCharCode(65 + i); // Auto Generate A, B, C, dst.
          
          // 1. Update Teks Label (A., B., C.)
          rows[i].querySelector('.opt-label-text').innerText = `${l}.`;
          
          // 2. Update Atribut Input agar saat disave ke DB namanya benar
          const input = rows[i].querySelector('.inp-opsi-dinamis');
          input.setAttribute('data-label', l);
          input.placeholder = `Teks opsi ${l}`;
          
          // 3. Masukkan kembali ke Dropdown Kunci Jawaban
          const opt = document.createElement('option');
          opt.value = l;
          opt.innerText = `Opsi ${l}`;
          inpKunci.appendChild(opt);
      }
  }

  function resetAndRenderOptions(count) {
      dynamicOptionsWrapper.innerHTML = '';
      inpKunci.innerHTML = '';
      for(let i=0; i<count; i++) addSingleOption();
  }

  function addSingleOption() {
      const div = document.createElement('div');
      div.style.cssText = "display:flex; align-items:center; gap:10px; margin-bottom: 5px;";
      
      // Kita tambahkan tombol "X" merah di sebelah kanan input
      div.innerHTML = `
          <span class="opt-label-text" style="font-weight:bold; color:var(--muted); width: 20px;"></span>
          <input type="text" class="inp-opsi-dinamis" style="flex:1; padding:10px; background:var(--bg); border:1px solid var(--border); color:white; border-radius:6px;">
          <button type="button" class="btn-hapus-opsi" title="Hapus Opsi Ini" style="background: rgba(239,68,68,0.15); color: #ef4444; border: none; width: 42px; height: 42px; border-radius: 6px; cursor: pointer; display: grid; place-items: center; transition: 0.2s;">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
      `;
      
      // Logika saat tombol X ditekan
      div.querySelector('.btn-hapus-opsi').onclick = function() {
          // Cegah hapus jika opsi sisa 2 (Soal Pilihan Ganda minimal butuh A dan B)
          if (dynamicOptionsWrapper.children.length <= 2) {
              alert("Minimal harus ada 2 opsi jawaban!");
              return;
          }
          div.remove(); // Hapus baris ini dari layar
          refreshOptionLabels(); // Susun ulang abjad yang tersisa!
      };

      dynamicOptionsWrapper.appendChild(div);
      refreshOptionLabels(); // Panggil fungsi perapih setiap kali opsi baru lahir
  }

  if (btnAddOption) btnAddOption.onclick = () => { addSingleOption(); };


  // C. Tarik Soal dari Database MySQL (Support JSON format baru & lama)
  window.loadBankSoal = async function() {
      if(!activeKuisIdForBank || !listSoalContainer) return;
      listSoalContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--muted);">Memuat data soal...</div>';

      try {
          const res = await fetch(`http://localhost:3000/api/admin/soal/${activeKuisIdForBank}`);
          const result = await res.json();
          
          listSoalContainer.innerHTML = '';
          if (result.data.length === 0) {
              listSoalContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--muted); border: 1px dashed var(--border); border-radius: 12px;">Belum ada soal untuk Assessment ini.</div>';
              return;
          }

          result.data.forEach((soal, index) => {
              const div = document.createElement('div');
              div.style.cssText = "background: var(--surface); border: 1px solid var(--border); padding: 20px; border-radius: 12px;";
              
              const isEssay = soal.tipe_soal === 'Essay';
              const badgeHTML = isEssay ? `<span style="background: rgba(245,158,11,0.15); color: #f59e0b; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold;">Teks Uraian (Essay)</span>` : `<span style="background: rgba(59,130,246,0.15); color: var(--accent2); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold;">Pilihan Ganda</span>`;

              let opsiHTML = '';
              if (!isEssay) {
                  opsiHTML = `<div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; margin-top: 15px;">`;
                  let opsiObj = {};
                  
                  // 1. AIRBAG: Buka bungkus JSON berulang kali sampai benar-benar jadi Objek
                  if (soal.opsi_jawaban) {
                      try {
                          opsiObj = soal.opsi_jawaban;
                          // Jika datanya terbungkus string dua kali, terus parse sampai jadi objek asli
                          while (typeof opsiObj === 'string') {
                              opsiObj = JSON.parse(opsiObj);
                          }
                      } catch (error) {
                          console.error("Gagal membaca opsi_jawaban:", error);
                      }
                  } 
                  
                  // 2. FALLBACK: Jika format baru gagal, gunakan format kolom lama
                  if (!opsiObj || Object.keys(opsiObj).length === 0) {
                      opsiObj = {};
                      if(soal.opsi_a) opsiObj['A'] = soal.opsi_a;
                      if(soal.opsi_b) opsiObj['B'] = soal.opsi_b;
                      if(soal.opsi_c) opsiObj['C'] = soal.opsi_c;
                      if(soal.opsi_d) opsiObj['D'] = soal.opsi_d;
                  }

                  // 3. CETAK KE LAYAR (Berikan warna hijau & centang untuk kunci jawaban)
                  for (const [key, val] of Object.entries(opsiObj)) {
                      const isKey = soal.kunci_jawaban === key;
                      opsiHTML += `<div style="${isKey ? 'color:#10b981; font-weight:bold;' : 'color:var(--muted);'}">
                                      ${key}. ${val} ${isKey ? '✓' : ''}
                                   </div>`;
                  }
                  opsiHTML += `</div>`;
              }

              div.innerHTML = `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                      <div style="display: flex; gap: 10px; align-items: center;"><strong style="color: var(--text);">Soal #${result.data.length - index}</strong> ${badgeHTML}</div>
                      <button class="btn-hapus-soal" data-id="${soal.id}" style="background: transparent; border: none; color: var(--danger); cursor: pointer; font-weight: bold; font-size: 13px;">Hapus</button>
                  </div>
                  <p style="font-size: 15px; line-height: 1.5; color: var(--text); margin: 0;">${soal.pertanyaan}</p>${opsiHTML}
              `;
              listSoalContainer.appendChild(div);
          });

          document.querySelectorAll('.btn-hapus-soal').forEach(btn => {
              btn.addEventListener('click', async function() {
                  if(confirm('Yakin ingin menghapus soal ini?')) {
                      const id = this.getAttribute('data-id');
                      await fetch(`http://localhost:3000/api/admin/soal/${id}`, { method: 'DELETE' });
                      window.loadBankSoal(); 
                  }
              });
          });
      } catch (err) {
          listSoalContainer.innerHTML = '<div style="color:var(--danger); text-align:center;">Gagal memuat soal.</div>';
      }
  };

  // D. Event Buka Modal
  if (inpTipeSoal && pgOptionsContainer) {
      inpTipeSoal.addEventListener('change', function() {
          pgOptionsContainer.style.display = this.value === 'Essay' ? 'none' : 'flex';
      });
  }
  
  if (btnTambahSoal && modalFormSoal) {
      btnTambahSoal.addEventListener('click', () => {
          if (!activeKuisIdForBank) return alert("Pilih assessment terlebih dahulu!");
          if(inpTipeSoal) inpTipeSoal.value = 'Pilihan Ganda';
          if(pgOptionsContainer) pgOptionsContainer.style.display = 'flex';
          
          resetAndRenderOptions(4); // Default mulai 4 opsi A-D
          modalFormSoal.classList.add('show');
      });
  }
  
  const tutupModalSoal = () => { if(modalFormSoal) modalFormSoal.classList.remove('show'); };
  if (closeModalSoal) closeModalSoal.addEventListener('click', tutupModalSoal);

  // E. Simpan JSON ke Database
  if (btnSimpanSoal) {
      btnSimpanSoal.addEventListener('click', async () => {
          const isEssay = inpTipeSoal.value === 'Essay';
          let opsi_jawaban_obj = {};
          
          if (!isEssay) {
              document.querySelectorAll('.inp-opsi-dinamis').forEach(inp => {
                  if (inp.value.trim() !== '') opsi_jawaban_obj[inp.getAttribute('data-label')] = inp.value.trim();
              });
          }
          
          const payload = {
              kuis_id: activeKuisIdForBank,
              tipe_soal: inpTipeSoal.value,
              pertanyaan: document.getElementById('inpPertanyaan').value,
              
              // PERBAIKAN DI SINI: Bungkus dengan JSON.stringify()
              opsi_jawaban: isEssay ? null : JSON.stringify(opsi_jawaban_obj), 
              
              kunci_jawaban: isEssay ? '' : inpKunci.value
          };

          if (!payload.pertanyaan) return alert('Pertanyaan wajib diisi!');
          if (!isEssay && Object.keys(opsi_jawaban_obj).length < 2) return alert('Minimal 2 opsi jawaban harus diisi!');

          btnSimpanSoal.innerText = "Menyimpan..."; btnSimpanSoal.disabled = true;
          try {
              const res = await fetch('http://localhost:3000/api/admin/soal', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
              });
              const result = await res.json();
              if (result.success) {
                  document.getElementById('inpPertanyaan').value = '';
                  tutupModalSoal();
                  window.loadBankSoal(); 
              }
          } catch (error) {
              alert('Gagal menyimpan soal.');
          } finally {
              btnSimpanSoal.innerText = "Simpan ke Database"; btnSimpanSoal.disabled = false;
          }
      });
  }

  // ============================================================================
  // ─── TARIK REFERENSI ILMU 3 TINGKAT DARI DATABASE MySQL ───
  // ============================================================================
  let REFERENSI_ILMU = {}; 
  const inputRumpun = document.getElementById('inputRumpun');
  const inputPohon = document.getElementById('inputPohon');
  const inputPosisi = document.getElementById('inputPosisi');

  // 1. Fungsi menarik data dari Node.js API
  async function loadReferensiIlmu() {
      try {
          const res = await fetch('http://localhost:3000/api/admin/referensi-ilmu');
          const result = await res.json();
          if (result.success) {
              REFERENSI_ILMU = result.data;
              
              if (inputRumpun) {
                  inputRumpun.innerHTML = '<option value="">-- Pilih Rumpun --</option>';
                  Object.keys(REFERENSI_ILMU).forEach(rumpun => {
                      inputRumpun.innerHTML += `<option value="${rumpun}">${rumpun}</option>`;
                  });
              }
          }
      } catch (e) {
          console.error("Gagal menarik data Referensi Ilmu dari database:", e);
      }
  }

  // Panggil fungsi segera setelah halaman dimuat
  loadReferensiIlmu();

  // 2. TINGKAT 1: Jika Rumpun Berubah -> Isi Dropdown Pohon Ilmu
  if (inputRumpun && inputPohon && inputPosisi) {
      inputRumpun.addEventListener('change', function() {
          const selectedRumpun = this.value;
          
          inputPohon.innerHTML = '<option value="">-- Pilih Pohon Ilmu --</option>';
          inputPosisi.innerHTML = '<option value="">Pilih Pohon Dulu</option>';
          inputPosisi.disabled = true;
          
          if (selectedRumpun && REFERENSI_ILMU[selectedRumpun]) {
              inputPohon.disabled = false;
              Object.keys(REFERENSI_ILMU[selectedRumpun]).forEach(pohon => {
                  inputPohon.innerHTML += `<option value="${pohon}">${pohon}</option>`;
              });
          } else {
              inputPohon.disabled = true;
              inputPohon.innerHTML = '<option value="">Pilih Rumpun Dulu</option>';
          }
      });

      // 3. TINGKAT 2: Jika Pohon Berubah -> Isi Dropdown Program Studi (Cabang)
      inputPohon.addEventListener('change', function() {
          const selectedRumpun = inputRumpun.value;
          const selectedPohon = this.value;
          
          inputPosisi.innerHTML = '<option value="">-- Pilih Program Studi --</option>';

          if (selectedRumpun && selectedPohon && REFERENSI_ILMU[selectedRumpun][selectedPohon]) {
              inputPosisi.disabled = false;
              REFERENSI_ILMU[selectedRumpun][selectedPohon].forEach(cabang => {
                  inputPosisi.innerHTML += `<option value="${cabang}">${cabang}</option>`;
              });
          } else {
              inputPosisi.disabled = true;
          }
      });
  }

  // ============================================================================
  // ─── PERBAIKAN: HAPUS BUG "RUMPUN ILMU (BAHASA INGGRIS)" DARI DROPDOWN ───
  // ============================================================================
  const hapusBugJudulCSV = () => {
      if(!inputRumpun) return;
      const options = inputRumpun.querySelectorAll('option');
      options.forEach(opt => {
          // Jika menemukan tulisan judul CSV, tendang keluar dari dropdown!
          if(opt.value.toLowerCase().includes("bahasa inggris") || opt.value.toLowerCase() === "rumpun_ilmu") {
              opt.remove(); 
          }
      });
  };
  // Beri waktu 1 detik agar data termuat dulu, baru dibersihkan
  setTimeout(hapusBugJudulCSV, 1000); 


  // ============================================================================
  // ─── LOGIKA CHECKBOX TARGET POSISI MULTIPEL ───
  // ============================================================================
  const chkSemuaPosisiAdd = document.getElementById('chkSemuaPosisiAdd');
  const dynamicJobCheckboxesAdd = document.getElementById('dynamicJobCheckboxesAdd');

  async function loadJobTargets() {
      if (!dynamicJobCheckboxesAdd) return;
      try {
          const res = await fetch('http://localhost:3000/api/admin/pekerjaan');
          const result = await res.json();
          
          if (result.success) {
              dynamicJobCheckboxesAdd.innerHTML = '';
              result.data.forEach(job => {
                  const label = document.createElement('label');
                  label.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; color: #fff; font-size: 13px;';
                  label.innerHTML = `
                      <input type="checkbox" class="chk-job-target-add" value="${job.nama_posisi}">
                      ${job.nama_posisi}
                  `;
                  dynamicJobCheckboxesAdd.appendChild(label);
              });

              // Event: Jika "Semua Posisi" dicentang, matikan yang lain
              if (chkSemuaPosisiAdd) {
                  chkSemuaPosisiAdd.addEventListener('change', (e) => {
                      const isChecked = e.target.checked;
                      document.querySelectorAll('.chk-job-target-add').forEach(chk => {
                          chk.checked = false;
                          chk.disabled = isChecked; 
                      });
                  });
              }
          }
      } catch (err) {
          console.error("Gagal memuat target pekerjaan:", err);
      }
  }
  loadJobTargets();

// ============================================================================
// ─── DASHBOARD STATISTICS CONTROLLER (ISOLATED & AUTO-RUN) ───
// ============================================================================
(async function initDashboardData() {
    // 1. Cek apakah ini halaman dashboard. Jika bukan, matikan fungsi dengan aman.
    const elTotal = document.getElementById('dashTotalPelamar');
    if (!elTotal) return; 

    try {
        console.log("Menghubungi API Dashboard...");
        
        // 2. Tarik data dari server (Endpoint ini sudah ada di server.js Anda)
        const response = await fetch('http://localhost:3000/api/admin/dashboard-stats');
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();

        // 3. Masukkan data ke HTML
        if (result.success && result.data) {
            const stats = result.data;

            // Kartu Utama
            const elTotal = document.getElementById('dashTotalPelamar');
            if (elTotal) elTotal.innerText = stats.total_pelamar || 0;
            
            // --- KARTU KUIS SELESAI & TREN PERSENTASE HARIAN ---
            const elKuis = document.getElementById('dashKuisSelesai');
            if (elKuis) {
                elKuis.innerText = stats.total_kuis_selesai || 0;

                // Cari elemen bungkus luar kartu untuk menempelkan Badge Tren
                const cardBox = elKuis.closest('div'); // Membidik div pembungkus angka
                if (cardBox) {
                    cardBox.style.position = 'relative'; // Wajib agar badge bisa menempel di pojok
                    cardBox.style.display = 'flex';
                    cardBox.style.justifyContent = 'space-between';
                    cardBox.style.alignItems = 'center';

                    let trendBadge = document.getElementById('trendKuisBadge');
                    if (!trendBadge) {
                        trendBadge = document.createElement('div');
                        trendBadge.id = 'trendKuisBadge';
                        trendBadge.style.cssText = 'font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 20px; display: flex; align-items: center; gap: 4px;';
                        cardBox.appendChild(trendBadge);
                    }

                    // Format angka: 1 desimal jika ada koma (misal 1.5%), tapi buang .0 jika bulat (misal 2%)
                    let pct = parseFloat(stats.tren_kuis_selesai).toFixed(1);
                    if (pct.endsWith('.0')) pct = parseInt(pct);

                    // Buat teks perbandingan untuk pop-up (Tooltip)
                    const tooltipText = `Selesai Kemarin: ${stats.total_kuis_kemarin} | Hari Ini: ${stats.total_kuis_selesai}`;
                    trendBadge.setAttribute('title', tooltipText); // Munculkan pop-up saat hover
                    trendBadge.style.cursor = 'help'; // Ubah kursor jadi tanda tanya bantuan

                    // Pewarnaan Otomatis (Naik Hijau, Turun Merah, Tetap Abu-abu)
                    if (stats.tren_kuis_selesai > 0) {
                        trendBadge.style.background = 'rgba(16,185,129,0.15)';
                        trendBadge.style.color = '#10b981'; // Hijau
                        trendBadge.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" width="12" height="12"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> +${pct}%`;
                    } else if (stats.tren_kuis_selesai < 0) {
                        trendBadge.style.background = 'rgba(239,68,68,0.15)';
                        trendBadge.style.color = '#ef4444'; // Merah
                        trendBadge.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" width="12" height="12"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg> ${pct}%`;
                    } else {
                        trendBadge.style.background = 'rgba(255,255,255,0.05)';
                        trendBadge.style.color = 'var(--muted)'; // Abu-abu
                        trendBadge.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" width="12" height="12"><line x1="5" y1="12" x2="19" y2="12"/></svg> 0%`;
                    }
                }
            }

            // Kartu Skor & Lulus
            const elSkor = document.getElementById('dashRataSkor');
            if (elSkor) elSkor.innerText = stats.rata_rata_skor || 0;

            const elLulus = document.getElementById('dashLulusSeleksi');
            if (elLulus) elLulus.innerText = stats.lulus_seleksi || 0;

            // Teks Tambahan (Tulisan kecil & Badge sidebar)
            const elTerbaru = document.getElementById('statTerbaru');
            if (elTerbaru) elTerbaru.innerText = (stats.total_pelamar || 0) + " total";

            const elBadge = document.getElementById('statBadge');
            if (elBadge) elBadge.innerText = stats.total_pelamar || 0;

            // Teks Sambutan
            const welcomeSubtext = document.querySelector('.welcome-text p');
            if (welcomeSubtext) {
                welcomeSubtext.innerHTML = `Platform rekrutmen TalentFlow aktif. Terdapat <strong style="color:var(--accent)">${stats.pendaftar_baru} pendaftar baru</strong> hari ini yang menunggu verifikasi.`;
            }
        }
    } catch (error) {
        console.error("Gagal menarik data Dashboard:", error);
        elTotal.innerText = "Err"; // Tampilkan 'Err' jika server mati, bukan '...'
    }
})();

// ============================================================================
// ─── MESIN RENDER PERFORMA KUIS (DYNAMIC PROGRESS BARS) ───
// ============================================================================
(async function renderPerformaKuis() {
    const container = document.getElementById('performaKuisContainer');
    if (!container) return; // Hentikan jika bukan di halaman dashboard

    try {
        const response = await fetch('http://localhost:3000/api/admin/performa-kuis');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            container.innerHTML = ''; // Bersihkan teks loading
            
            // Palet warna untuk variasi progress bar (berulang otomatis)
            const colors = ['green', 'blue', 'yellow', 'purple', 'red'];

            result.data.forEach((kuis, index) => {
                // PERBAIKAN: Gunakan .nilai dan .nama agar cocok dengan server.js Anda!
                const avgSkor = kuis.nilai || 0; 
                const namaKuis = kuis.nama || "Kuis Tidak Dikenal";
                const colorClass = colors[index % colors.length];
                
                // Render HTML progress bar secara dinamis
                container.innerHTML += `
                  <div class="progress-item">
                    <div class="pi-head">
                        <span style="font-weight: 600; font-size: 13px;">${namaKuis}</span>
                        <span style="font-size: 12px; color: var(--soft);">${avgSkor}% avg</span>
                    </div>
                    <div class="pi-bar" style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 10px; overflow: hidden; margin-top: 6px;">
                        <div class="pi-fill ${colorClass}" style="width: ${avgSkor}%; height: 100%; transition: width 1s ease-in-out;"></div>
                    </div>
                  </div>
                `;
            });
        } else {
            container.innerHTML = '<div style="color: var(--muted); font-size: 13px; text-align: center; padding: 20px 0;">Belum ada modul kuis yang dibuat.</div>';
        }
    } catch (error) {
        console.error("Gagal merender performa kuis:", error);
        container.innerHTML = '<div style="color: #ef4444; font-size: 13px; text-align: center; padding: 20px 0;">Gagal memuat data dari server.</div>';
    }
})();

// ============================================================================
  // ─── 19. LOGIKA MANAJEMEN BANK SOAL DISC ───
  // ============================================================================
  const discModal = document.getElementById('discModal');
  const btnSaveDisc = document.getElementById('btnSaveDisc');
  const discTableBody = document.getElementById('discTableBody');

  // Helper Peringatan
  function showWarningPopup(pesan) {
      const wModal = document.getElementById('warningModal');
      const wText = document.getElementById('warningModalText');
      if (wModal && wText) {
          wText.innerText = pesan; wModal.classList.add('show');
      } else alert(pesan);
  }

  // A. Tarik & Render Data Soal DISC ke Tabel UI
  window.loadBankDisc = async function() {
      if (!discTableBody) return;
      discTableBody.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--muted);">Memuat data...</div>';
      
      try {
          const res = await fetch('http://localhost:3000/api/admin/soal-disc');
          const result = await res.json();
          
          if (result.success) {
              if (result.data.length === 0) {
                  discTableBody.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--muted); font-size: 13px;">Belum ada soal DISC yang ditambahkan.</div>';
                  return;
              }
              
              let html = '';
              result.data.forEach((soal, index) => {
                  let opsiHtml = '';
                  let opsiObj = {};
                  
                  // Parse JSON dengan aman
                  try {
                      opsiObj = typeof soal.opsi_jawaban === 'string' ? JSON.parse(soal.opsi_jawaban) : soal.opsi_jawaban;
                      while(typeof opsiObj === 'string') opsiObj = JSON.parse(opsiObj);
                  } catch(e) { console.error("Format JSON rusak:", e); }
                  
                  // Cetak 4 pernyataan dengan warna khusus untuk tiap Trait
                  for (const [trait, text] of Object.entries(opsiObj)) {
                      let color = 'var(--muted)';
                      if(trait === 'D') color = '#ef4444'; // Merah
                      if(trait === 'I') color = '#f59e0b'; // Kuning
                      if(trait === 'S') color = '#10b981'; // Hijau
                      if(trait === 'C') color = '#3b82f6'; // Biru
                      
                      opsiHtml += `<div style="margin-bottom: 6px; display: flex; gap: 10px; align-items: flex-start;">
                          <strong style="color:${color}; width:25px; flex-shrink: 0;">[${trait}]</strong> 
                          <span style="color:var(--text); font-size: 13px; line-height: 1.4;">${text}</span>
                      </div>`;
                  }
                  
                  html += `
                  <div class="trow" style="grid-template-columns: 50px 3fr 1fr 80px; padding: 20px 24px; align-items: flex-start;">
                      <div class="cell" style="font-weight:800; font-size:16px; color:var(--soft);">#${result.data.length - index}</div>
                      <div style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px; border: 1px dashed var(--border);">${opsiHtml}</div>
                      <div><span class="status-pill pill-done">Aktif</span></div>
                      <div style="text-align: right;">
                          <button class="action-btn btn-hapus-disc" data-id="${soal.id}" style="color: var(--danger); background: rgba(239,68,68,0.1); margin-left: auto;">
                              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                      </div>
                  </div>`;
              });
              
              discTableBody.innerHTML = html;
              
              // Event Listener Tombol Hapus
              document.querySelectorAll('.btn-hapus-disc').forEach(btn => {
                  btn.onclick = async function() {
                      if(confirm('Hapus permanen soal DISC ini?')) {
                          const id = this.getAttribute('data-id');
                          await fetch(`http://localhost:3000/api/admin/soal-disc/${id}`, { method: 'DELETE' });
                          window.loadBankDisc();
                      }
                  }
              });
          }
      } catch(e) {
          discTableBody.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--danger);">Gagal memuat data dari server.</div>';
      }
  };

  // Muat tabel saat file script dieksekusi
  window.loadBankDisc();

  // B. Buka / Tutup Modal
  window.openDiscModal = function() {
      document.querySelectorAll('.disc-statement-input').forEach(input => input.value = '');
      const selects = document.querySelectorAll('.disc-trait-select');
      if(selects.length === 4) {
          selects[0].value = 'D'; selects[1].value = 'I'; selects[2].value = 'S'; selects[3].value = 'C';
      }
      if(discModal) discModal.classList.add('show');
  };

  window.closeDiscModal = function() { if(discModal) discModal.classList.remove('show'); };
  window.addEventListener('click', (e) => { if (e.target === discModal) closeDiscModal(); });

  // C. Eksekusi Simpan Soal DISC
  if (btnSaveDisc) {
      btnSaveDisc.addEventListener('click', async () => {
          const selects = document.querySelectorAll('.disc-trait-select');
          const inputs = document.querySelectorAll('.disc-statement-input');
          
          let tetradData = {};
          let selectedTraits = [];
          let hasEmptyInput = false;

          for (let i = 0; i < 4; i++) {
              const trait = selects[i].value;
              const text = inputs[i].value.trim();
              if (text === '') hasEmptyInput = true;
              tetradData[trait] = text;
              selectedTraits.push(trait);
          }

          if (hasEmptyInput) return showWarningPopup("Seluruh 4 pernyataan wajib diisi!");

          const validTraits = selectedTraits.filter(t => t !== '*');
          const isDuplicate = new Set(validTraits).size !== validTraits.length;
          
          if (isDuplicate) return showWarningPopup("Gagal: Anda tidak boleh memilih trait kepribadian (D, I, S, C) yang sama lebih dari satu kali dalam satu soal!");

          // Payload diarahkan ke tabel DISC yang baru dibuat
          const payload = {
              pertanyaan: "Pilih satu pernyataan yang PALING SESUAI (Most) dan satu yang PALING TIDAK SESUAI (Least) dengan diri Anda.",
              opsi_jawaban: tetradData 
          };

          const originalText = btnSaveDisc.innerText;
          btnSaveDisc.innerText = "Menyimpan..."; btnSaveDisc.disabled = true;

          try {
              // Kirim ke endpoint khusus DISC
              const res = await fetch('http://localhost:3000/api/admin/soal-disc', {
                  method: 'POST', 
                  headers: { 'Content-Type': 'application/json' }, 
                  body: JSON.stringify(payload)
              });
              
              const result = await res.json();
              if (result.success || res.ok) {
                  const successModal = document.getElementById('successAddQuizModal');
                  const btnOkSuccess = document.getElementById('btnOkSuccessQuiz');
                  
                  if (successModal && btnOkSuccess) {
                      successModal.querySelector('p').innerText = "Soal DISC baru telah berhasil ditambahkan ke database.";
                      successModal.classList.add('show');
                      
                      btnOkSuccess.onclick = () => {
                          successModal.classList.remove('show');
                          closeDiscModal();
                          window.loadBankDisc(); // Refresh UI list secara otomatis
                      };
                  } else {
                      closeDiscModal();
                      window.loadBankDisc();
                  }
              } else {
                  showWarningPopup("Gagal menyimpan soal DISC: " + (result.message || "Kesalahan Server"));
              }
          } catch (error) {
              showWarningPopup("Terjadi kesalahan koneksi ke server Node.js.");
          } finally {
              btnSaveDisc.innerText = originalText; btnSaveDisc.disabled = false;
          }
      });
  }

  // ============================================================================
  // ─── 20. RENDER MODUL PSIKOTES AKTIF (SYSTEM-LEVEL MODULES) ───
  // ============================================================================
  function renderPsikotesModules() {
      const container = document.getElementById('psikotesTableBody');
      if (!container) return;

      const modules = [
          { id: 'kraepelin', initial: 'K', color: 'rgba(59,130,246,0.2)', text: 'var(--accent2)', name: 'Tes Kraepelin (Koran)', desc: 'Ketelitian, Kecepatan & Ketahanan Kerja', cat: 'Aptitude / Kinerja', dur: '20 Menit', rules: 'Interval per baris: 15 detik' },
          { id: 'disc', initial: 'D', color: 'rgba(245,158,11,0.2)', text: 'var(--accent)', name: 'DISC Personality Test', desc: 'Dominance, Influence, Steadiness, Compliance', cat: 'Kepribadian / Perilaku', dur: '15 Menit', rules: '24 Pertanyaan (Most/Least)' },
          { id: 'papi', initial: 'P', color: 'rgba(16,185,129,0.2)', text: 'var(--accent3)', name: 'PAPI Kostick Test', desc: 'Pemetaan 20 Dimensi Perilaku & Gaya Kerja', cat: 'Kepribadian / Perilaku', dur: '30 - 45 Menit', rules: '90 Pasang Pernyataan' }
      ];

      container.innerHTML = '';
      modules.forEach(mod => {
          // UBAH BAGIAN INI: Tambahkan style grid-template-columns 4 kolom dan HAPUS div tombol Aksi
          container.innerHTML += `
          <div class="trow kuis-row" style="grid-template-columns: 2.5fr 1fr 1.5fr 1fr;">
            <div class="applicant-info">
              <div class="ap-avatar" style="background: ${mod.color}; color: ${mod.text};">${mod.initial}</div>
              <div>
                <div class="ap-name">${mod.name}</div>
                <div class="ap-pos">${mod.desc}</div>
              </div>
            </div>
            <div class="cell">${mod.cat}</div>
            <div class="cell">
              <strong style="color:var(--text);">${mod.dur}</strong> 
              <span style="font-size:11px; display: block; margin-top: 4px; color: var(--muted);">${mod.rules}</span>
            </div>
            <div><span class="status-pill pill-done">Modul Sistem Aktif</span></div>
          </div>
          `;
      });
  }
  
  // Panggil fungsi saat halaman dimuat
  renderPsikotesModules();

  // ============================================================================
  // ─── MESIN FILTER STATUS PENDAFTAR ───
  // ============================================================================
  const filterStatusPendaftar = document.getElementById('filterStatusPendaftar');
  
  if (filterStatusPendaftar) {
      filterStatusPendaftar.addEventListener('change', function() {
          const statusDicari = this.value.toLowerCase();
          const barisPendaftar = document.querySelectorAll('#allApplicantTableBody .trow');

          barisPendaftar.forEach(baris => {
              const statusPill = baris.querySelector('.status-pill');
              if (!statusPill) return;

              const teksStatus = statusPill.innerText.toLowerCase();
              
              // Jika pilih "all", tampilkan semua. Jika cocok dengan teks status, tampilkan.
              if (statusDicari === 'all' || teksStatus.includes(statusDicari)) {
                  baris.style.display = '';
              } else {
                  baris.style.display = 'none';
              }
          });
      });
  }

}); // <-- Ini penutup utama file script.js