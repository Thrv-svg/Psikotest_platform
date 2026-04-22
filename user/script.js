document.addEventListener('DOMContentLoaded', async () => {
  // ─── 1. CEK SESI LOGIN & STRICT ROLE GUARD ───
  const userDataString = localStorage.getItem('talentflow_user');
  if (!userDataString) {
    alert("Anda harus login terlebih dahulu!");
    window.location.href = '../index.html'; 
    return;
  }

  const userData = JSON.parse(localStorage.getItem('talentflow_user'));
  const pelamarId = userData.pelamarId || userData.accountId;
  // ============================================================================
  // ─── SISTEM KONTROL AKSES & PEMILIHAN PEKERJAAN ALFABETIKAL ───
  // ============================================================================
  const userPosisiTitle = document.getElementById('userPosisiTitle');
  const stepPilihPekerjaan = document.getElementById('stepPilihPekerjaan');
  const stepAsesmen = document.getElementById('stepAsesmen');
  const jobSelectionSection = document.getElementById('jobSelectionSection');
  const assessmentSection = document.getElementById('assessmentSection');
  const alphabeticalJobContainer = document.getElementById('alphabeticalJobContainer');

  // 1. Cek Status Pekerjaan Pelamar Saat Ini
  async function checkJobStatus() {
      try {
          const res = await fetch(`http://localhost:3000/api/user/profil/${pelamarId}`);
          const result = await res.json();

          if (result.success) {
              const posisi = result.data.posisi_dilamar;

              if (!posisi || posisi === 'Belum Ditentukan') {
                  // KUNCI AKSES: Tampilkan Form Pekerjaan, Sembunyikan Asesmen
                  userPosisiTitle.innerText = "Belum Memilih Posisi";
                  userPosisiTitle.style.color = "var(--danger)";
                  stepPilihPekerjaan.classList.add('active');
                  stepPilihPekerjaan.classList.remove('done');
                  stepAsesmen.classList.remove('active');
                  
                  assessmentSection.style.display = 'none';
                  jobSelectionSection.style.display = 'block';
                  loadAlphabeticalJobs(); // Tarik data pekerjaan
              } else {
                  // BUKA AKSES: Sembunyikan Form Pekerjaan, Tampilkan Asesmen
                  userPosisiTitle.innerText = posisi;
                  userPosisiTitle.style.color = "var(--text)";
                  stepPilihPekerjaan.classList.replace('active', 'done');
                  stepAsesmen.classList.add('active');
                  
                  jobSelectionSection.style.display = 'none';
                  assessmentSection.style.display = 'block';
              }
          }
      } catch (err) {
          console.error("Gagal mengecek profil:", err);
      }
  }

  // 2. Tarik dan Kelompokkan Pekerjaan Berdasarkan Abjad
  async function loadAlphabeticalJobs() {
      try {
          const res = await fetch('http://localhost:3000/api/admin/pekerjaan');
          const result = await res.json();

          if (result.success && result.data.length > 0) {
              const jobs = result.data;
              const groupedJobs = {};

              // Kelompokkan berdasarkan huruf pertama
              jobs.forEach(job => {
                  const firstLetter = job.nama_posisi.charAt(0).toUpperCase();
                  if (!groupedJobs[firstLetter]) groupedJobs[firstLetter] = [];
                  groupedJobs[firstLetter].push(job);
              });

              // Urutkan Abjad (A-Z) dan Render HTML
              let html = '';
              Object.keys(groupedJobs).sort().forEach(letter => {
                  html += `
                  <div style="margin-bottom: 40px;">
                      <h2 style="color: var(--accent2); border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 20px; font-family: 'Syne'; font-size: 22px;">${letter}</h2>
                      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                  `;

                  groupedJobs[letter].forEach(job => {
                      // Menggunakan struktur border-glow-card bawaan CSS Anda
                      html += `
                          <div class="border-glow-card job-select-card" onclick="selectNewJob('${job.nama_posisi}')" style="cursor: pointer; margin-bottom: 0; height: 100%;">
                              <span class="edge-light"></span>
                              <div class="border-glow-inner" style="padding: 24px; height: 100%; display: flex; flex-direction: column; justify-content: center;">
                                  <h3 style="color: var(--text); font-size: 16px; margin-bottom: 8px;">${job.nama_posisi}</h3>
                                  <p style="color: var(--muted); font-size: 13px; line-height: 1.5; margin: 0;">${job.deskripsi}</p>
                              </div>
                          </div>
                      `;
                  });

                  html += `</div></div>`;
              });

              alphabeticalJobContainer.innerHTML = html;

              // HAPUS efek hover Javascript lama, karena CSS border-glow-card sudah menanganinya secara otomatis.

          } else {
              alphabeticalJobContainer.innerHTML = '<div style="color:var(--danger);">Belum ada data pekerjaan di database.</div>';
          }
      } catch (err) {
          console.error("Gagal menarik data pekerjaan:", err);
      }
  }

  // 3. Fungsi Eksekusi Pemilihan Pekerjaan
  window.selectNewJob = async function(namaPosisi) {
      if (!confirm(`Anda yakin ingin melamar posisi: ${namaPosisi}?\nPilihan ini tidak dapat diubah nanti.`)) return;

      try {
          const res = await fetch('http://localhost:3000/api/user/pilih-pekerjaan', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pelamar_id: pelamarId, posisi_dilamar: namaPosisi })
          });

          const result = await res.json();
          if (result.success) {
              alert("Berhasil! Posisi Anda telah dikunci. Modul Asesmen kini terbuka.");
              checkJobStatus(); // Refresh UI untuk membuka gembok
          } else {
              alert("Gagal menyimpan pilihan.");
          }
      } catch (err) {
          alert("Terjadi kesalahan server.");
      }
  };

  // Jalankan pengecekan saat halaman dimuat (setelah role guard)
  if (userData.role !== 'pelamar') {
    const deniedModal = document.getElementById('accessDeniedModal');
    if (deniedModal) {
      deniedModal.classList.add('show');
      let timeLeft = 3;
      setInterval(() => {
        timeLeft--;
        const span = document.getElementById('redirectCountdown');
        if(span) span.innerText = timeLeft;
        if (timeLeft <= 0) window.location.href = '../admin/index.html';
      }, 1000);
      const btnForce = document.getElementById('btnForceRedirect');
      if(btnForce) btnForce.onclick = () => window.location.href = '../admin/index.html';
    } else {
      window.location.href = '../admin/index.html';
    }
    return; 
  }

  // Jalankan pengecekan profil & pekerjaan (hanya untuk role pelamar)
  checkJobStatus();

  // ─── 2. UPDATE TAMPILAN PROFIL ───
  const namaDepan = userData.email.split('@')[0];
  const namaKapital = namaDepan.charAt(0).toUpperCase() + namaDepan.slice(1);
  const headerName = document.querySelector('.welcome-section h1');
  const profileName = document.querySelector('.user-profile span');
  const avatar = document.querySelector('.user-profile .avatar');
  if (headerName) headerName.innerText = `Halo, ${namaKapital}! 👋`;
  if (profileName) profileName.innerText = namaKapital;
  if (avatar) avatar.innerText = namaKapital.substring(0, 2).toUpperCase();

  // ─── 3. TARIK DAFTAR KUIS AKADEMIK DINAMIS & HAPUS YANG TDK AKTIF ───
  const akademikGrid = document.getElementById('akademikGrid');
  let quizButtons = []; // Akan kita isi setelah tombol selesai dicetak ke layar

  try {
    if (akademikGrid) {
      akademikGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 20px;">Memuat daftar asesmen...</div>';

      // Panggil API khusus Pelamar yang memfilter berdasarkan Posisi
      const resKuis = await fetch(`http://localhost:3000/api/user/kuis-tersedia/${pelamarId}`);
      const dataKuis = await resKuis.json();

      console.log("KUIS DARI API:", dataKuis); // Cek data di Console (F12)

      // WAJIB: Bersihkan container HANYA SEKALI sebelum loop dimulai
      akademikGrid.innerHTML = ''; 

      // Jika sukses dan ada data kuis
      if (dataKuis.success && dataKuis.data.length > 0) {
          
          const icons = [
              { bg: 'rgba(59,130,246,.15)', color: 'var(--accent2)', svg: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
              { bg: 'rgba(245,158,11,.15)', color: 'var(--accent)', svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
              { bg: 'rgba(16,185,129,.15)', color: 'var(--accent3)', svg: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' }
          ];

          dataKuis.data.forEach((kuis, index) => {
              const style = icons[index % icons.length];
              
              // kuis.jumlah_soal sekarang otomatis sinkron 100% dengan DB Backend
              akademikGrid.innerHTML += `
                <div class="border-glow-card quiz-card">
                  <span class="edge-light"></span>
                  <div class="border-glow-inner" style="display: flex; flex-direction: column; height: 100%;">
                    <div class="quiz-icon" style="background: ${style.bg}; color: ${style.color};">
                      <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${style.svg}</svg>
                    </div>
                    <h4>${kuis.nama_kuis}</h4>
                    <p>${kuis.jumlah_soal} Soal • Waktu: ${kuis.durasi_menit} Menit</p>
                    <button class="btn btn-primary start-quiz-btn" data-kuis-id="${kuis.id}" style="margin-top: auto;">Mulai Assessment</button>
                  </div>
                </div>
              `;
          });
          
          // NYALAKAN MESIN RADAR SETELAH KARTU SELESAI DICETAK
          setTimeout(initBorderGlow, 100);

      } else {
          // Jika array kosong (tidak ada kuis untuk posisi ini)
          akademikGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 40px; border: 1px dashed var(--border); border-radius: 12px; font-style: italic;">
              Tidak ada Assessment untuk posisi Anda saat ini.
            </div>
          `;
      }
    }
  } catch (e) {
    console.error("Gagal memuat kuis:", e);
    if(akademikGrid) akademikGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--danger);">Gagal terhubung ke server.</div>';
  }

  // ─── 4. PASANG NYAWA KE TOMBOL (Setelah Kuis Tercetak di Layar) ───
  quizButtons = document.querySelectorAll('.start-quiz-btn');
  quizButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      if (this.disabled) return; 

      const kuisId = parseInt(this.getAttribute('data-kuis-id'));
      localStorage.setItem('kuis_aktif_id', kuisId); 
      
      const quizName = this.parentElement.querySelector('h4').innerText;
      const modalQuizName = document.getElementById('modalQuizName');
      const modal = document.getElementById('quizModal');
      
      if(modalQuizName) modalQuizName.innerText = quizName;
      if(modal) modal.classList.add('show');
    });
  });

  // ─── 5. AMBIL STATUS DARI DATABASE & KUNCI YANG SUDAH SELESAI ───
  try {
    const response = await fetch(`http://localhost:3000/api/user/status-ujian/${pelamarId}`);
    const data = await response.json();

    if (data.success) {
      // A. Kunci Akademik
      quizButtons.forEach(button => {
        const kuisId = parseInt(button.getAttribute('data-kuis-id'));
        if (data.akademik_selesai.includes(kuisId)) {
          kunciKartu(button);
          localStorage.setItem(`kuis_done_${pelamarId}_${kuisId}`, 'true'); 
        } else {
          localStorage.removeItem(`kuis_done_${pelamarId}_${kuisId}`);
        }
      });

      // B. Kunci Kraepelin
      const btnKraepelin = document.getElementById('btnKraepelin');
      if (btnKraepelin) {
        if (data.kraepelin_selesai) {
          kunciKartu(btnKraepelin);
          localStorage.setItem(`kraepelin_done_${pelamarId}`, 'true'); 
        } else {
          localStorage.removeItem(`kraepelin_done_${pelamarId}`);
        }
      }

      // C. Kunci DISC (Baru ditambahkan)
      const btnDisc = document.getElementById('btnDisc');
      if (btnDisc) {
        if (data.disc_selesai) {
          kunciKartu(btnDisc);
          localStorage.setItem(`disc_done_${pelamarId}`, 'true'); 
        } else {
          localStorage.removeItem(`disc_done_${pelamarId}`);
        }
      }

      // D. Kunci PAPI Kostick (Baru ditambahkan)
      const btnPapi = document.getElementById('btnPapi');
      if (btnPapi) {
        if (data.papi_selesai) {
          kunciKartu(btnPapi);
          localStorage.setItem(`papi_done_${pelamarId}`, 'true'); 
        } else {
          localStorage.removeItem(`papi_done_${pelamarId}`);
        }
      }
    }
  } catch (error) {
    console.error("Gagal mengambil status kuis dari DB:", error);
    // Fallback ambil dari localstorage jika koneksi putus
    quizButtons.forEach(button => {
      const kuisId = parseInt(button.getAttribute('data-kuis-id'));
      if (localStorage.getItem(`kuis_done_${pelamarId}_${kuisId}`)) kunciKartu(button);
    });
    
    const btnKraepelin = document.getElementById('btnKraepelin');
    if (btnKraepelin && localStorage.getItem(`kraepelin_done_${pelamarId}`)) kunciKartu(btnKraepelin);

    const btnDisc = document.getElementById('btnDisc');
    if (btnDisc && localStorage.getItem(`disc_done_${pelamarId}`)) kunciKartu(btnDisc);

    const btnPapi = document.getElementById('btnPapi');
    if (btnPapi && localStorage.getItem(`papi_done_${pelamarId}`)) kunciKartu(btnPapi);
  }

  // ─── 4.5. TARIK JUMLAH SOAL DISC DINAMIS ───
  const discQuestionCountEl = document.getElementById('discQuestionCount');
  if (discQuestionCountEl) {
      try {
          // Kita meminjam endpoint yang sama yang digunakan untuk meload soal DISC
          const resDisc = await fetch('http://localhost:3000/api/user/soal-disc');
          const dataDisc = await resDisc.json();
          if (dataDisc.success) {
              discQuestionCountEl.innerText = dataDisc.data.length;
          } else {
              discQuestionCountEl.innerText = "0";
          }
      } catch (e) {
          console.error("Gagal mengambil jumlah soal DISC:", e);
          discQuestionCountEl.innerText = "-";
      }
  }

  // ─── FUNGSI SAPU BERSIH (EKSEKUTOR GEMBOK) ───
  function kunciKartu(btn) {
    btn.innerText = 'Sudah Dikerjakan';
    btn.removeAttribute('href');
    btn.disabled = true; 
    btn.style.background = 'transparent';
    btn.style.border = '1px solid #1f2d45';
    btn.style.color = '#8fa0be';
    btn.style.cursor = 'not-allowed';
    btn.style.pointerEvents = 'none';

    const card = btn.closest('.quiz-card');
    if (card) {
      card.classList.remove('disabled'); 
      card.classList.add('disabled-card'); 
      card.style.cursor = 'not-allowed';
    }
  }

  // ─── 6. LOGIKA MODAL KONFIRMASI KUIS ───
  const modal = document.getElementById('quizModal');
  const closeModalIcon = document.getElementById('closeModalIcon');
  const cancelQuizBtn = document.getElementById('cancelQuizBtn');
  const confirmQuizBtn = document.getElementById('confirmQuizBtn');

  const closeModal = () => { if(modal) modal.classList.remove('show'); };
  
  if(closeModalIcon) closeModalIcon.addEventListener('click', closeModal);
  if(cancelQuizBtn) cancelQuizBtn.addEventListener('click', closeModal);
  window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  if(confirmQuizBtn) {
    confirmQuizBtn.addEventListener('click', () => {
      confirmQuizBtn.innerText = "Menyiapkan Asesmen...";
      confirmQuizBtn.style.opacity = "0.7";
      confirmQuizBtn.style.cursor = "not-allowed";
      setTimeout(() => { window.location.href = 'kuis/kuis.html'; }, 1000);
    });
  }

  // ─── 7. LOGIKA DROPDOWN PROFIL & POP-UP LOGOUT ───
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdown = document.getElementById('userDropdown');
  const btnLogoutUser = document.getElementById('btnLogoutUser');
  const logoutConfirmModal = document.getElementById('logoutConfirmModal');
  const btnCancelLogout = document.getElementById('btnCancelLogout');
  const btnConfirmLogout = document.getElementById('btnConfirmLogout');

  if (userProfileBtn && userDropdown) {
    userProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation(); 
      userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
    });
  }

  window.addEventListener('click', (e) => {
    if (userDropdown && userProfileBtn && !userProfileBtn.contains(e.target)) {
      userDropdown.style.display = 'none';
    }
  });

  if (btnLogoutUser) {
    btnLogoutUser.addEventListener('click', (e) => {
      e.preventDefault();
      if (logoutConfirmModal) logoutConfirmModal.classList.add('show');
      if (userDropdown) userDropdown.style.display = 'none'; 
    });
  }

  if (btnCancelLogout) {
    btnCancelLogout.addEventListener('click', () => {
      if (logoutConfirmModal) logoutConfirmModal.classList.remove('show');
    });
  }

  if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', () => {
      localStorage.removeItem('talentflow_user'); 
      window.location.href = '../index.html'; 
    });
  }
});

