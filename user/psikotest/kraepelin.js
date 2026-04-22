document.addEventListener('DOMContentLoaded', () => {
    
    function showPopUp(type, title, message, redirectUrl = null) {
        const modal = document.getElementById('customModal');
        const iconContainer = document.getElementById('modalIcon');
        const btnOk = document.getElementById('btnModalOk');

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

        btnOk.onclick = () => {
            modal.style.display = 'none';
            if (redirectUrl) window.location.href = redirectUrl;
        };
    }

    // ─── PERBAIKAN 1: MENGAMBIL ID DENGAN AMAN ───
    const userDataString = localStorage.getItem('talentflow_user');
    if (!userDataString) {
        showPopUp('error', 'Akses Ditolak', 'Sesi Anda tidak valid. Silakan login kembali.', '../index.html');
        return;
    }
    
    const userData = JSON.parse(userDataString);
    // Kita tangkap ID-nya entah dia bernama 'id', 'pelamar_id', atau 'nik' di data Anda
    const pelamarId = userData.pelamarId || userData.accountId || userData.nik;

    if (!pelamarId) {
        showPopUp('error', 'Data Korup', 'ID Akun Anda tidak ditemukan, silakan relogin.', '../index.html');
        return;
    }

    // ─── PERBAIKAN 2: SISTEM KUNCI TES ANTI-MENGULANG ───
    // Cek apakah pelamar ini sudah punya stempel 'selesai' di komputernya
    if (localStorage.getItem(`kraepelin_done_${pelamarId}`)) {
        showPopUp('error', 'Akses Ditolak', 'Anda sudah menyelesaikan tes ini. Tidak dapat mengulang asesmen.', '../index.html');
        return;
    }

    const totalCols = 10;        
    const rowsPerCol = 40;       
    const intervalTime = 15;     
    const transitionTime = 5; 
    const CELL_HEIGHT = 46; 

    let gridData = [];           
    let scores = new Array(totalCols).fill(0); 
    
    let currentCol = 0;
    let currentRow = 0;
    let timer = intervalTime;
    let gameInterval;
    let isPlaying = false; 

    const boardInner = document.getElementById('board-inner');
    const timerDisplay = document.getElementById('timerDisplay');
    const hiddenInput = document.getElementById('hidden-input');
    const numpad = document.getElementById('numpad');
    const startScreen = document.getElementById('start-screen');
    const focusArea = document.getElementById('focus-area');
    const focusCursor = document.getElementById('focus-cursor');

    function buildGrid() {
        boardInner.querySelectorAll('.col-angka').forEach(e => e.remove());
        gridData = [];

        for (let c = 0; c < totalCols; c++) {
            let colData = [];
            const colDiv = document.createElement('div');
            colDiv.className = `col-angka ${c === 0 ? 'active' : ''}`;
            colDiv.id = `col-${c}`;

            for (let r = 0; r < rowsPerCol; r++) {
                const num = Math.floor(Math.random() * 10);
                colData.push(num);
                
                const cell = document.createElement('div');
                cell.className = 'cell-angka';
                cell.id = `cell-${c}-${r}`;
                cell.innerText = num;
                
                colDiv.prepend(cell); 
            }
            gridData.push(colData);
            boardInner.insertBefore(colDiv, focusArea);
        }
    }

    function moveCursor(col, row) {
        document.querySelectorAll('.col-angka').forEach(c => c.classList.remove('active'));

        const activeCol = document.getElementById(`col-${col}`);
        if (activeCol) {
            activeCol.classList.add('active');
            activeCol.style.transform = `translateY(${row * CELL_HEIGHT}px)`;

            const colLeft = activeCol.offsetLeft;
            focusArea.style.left = colLeft + 'px';
            focusCursor.style.left = colLeft + 'px';
            
            focusArea.style.display = 'block';
            focusCursor.style.display = 'block';
        }
    }

    function processAnswer(inputVal) {
        if (!isPlaying || inputVal === '') return;
        
        const inputNum = parseInt(inputVal);
        const bottomNum = gridData[currentCol][currentRow];
        const topNum = gridData[currentCol][currentRow + 1];
        
        const correctAns = (bottomNum + topNum) % 10;

        const targetCell = document.getElementById(`cell-${currentCol}-${currentRow}`);
        const ansSpan = document.createElement('div');
        ansSpan.innerText = inputNum;
        ansSpan.style.color = (inputNum === correctAns) ? '#10b981' : '#ef4444'; 
        ansSpan.style.fontWeight = 'bold';
        ansSpan.style.fontSize = '15px';
        ansSpan.style.position = 'absolute';
        ansSpan.style.top = '-10px'; 
        ansSpan.style.width = '100%';
        ansSpan.style.textAlign = 'center';
        ansSpan.style.zIndex = '5';
        
        targetCell.appendChild(ansSpan); 

        if (inputNum === correctAns) scores[currentCol]++;

        currentRow++;
        if (currentRow < rowsPerCol - 1) {
            moveCursor(currentCol, currentRow);
        }
    }

    document.querySelectorAll('.num-btn').forEach(btn => {
        btn.addEventListener('click', function() { processAnswer(this.innerText); });
    });

    hiddenInput.addEventListener('input', function() {
        const val = this.value.slice(-1); 
        this.value = ''; 
        processAnswer(val);
    });

    function runTransition() {
        isPlaying = false; 
        clearInterval(gameInterval); 
        
        const transModal = document.getElementById('transitionModal');
        const transCount = document.getElementById('transitionCountdown');
        let timeLeft = transitionTime; 
        
        transCount.innerText = timeLeft;
        transModal.style.display = 'flex'; 

        const transInterval = setInterval(() => {
            timeLeft--;
            transCount.innerText = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(transInterval);
                transModal.style.display = 'none'; 
                
                timer = intervalTime;
                currentRow = 0;
                moveCursor(currentCol, currentRow);
                
                boardInner.classList.add('flash-pindah');
                setTimeout(() => boardInner.classList.remove('flash-pindah'), 500);

                isPlaying = true; 
                hiddenInput.focus(); 
                
                gameInterval = setInterval(tick, 1000);
            }
        }, 1000);
    }

    function tick() {
        timer--;
        timerDisplay.innerText = `Waktu Interval: ${timer}s`;

        if (timer <= 0) {
            currentCol++;
            if (currentCol >= totalCols) {
                endGame(); 
            } else {
                runTransition(); 
            }
        }
    }

    document.getElementById('btnMulai').addEventListener('click', () => {
        buildGrid();
        startScreen.style.display = 'none';
        numpad.style.display = 'grid'; 
        isPlaying = true;
        
        moveCursor(0, 0);
        hiddenInput.focus();
        document.addEventListener('click', () => { if(isPlaying) hiddenInput.focus(); });

        gameInterval = setInterval(tick, 1000);
    });

    async function endGame() {
        clearInterval(gameInterval);
        isPlaying = false;
        
        boardInner.innerHTML = `<div style="text-align:center; padding: 50px; color: var(--accent3); width: 100%;">
            <h2 style="font-family: 'Syne'; font-size: 28px; margin-bottom: 10px;">Waktu Habis!</h2>
            <p>Menyimpan hasil ke database...</p>
        </div>`;
        numpad.style.display = 'none';
        timerDisplay.innerText = "Selesai";

        try {
            const response = await fetch('http://localhost:3000/api/user/submit-kraepelin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pelamar_id: pelamarId, grafik_data: scores }) 
            });
            const result = await response.json();
            
            if (result.success) {
                // ─── PERBAIKAN 3: PASANG GEMBOK TES ───
                localStorage.setItem(`kraepelin_done_${pelamarId}`, 'true');

                showPopUp('success', 'Kerja Bagus!', 'Hasil tes Kraepelin Anda telah berhasil disimpan.', '../index.html');
            } else {
                showPopUp('error', 'Gagal', 'Terjadi kesalahan saat menyimpan data.', '../index.html');
            }
        } catch (error) {
            showPopUp('error', 'Koneksi Terputus', 'Gagal menghubungi server Node.js. Pastikan server aktif.', '../index.html');
        }
    }
});