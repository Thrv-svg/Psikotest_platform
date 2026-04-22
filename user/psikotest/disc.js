document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. OTENTIKASI & SETUP AWAL ---
    const userDataString = localStorage.getItem('talentflow_user');
    if (!userDataString) return window.location.href = '../../index.html';
    
    const userData = JSON.parse(userDataString);
    const pelamarId = userData.pelamarId || userData.accountId || userData.id;

    let daftarSoal = [];
    let jawabanUser = {}; // Format: { 0: { most: 'D', least: 'S' } }
    let indeksSekarang = 0;
    let waktuTersisa = 15 * 60; // 15 Menit default untuk DISC
    let gameInterval;

    const elAreaPertanyaan = document.getElementById('areaPertanyaan');
    const tetradContainer = document.getElementById('tetradContainer');
    const btnNext = document.getElementById('btnNext');
    const btnPrev = document.getElementById('btnPrev');
    const btnSubmit = document.getElementById('btnSubmit');

    // --- 2. AMBIL DATA SOAL DARI SERVER ---
    try {
        const response = await fetch(`http://localhost:3000/api/user/soal-disc`);
        const result = await response.json();
        
        if (!result.success) throw new Error("Gagal mengambil soal");

        daftarSoal = result.data;
        
        if(daftarSoal.length > 0) {
            elAreaPertanyaan.style.display = 'block';
            buatGridNavigasi();
            renderSoal(0);
            mulaiTimer();
        } else {
            elAreaPertanyaan.style.display = 'block';
            elAreaPertanyaan.innerHTML = '<div style="text-align:center; color:var(--muted); padding: 50px;">HRD belum memasukkan soal DISC.</div>';
        }
    } catch (err) {
        showPopUp('error', 'Koneksi Gagal', 'Gagal memuat soal DISC dari database.');
    }

    // --- 3. LOGIKA RENDER TETRAD (MOST/LEAST) ---
    function renderSoal(index) {
        const soal = daftarSoal[index];
        document.getElementById('labelNomorSoal').innerText = `Pertanyaan ${index + 1}`;
        document.getElementById('teksSoalKuis').innerText = `Soal ${index + 1} dari ${daftarSoal.length}`;

        tetradContainer.innerHTML = '';
        
        // Parsing JSON opsi (D, I, S, C)
        let opsiObj = {};
        try {
            opsiObj = typeof soal.opsi_jawaban === 'string' ? JSON.parse(soal.opsi_jawaban) : soal.opsi_jawaban;
            while(typeof opsiObj === 'string') opsiObj = JSON.parse(opsiObj);
        } catch(e) { console.error("JSON Error", e); }

        // Pastikan ada object jawaban untuk nomor ini
        if (!jawabanUser[index]) jawabanUser[index] = { most: null, least: null };
        const ans = jawabanUser[index];

        for (const [trait, text] of Object.entries(opsiObj)) {
            const row = document.createElement('div');
            row.className = 'tetrad-row';
            
            // Logika mutually exclusive UI
            const isMost = ans.most === trait;
            const isLeast = ans.least === trait;
            
            const mostClass = isMost ? 'selected' : (ans.most ? 'disabled' : '');
            const leastClass = isLeast ? 'selected' : (ans.least ? 'disabled' : '');

            row.innerHTML = `
                <div class="tetrad-text">${text}</div>
                <div class="tetrad-actions">
                    <button class="btn-disc btn-most ${mostClass}" onclick="pilihTetrad(${index}, '${trait}', 'most')">
                        👍 Most
                    </button>
                    <button class="btn-disc btn-least ${leastClass}" onclick="pilihTetrad(${index}, '${trait}', 'least')">
                        👎 Least
                    </button>
                </div>
            `;
            tetradContainer.appendChild(row);
        }

        // Cek apakah sudah terisi Most & Least untuk membuka tombol Next
        validasiTombolLanjut();

        // Atur visibilitas Prev/Next/Submit
        btnPrev.style.visibility = index === 0 ? 'hidden' : 'visible';
        if (index === daftarSoal.length - 1) {
            btnNext.style.display = 'none';
            btnSubmit.style.display = 'block';
        } else {
            btnNext.style.display = 'block';
            btnSubmit.style.display = 'none';
        }
        
        updateGridNavigasi();
    }

    // --- 4. ENGINE PEMILIHAN MUTUALLY EXCLUSIVE ---
    window.pilihTetrad = function(index, trait, type) {
        let ans = jawabanUser[index];
        
        if (type === 'most') {
            if (ans.least === trait) ans.least = null; // Lepas least jika statement sama
            ans.most = (ans.most === trait) ? null : trait; // Toggle on/off
        } else {
            if (ans.most === trait) ans.most = null; // Lepas most jika statement sama
            ans.least = (ans.least === trait) ? null : trait; // Toggle on/off
        }
        
        renderSoal(index); // Re-render UI
    };

    function validasiTombolLanjut() {
        const ans = jawabanUser[indeksSekarang];
        const isLengkap = ans && ans.most !== null && ans.least !== null;
        
        if (isLengkap) {
            btnNext.disabled = false;
            btnNext.style.opacity = "1";
            btnNext.style.cursor = "pointer";
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = "1";
            btnSubmit.style.cursor = "pointer";
        } else {
            btnNext.disabled = true;
            btnNext.style.opacity = "0.5";
            btnNext.style.cursor = "not-allowed";
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = "0.5";
            btnSubmit.style.cursor = "not-allowed";
        }
    }

    // --- 5. NAVIGASI BAWAH & KOTAK KANAN ---
    btnPrev.onclick = () => { if(indeksSekarang > 0) { indeksSekarang--; renderSoal(indeksSekarang); } };
    btnNext.onclick = () => { if(indeksSekarang < daftarSoal.length - 1) { indeksSekarang++; renderSoal(indeksSekarang); } };

    function buatGridNavigasi() {
        const grid = document.getElementById('gridNavigasi');
        grid.innerHTML = '';
        daftarSoal.forEach((_, i) => {
            const box = document.createElement('div');
            box.id = `navBox-${i}`;
            box.className = 'nav-box'; box.innerText = i + 1;
            
            // DISC mewajibkan urutan, kotak hanya bisa diklik jika sudah dijawab atau nomor sekarang
            box.onclick = () => { 
                const prevAns = jawabanUser[i-1];
                const isPrevLengkap = (i === 0) || (prevAns && prevAns.most && prevAns.least);
                
                if (isPrevLengkap || i <= indeksSekarang) {
                    indeksSekarang = i; renderSoal(indeksSekarang); 
                } else {
                    alert("Selesaikan soal sebelumnya terlebih dahulu.");
                }
            };
            grid.appendChild(box);
        });
    }

    function updateGridNavigasi() {
        daftarSoal.forEach((_, i) => {
            const box = document.getElementById(`navBox-${i}`);
            if (!box) return;
            box.className = 'nav-box';
            
            if (i === indeksSekarang) box.classList.add('active');
            
            const ans = jawabanUser[i];
            if (ans && ans.most !== null && ans.least !== null) {
                box.classList.add('answered');
            }
        });
    }

    // --- 6. TIMER & PENGIRIMAN ---
    function mulaiTimer() {
        gameInterval = setInterval(() => {
            waktuTersisa--;
            const mnt = Math.floor(waktuTersisa / 60);
            const dtk = waktuTersisa % 60;
            document.getElementById('teksTimer').innerText = `${mnt.toString().padStart(2, '0')}:${dtk.toString().padStart(2, '0')}`;

            if (waktuTersisa <= 0) {
                clearInterval(gameInterval);
                showPopUp('info', 'Waktu Habis!', 'Jawaban Anda dikumpulkan secara otomatis.');
                setTimeout(() => prosesSubmit(), 2000);
            }
        }, 1000);
    }

    btnSubmit.onclick = () => {
        // Karena validasiTombolLanjut sudah mencegah klik jika belum lengkap, kita bisa langsung submit
        prosesSubmit();
    };

    async function prosesSubmit() {
        clearInterval(gameInterval);
        btnSubmit.innerText = "Menyimpan data..."; btnSubmit.disabled = true;

        try {
            const responsDB = await fetch('http://localhost:3000/api/user/submit-disc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pelamar_id: pelamarId, jawaban: jawabanUser })
            });
            const hasilDB = await responsDB.json();

            if (hasilDB.success) {
                localStorage.setItem(`disc_done_${pelamarId}`, 'true');
                showPopUp('success', 'Kerja Bagus!', `Tes DISC selesai. Profil kepribadian Anda telah dianalisis.`, '../index.html');
            } else {
                throw new Error("Gagal DB");
            }
        } catch (err) {
            showPopUp('error', 'Koneksi Gagal', 'Terjadi kesalahan saat menyimpan profil DISC Anda.');
            btnSubmit.innerText = "Selesai & Kumpulkan"; btnSubmit.disabled = false;
        }
    }

    // Modal Helper
    function showPopUp(type, title, message, redirectUrl = null) {
        const modal = document.getElementById('customModal');
        const icon = document.getElementById('modalIcon');
        if (type === 'success') {
            icon.style.background = 'rgba(16,185,129,0.15)'; icon.style.color = '#10b981';
            icon.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="30" height="30"><polyline points="20 6 9 17 4 12"/></svg>';
        } else if (type === 'error') {
            icon.style.background = 'rgba(239,68,68,0.15)'; icon.style.color = '#ef4444';
            icon.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="30" height="30"><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        } else {
            icon.style.background = 'rgba(59,130,246,0.15)'; icon.style.color = '#3b82f6';
            icon.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="30" height="30"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12.01" y2="16"/><path d="M12 8v4"/></svg>';
        }
        document.getElementById('modalTitle').innerText = title;
        document.getElementById('modalMessage').innerText = message;
        modal.style.display = 'flex';
        document.getElementById('btnModalOk').onclick = () => {
            modal.style.display = 'none';
            if (redirectUrl) window.location.href = redirectUrl;
        };
    }
});