// ============================================================================
// ─── MESIN RADAR BORDER GLOW (VANILLA JS) ───
// ============================================================================
function initBorderGlow() {
    const cards = document.querySelectorAll('.border-glow-card');
    if (cards.length === 0) return;

    // Warna efek: Ungu, Pink, Biru Muda
    const glowColorHSL = '40 80 80'; 
    const colors = ['#c084fc', '#f472b6', '#38bdf8']; 
    const gradPos = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
    const gradKeys = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
    const colMap = [0, 1, 2, 0, 1, 2, 1];

    const h = 40, s = 80, l = 80;
    const baseHSL = `${h}deg ${s}% ${l}%`;
    const opacities = [100, 60, 50, 40, 30, 20, 10];
    const opKeys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];

    cards.forEach(card => {
        // Cegah pemasangan event listener ganda
        if(card.dataset.glowInitialized) return;
        card.dataset.glowInitialized = "true";

        // Suntik Variabel CSS
        opacities.forEach((op, i) => {
            card.style.setProperty(`--glow-color${opKeys[i]}`, `hsl(${baseHSL} / ${op}%)`);
        });
        gradKeys.forEach((key, i) => {
            const c = colors[colMap[i]];
            card.style.setProperty(key, `radial-gradient(at ${gradPos[i]}, ${c} 0px, transparent 50%)`);
        });
        card.style.setProperty('--gradient-base', `linear-gradient(${colors[0]} 0 100%)`);

        // Radar Mouse
        card.addEventListener('pointermove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const cx = rect.width / 2;
            const cy = rect.height / 2;

            const dx = x - cx;
            const dy = y - cy;

            let kx = Infinity, ky = Infinity;
            if (dx !== 0) kx = cx / Math.abs(dx);
            if (dy !== 0) ky = cy / Math.abs(dy);
            const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

            let degrees = 0;
            if (dx !== 0 || dy !== 0) {
                degrees = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
                if (degrees < 0) degrees += 360;
            }

            card.style.setProperty('--edge-proximity', (edge * 100).toFixed(3));
            card.style.setProperty('--cursor-angle', `${degrees.toFixed(3)}deg`);
        });

        // Matikan efek saat mouse pergi
        card.addEventListener('pointerleave', () => {
            card.style.setProperty('--edge-proximity', '0');
        });
    });
}