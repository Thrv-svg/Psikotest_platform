document.addEventListener('DOMContentLoaded', async () => {
    
    function showPopUp(type, title, message, redirectUrl = null) {
        const modal = document.getElementById('customModal');
        const iconContainer = document.getElementById('modalIcon');
        if (type === 'success') {
            iconContainer.style.background = 'rgba(16,185,129,0.15)'; iconContainer.style.color = '#10b981';
            iconContainer.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="30" height="30"><polyline points="20 6 9 17 4 12"/></svg>';
        } else {
            iconContainer.style.background = 'rgba(239,68,68,0.15)'; iconContainer.style.color = '#ef4444';
            iconContainer.innerHTML = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="30" height="30"><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        }
        document.getElementById('modalTitle').innerText = title;
        document.getElementById('modalMessage').innerText = message;
        modal.style.display = 'flex';
        document.getElementById('btnModalOk').onclick = () => {
            modal.style.display = 'none';
            if (redirectUrl) window.location.href = redirectUrl;
        };
    }

    function showConfirm(message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            document.getElementById('confirmMessage').innerText = message;
            modal.style.display = 'flex';
            document.getElementById('btnConfirmYes').onclick = () => { modal.style.display = 'none'; resolve(true); };
            document.getElementById('btnConfirmNo').onclick = () => { modal.style.display = 'none'; resolve(false); };
        });
    }

    const kuisId = localStorage.getItem('kuis_aktif_id');
    // FIX: Cegah string "undefined" atau "null" merusak database
    if (!kuisId || kuisId === 'undefined' || kuisId === 'null') {
        showPopUp('error', 'Akses Ditolak', 'ID Kuis gagal dimuat dari Dashboard. Silakan kembali.', '../index.html'); 
        return;
    }

    let daftarSoal = [];
    let jawabanUser = {}; 
    let raguUser = {};    
    let indeksSekarang = 0;
    let waktuTersisa = 0; 
    let gameInterval;

    const elAreaPertanyaan = document.getElementById('areaPertanyaan');
    const chkRagu = document.getElementById('chkRagu');
    const raguLabel = document.getElementById('raguLabel'); // Ambil elemen bungkusnya

    try {
        const userData = JSON.parse(localStorage.getItem('talentflow_user'));
        const pelamarId = userData.pelamarId || userData.accountId;

        console.log("SELECTED QUIZ ID:", kuisId); // Debugging

        // FIX 6: Pass pelamarId as query string
        const response = await fetch(`http://localhost:3000/api/user/kuis/${kuisId}/soal?pelamarId=${pelamarId}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Akses ditolak atau kuis tidak ditemukan.");
        }

        console.log("SOAL DITERIMA:", result.soal.length);

        daftarSoal = result.soal;
        document.getElementById('teksJudulKuis').innerText = result.info.nama_kuis;
        document.getElementById('teksSoalKuis').innerText = `Soal 1 dari ${daftarSoal.length}`;
        waktuTersisa = result.info.durasi_menit * 60; 

        if(daftarSoal.length > 0) {
            elAreaPertanyaan.style.display = 'block';
            buatGridNavigasi();
            renderSoal(0);
            updateGridNavigasi();
            updateTombolNavigasi(0);
            mulaiTimer();
        } else {
            elAreaPertanyaan.style.display = 'block';
            elAreaPertanyaan.innerHTML = '<div style="text-align:center; color:var(--muted); padding: 50px;">HRD belum memasukkan soal ke modul ini.</div>';
        }
    } catch (err) {
        console.error("GAGAL MEMUAT SOAL:", err);
        showPopUp('error', 'Gagal Memuat Soal', `Alasan: ${err.message}`);
    }


    function renderSoal(index) {
        const soal = daftarSoal[index];
        document.getElementById('labelNomorSoal').innerText = `Pertanyaan ${index + 1}`;
        document.getElementById('teksPertanyaan').innerText = soal.pertanyaan;
        document.getElementById('teksSoalKuis').innerText = `Soal ${index + 1} dari ${daftarSoal.length}`;

        // Set status Checkbox Ragu-ragu
        chkRagu.checked = !!raguUser[index];
        if (chkRagu.checked) raguLabel.classList.add('is-checked');
        else raguLabel.classList.remove('is-checked');

        const elOpsi = document.getElementById('opsiContainer');
        elOpsi.innerHTML = '';
        
        // Tarik opsi_jawaban utuh yang dikirim dari API
        const opsiObj = soal.opsi_jawaban || {};

        // ==========================================================
        // LOGIKA PENGECEKAN TIPE SOAL (ESSAY vs PILIHAN GANDA)
        // ==========================================================
        if ((soal.tipe_soal && soal.tipe_soal.toLowerCase() === 'essay') || Object.keys(opsiObj).length === 0) {
            
            // JIKA ESSAY: Buat kotak teks (Textarea) yang elegan
            const jawabanTersimpan = jawabanUser[index] || ''; 
            
            const essayBox = document.createElement('textarea');
            essayBox.placeholder = "Ketik jawaban Anda di sini...";
            essayBox.rows = 6;
            essayBox.style.width = "100%";
            essayBox.style.padding = "16px 20px";
            essayBox.style.borderRadius = "12px";
            essayBox.style.background = "#111827";     // Sesuai tema gelap
            essayBox.style.color = "#ffffff";          // Teks putih
            essayBox.style.border = "1px solid #1f2d45"; // Border senada
            essayBox.style.fontFamily = "'DM Sans', sans-serif";
            essayBox.style.fontSize = "15px";
            essayBox.style.resize = "vertical";
            essayBox.style.boxSizing = "border-box";
            essayBox.style.transition = "all 0.2s";
            essayBox.style.outline = "none";
            
            essayBox.value = jawabanTersimpan;

            // Efek hover/focus seperti pilihan ganda
            essayBox.onfocus = () => essayBox.style.borderColor = '#3b82f6';
            essayBox.onblur = () => essayBox.style.borderColor = '#1f2d45';

            // Simpan jawaban setiap kali user mengetik
            essayBox.oninput = (e) => {
                jawabanUser[index] = e.target.value;
                updateGridNavigasi(); // Agar kotak di navigasi sebelah kanan berubah jadi "Dijawab"
            };

            elOpsi.appendChild(essayBox);

        } else {
            
            // JIKA PILIHAN GANDA: Gunakan kode desain UI Anda yang sebelumnya
            for (const [key, val] of Object.entries(opsiObj)) {
                const label = document.createElement('label');
                label.style.display = 'block';
                label.style.marginBottom = '12px';
                
                const isSelected = jawabanUser[index] === key;
                const isChecked = isSelected ? 'checked' : '';
                
                // Warna dinamis: Biru menyala jika dipilih, Gelap jika belum dipilih
                const boxBg = isSelected ? 'rgba(59,130,246,0.1)' : '#111827';
                const boxBorder = isSelected ? '#3b82f6' : '#1f2d45';
                const textColor = isSelected ? '#ffffff' : '#8fa0be';
                const letterColor = isSelected ? '#3b82f6' : '#6b7a99';

                label.innerHTML = `
                    <input type="radio" name="soal_${index}" value="${key}" ${isChecked} style="display: none;">
                    
                    <div class="modern-opt-box" style="display: flex; align-items: flex-start; gap: 15px; padding: 16px 20px; border: 1px solid ${boxBorder}; border-radius: 12px; background: ${boxBg}; cursor: pointer; transition: all 0.2s;">
                        <div style="font-weight: 800; font-size: 16px; color: ${letterColor};">
                            ${key}.
                        </div>
                        <div style="font-size: 15px; color: ${textColor}; line-height: 1.5; margin-top: 1px;">
                            ${val}
                        </div>
                    </div>
                `;
                
                // Event klik: Simpan jawaban dan render ulang layarnya
                label.onclick = (e) => {
                    e.preventDefault(); 
                    jawabanUser[index] = key; 
                    renderSoal(index); 
                    updateGridNavigasi(); 
                };
                
                // Tambahkan efek hover menggunakan Javascript
                label.onmouseenter = () => { if(!isSelected) label.querySelector('.modern-opt-box').style.borderColor = '#8fa0be'; };
                label.onmouseleave = () => { if(!isSelected) label.querySelector('.modern-opt-box').style.borderColor = '#1f2d45'; };
                
                elOpsi.appendChild(label);
            }
        }
}

    // 1. FUNGSI PEMBUAT KOTAK (TARGET ID YANG BENAR)
    function buatGridNavigasi() {
        const gridContainer = document.getElementById('gridNavigasi'); // Ini yang benar!
        if (!gridContainer) return;
        
        gridContainer.innerHTML = '';
        daftarSoal.forEach((_, i) => {
            const box = document.createElement('div');
            box.id = `navBox-${i}`;
            
            // Set style dasar kotak
            box.style.aspectRatio = '1';
            box.style.display = 'grid';
            box.style.placeItems = 'center';
            box.style.borderRadius = '6px';
            box.style.border = '1px solid #1f2d45';
            box.style.cursor = 'pointer';
            box.style.transition = 'all 0.2s';
            box.innerText = i + 1;
            
            box.onclick = () => { 
                indeksSekarang = i; 
                renderSoal(indeksSekarang); 
            };
            
            gridContainer.appendChild(box);
        });
    }

    // 2. FUNGSI PEWARNA KOTAK (DENGAN PENGAMAN ANTI-CRASH)
   function updateGridNavigasi() {
        daftarSoal.forEach((_, i) => {
            const box = document.getElementById(`navBox-${i}`);
            if (!box) return;

            // Reset ke default
            box.className = 'nav-box';

            // Tambahkan class sesuai status (Urutan ini penting agar 'ragu' menimpa 'answered')
            if (i === indeksSekarang) box.classList.add('active');
            if (jawabanUser[i]) box.classList.add('answered');
            if (raguUser[i]) box.classList.add('ragu');
        });
    }

    // 3. EVENT LISTENER RAGU-RAGU (Bonus: Sebelumnya fitur ini belum aktif di JS Anda)
    if (chkRagu) {
        chkRagu.addEventListener('change', (e) => {
            raguUser[indeksSekarang] = e.target.checked;
            updateGridNavigasi();
        });
    }

    // 4. FUNGSI NAVIGASI TOMBOL (MENGATASI ERROR "updateTombolNavigasi is not defined")
    function updateTombolNavigasi(index) {
        const btnNext = document.getElementById('btnNext');
        const btnPrev = document.getElementById('btnPrev');

        if (btnNext) {
            if (index === daftarSoal.length - 1) {
                btnNext.innerText = "Selesai & Kumpulkan";
                btnNext.style.background = "#10b981"; 
                btnNext.style.color = "#ffffff";
                
                // Picu konfirmasi pengumpulan saat di soal terakhir
                btnNext.onclick = () => {
                    const btnSubmit = document.getElementById('btnSubmit');
                    if (btnSubmit) btnSubmit.click();
                };
            } else {
                btnNext.innerText = "Selanjutnya →";
                btnNext.style.background = "#f59e0b"; 
                btnNext.style.color = "#000000";
                
                btnNext.onclick = () => {
                    if (indeksSekarang < daftarSoal.length - 1) {
                        indeksSekarang++;
                        renderSoal(indeksSekarang);
                        updateGridNavigasi();
                        updateTombolNavigasi(indeksSekarang);
                    }
                };
            }
        }

        if (btnPrev) {
            if (index === 0) {
                btnPrev.style.display = 'none'; // Sembunyikan tombol previous di soal nomor 1
            } else {
                btnPrev.style.display = 'block';
                btnPrev.onclick = () => {
                    if (indeksSekarang > 0) {
                        indeksSekarang--;
                        renderSoal(indeksSekarang);
                        updateGridNavigasi();
                        updateTombolNavigasi(indeksSekarang);
                    }
                };
            }
        }
    };

    function mulaiTimer() {
        gameInterval = setInterval(() => {
            waktuTersisa--;
            const jam = Math.floor(waktuTersisa / 3600), mnt = Math.floor((waktuTersisa % 3600) / 60), dtk = waktuTersisa % 60;
            document.getElementById('teksTimer').innerText = `${jam.toString().padStart(2, '0')}:${mnt.toString().padStart(2, '0')}:${dtk.toString().padStart(2, '0')}`;

            if (waktuTersisa <= 0) {
                clearInterval(gameInterval);
                showPopUp('info', 'Waktu Habis!', 'Jawaban Anda akan dikumpulkan secara otomatis sekarang.');
                setTimeout(() => prosesSubmit(), 2000);
            }
        }, 1000);
    }

    // ─── LOGIKA KLIK KUMPULKAN (DENGAN ANCAMAN RAGU-RAGU) ───
    async function eksekusiSubmitKonfirmasi() {
        // Hitung jumlah soal yang sudah dijawab dengan valid
        let terjawab = 0;
        for (let i = 0; i < daftarSoal.length; i++) {
            if (jawabanUser[i] !== undefined && jawabanUser[i] !== null && String(jawabanUser[i]).trim() !== '') {
                terjawab++;
            }
        }
        
        // Cek apakah ada soal yang dicentang ragu-ragu
        const adaRagu = Object.values(raguUser).some(status => status === true);
        
        let pesanConfirm = "";
        if (adaRagu) {
            pesanConfirm = `⚠️ PERINGATAN KERAS ⚠️\n\nAnda masih memiliki soal yang ditandai "Ragu-ragu" (Kuning).\nSistem akan mengabaikan jawaban Anda pada soal tersebut!\n\nYakin ingin mengumpulkan sekarang?`;
        } else if (terjawab < daftarSoal.length) {
            pesanConfirm = `Anda baru menjawab ${terjawab} dari ${daftarSoal.length} soal.\n\nYakin ingin mengumpulkannya sekarang?`;
        } else {
            pesanConfirm = `Anda sudah menjawab semua soal dengan yakin.\nApakah Anda siap mengakhiri tes ini?`;
        }

        const yakin = await showConfirm(pesanConfirm);
        if (!yakin) return; 
        
        prosesSubmit();
    }

    // ─── PROSES EKSEKUSI PENGIRIMAN KE SERVER ───
    async function prosesSubmit() {
        clearInterval(gameInterval);
        
        // Ubah teks tombol yang sedang diklik menjadi loading
        const btnNext = document.getElementById('btnNext');
        if (btnNext) {
            btnNext.innerText = "Menyimpan data..."; 
            btnNext.disabled = true;
        }

        const userData = JSON.parse(localStorage.getItem('talentflow_user'));
        const pelamarId = userData.pelamarId || userData.accountId || userData.id;

        let payloadJawaban = {};
        daftarSoal.forEach((soal, i) => {
            // Jangan kirim jawaban kosong atau yang masih ragu-ragu
            if (jawabanUser[i] !== undefined && jawabanUser[i] !== null && String(jawabanUser[i]).trim() !== '' && !raguUser[i]) {
                payloadJawaban[soal.id] = jawabanUser[i];
            }
        });

        try {
            const responsDB = await fetch('http://localhost:3000/api/user/submit-kuis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pelamar_id: pelamarId, kuis_id: kuisId, jawaban: payloadJawaban })
            });
            const hasilDB = await responsDB.json();

            if (hasilDB.success) {
                localStorage.setItem(`kuis_done_${pelamarId}_${kuisId}`, 'true');
                showPopUp('success', 'Kerja Bagus!', `Kuis selesai. Skor Anda sudah tersimpan dengan aman!`, '../index.html');
            } else {
                showPopUp('error', 'Gagal', 'Terjadi kesalahan di database.');
                if (btnNext) { btnNext.innerText = "Selesai & Kumpulkan"; btnNext.disabled = false; }
            }
        } catch (err) {
            showPopUp('error', 'Koneksi Terputus', 'Gagal menghubungi server.');
            if (btnNext) { btnNext.innerText = "Selesai & Kumpulkan"; btnNext.disabled = false; }
        }
    }

    // ─── FUNGSI NAVIGASI TOMBOL YANG AMAN ───
    function updateTombolNavigasi(index) {
        const btnNext = document.getElementById('btnNext');
        const btnPrev = document.getElementById('btnPrev');

        if (btnNext) {
            if (index === daftarSoal.length - 1) {
                btnNext.innerText = "Selesai & Kumpulkan";
                btnNext.style.background = "#10b981"; 
                btnNext.style.color = "#ffffff";
                
                // PANGGIL LANGSUNG FUNGSI SUBMIT (TIDAK MENSIMULASIKAN KLIK LAGI)
                btnNext.onclick = (e) => {
                    e.preventDefault();
                    eksekusiSubmitKonfirmasi();
                };
            } else {
                btnNext.innerText = "Selanjutnya →";
                btnNext.style.background = "#f59e0b"; 
                btnNext.style.color = "#000000";
                
                btnNext.onclick = (e) => {
                    e.preventDefault();
                    if (indeksSekarang < daftarSoal.length - 1) {
                        indeksSekarang++;
                        renderSoal(indeksSekarang);
                        updateGridNavigasi();
                        updateTombolNavigasi(indeksSekarang);
                    }
                };
            }
        }

        if (btnPrev) {
            if (index === 0) {
                btnPrev.style.display = 'none'; // Sembunyikan tombol previous di soal nomor 1
            } else {
                btnPrev.style.display = 'block';
                btnPrev.onclick = (e) => {
                    e.preventDefault();
                    if (indeksSekarang > 0) {
                        indeksSekarang--;
                        renderSoal(indeksSekarang);
                        updateGridNavigasi();
                        updateTombolNavigasi(indeksSekarang);
                    }
                };
            }
        }
    }

});