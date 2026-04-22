document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. OTENTIKASI & SETUP AWAL ---
    const userDataString = localStorage.getItem('talentflow_user');
    if (!userDataString) return window.location.href = '../../index.html';
    
    const userData = JSON.parse(userDataString);
    const pelamarId = userData.pelamarId || userData.accountId || userData.id;

    let daftarSoal = [];
    let jawabanUser = {}; // Format: { "1": "A", "2": "B", ... } (Key adalah ID Soal)
    let indeksSekarang = 0;
    let waktuTersisa = 45 * 60; // 45 Menit waktu standar PAPI Kostick
    let gameInterval;

    const elAreaPertanyaan = document.getElementById('areaPertanyaan');
    const opsiContainer = document.getElementById('opsiContainer');
    const btnNext = document.getElementById('btnNext');
    const btnPrev = document.getElementById('btnPrev');
    const btnSubmit = document.getElementById('btnSubmit');

    // --- 2. AMBIL DATA SOAL DARI SERVER ---
    try {
        const response = await fetch('http://localhost:3000/api/user/soal-papi');
        const result = await response.json();
        
        if (!result.success) throw new Error("Gagal mengambil soal");

        daftarSoal = result.data; // Berisi 90 soal
        
        if(daftarSoal.length > 0) {
            elAreaPertanyaan.style.display = 'block';
            buatGridNavigasi();
            renderSoal(0);
            mulaiTimer();
        } else {
            elAreaPertanyaan.style.display = 'block';
            elAreaPertanyaan.innerHTML = '<div style="text-align:center; color:var(--muted); padding: 50px;">Soal PAPI Kostick belum tersedia di database.</div>';
        }
    } catch (err) {
        showPopUp('error', 'Koneksi Gagal', 'Gagal memuat soal PAPI Kostick dari database.');
    }

    // --- 3. RENDER SOAL & OPSI A/B ---
    function renderSoal(index) {
        const soal = daftarSoal[index];
        document.getElementById('labelNomorSoal').innerText = `Pertanyaan ${index + 1}`;
        document.getElementById('teksSoalKuis').innerText = `Soal ${index + 1} dari ${daftarSoal.length}`;

        opsiContainer.innerHTML = '';
        
        const jawabanTersimpan = jawabanUser[soal.id];

        // Buat Opsi A
        opsiContainer.innerHTML += `
            <div class="papi-option ${jawabanTersimpan === 'A' ? 'selected' : ''}" onclick="pilihJawaban(${soal.id}, 'A')">
                <div class="papi-badge">A</div>
                <div class="papi-text">${soal.pernyataan_a}</div>
            </div>
        `;

        // Buat Opsi B
        opsiContainer.innerHTML += `
            <div class="papi-option ${jawabanTersimpan === 'B' ? 'selected' : ''}" onclick="pilihJawaban(${soal.id}, 'B')">
                <div class="papi-badge">B</div>
                <div class="papi-text">${soal.pernyataan_b}</div>
            </div>
        `;

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

    // --- 4. ENGINE PEMILIHAN JAWABAN ---
    window.pilihJawaban = function(soalId, pilihan) {
        jawabanUser[soalId] = pilihan;
        renderSoal(indeksSekarang); // Re-render agar kotak menyala hijau
        
        // Pindah otomatis ke soal berikutnya jika belum di soal terakhir (Opsional, sangat disukai HR)
        if (indeksSekarang < daftarSoal.length - 1) {
            setTimeout(() => {
                indeksSekarang++;
                renderSoal(indeksSekarang);
            }, 300);
        }
    };

    // --- 5. NAVIGASI TOMBOL & KOTAK KANAN ---
    btnPrev.onclick = () => { if(indeksSekarang > 0) { indeksSekarang--; renderSoal(indeksSekarang); } };
    btnNext.onclick = () => { if(indeksSekarang < daftarSoal.length - 1) { indeksSekarang++; renderSoal(indeksSekarang); } };

    function buatGridNavigasi() {
        const grid = document.getElementById('gridNavigasi');
        grid.innerHTML = '';
        daftarSoal.forEach((soal, i) => {
            const box = document.createElement('div');
            box.id = `navBox-${i}`;
            box.innerText = i + 1;
            
            box.style.aspectRatio = '1/1';
            box.style.display = 'flex'; box.style.alignItems = 'center'; box.style.justifyContent = 'center';
            box.style.borderRadius = '6px'; box.style.border = '1px solid #1f2d45';
            box.style.cursor = 'pointer'; box.style.fontSize = '12px'; box.style.fontWeight = 'bold';
            box.style.transition = 'all 0.2s';

            box.onclick = () => { indeksSekarang = i; renderSoal(indeksSekarang); };
            grid.appendChild(box);
        });
    }

    function updateGridNavigasi() {
        daftarSoal.forEach((soal, i) => {
            const box = document.getElementById(`navBox-${i}`);
            if (!box) return;
            
            // Reset style dasar
            box.style.background = 'transparent'; box.style.color = 'var(--muted)'; box.style.borderColor = '#1f2d45';
            box.style.boxShadow = 'none';

            // Jika sudah dijawab
            if (jawabanUser[soal.id]) {
                box.style.background = 'rgba(16,185,129,0.15)'; box.style.color = '#10b981'; box.style.borderColor = '#10b981';
            }
            
            // Jika sedang aktif (dibuka)
            if (i === indeksSekarang) {
                box.style.border = '2px solid #3b82f6'; box.style.boxShadow = '0 0 8px rgba(59,130,246,0.5)';
            }
        });
    }

    // --- 6. TIMER & PENGIRIMAN DATA ---
    function mulaiTimer() {
        gameInterval = setInterval(() => {
            waktuTersisa--;
            const mnt = Math.floor(waktuTersisa / 60);
            const dtk = waktuTersisa % 60;
            document.getElementById('teksTimer').innerText = `${mnt.toString().padStart(2, '0')}:${dtk.toString().padStart(2, '0')}`;

            if (waktuTersisa <= 0) {
                clearInterval(gameInterval);
                showPopUp('info', 'Waktu Habis!', 'Jawaban Anda akan dikumpulkan secara otomatis.');
                setTimeout(() => prosesSubmit(), 2000);
            }
        }, 1000);
    }

    btnSubmit.onclick = () => {
        // Cek berapa soal yang sudah dijawab
        const terjawab = Object.keys(jawabanUser).length;
        if (terjawab < daftarSoal.length) {
            showPopUp('error', 'Belum Selesai', `Anda baru menjawab ${terjawab} dari ${daftarSoal.length} soal. Semua soal wajib diisi!`);
            return;
        }
        
        prosesSubmit();
    };

    async function prosesSubmit() {
        clearInterval(gameInterval);
        btnSubmit.innerText = "Menganalisis Jawaban..."; btnSubmit.disabled = true;

        try {
            const responsDB = await fetch('http://localhost:3000/api/user/submit-papi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pelamar_id: pelamarId, jawaban: jawabanUser })
            });
            const hasilDB = await responsDB.json();

            if (hasilDB.success) {
                localStorage.setItem(`papi_done_${pelamarId}`, 'true');
                showPopUp('success', 'Kerja Bagus!', `Tes PAPI Kostick selesai. Profil perilaku kerja Anda telah dianalisis.`, '../index.html');
            } else {
                throw new Error("Gagal menyimpan ke database");
            }
        } catch (err) {
            showPopUp('error', 'Koneksi Gagal', 'Terjadi kesalahan saat menyimpan profil PAPI Anda.');
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