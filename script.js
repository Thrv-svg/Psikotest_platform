document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. LOGIKA LOGIN (Sama seperti sebelumnya)
    // ==========================================
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.getElementById('loginBtn');

    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            errorMsg.style.display = 'none';
            loginBtn.innerText = 'Memverifikasi...';
            loginBtn.disabled = true;
            loginBtn.style.opacity = '0.7';

            const email = emailInput.value;
            const password = passwordInput.value;

            try {
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();

                if (result.success) {
                    localStorage.setItem('talentflow_user', JSON.stringify(result.data));

                    if (result.data.role === 'admin' || result.data.role === 'hr') {
                        window.location.href = 'admin/index.html';
                    } else if (result.data.role === 'pelamar') {
                        window.location.href = 'user/index.html';
                    }
                } else {
                    errorMsg.innerText = result.message;
                    errorMsg.style.display = 'block';
                    loginBtn.innerText = 'Masuk Sekarang';
                    loginBtn.disabled = false;
                    loginBtn.style.opacity = '1';
                }
            } catch (error) {
                console.error("Gagal login:", error);
                errorMsg.innerText = "Gagal terhubung ke server.";
                errorMsg.style.display = 'block';
                loginBtn.innerText = 'Masuk Sekarang';
                loginBtn.disabled = false;
                loginBtn.style.opacity = '1';
            }
        });
    }

    // ==========================================
    // 2. LOGIKA REGISTRASI BARU (Bebas Bug)
    // ==========================================
    const registerForm = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn'); // Pastikan ID tombol daftar sesuai

    if(registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Cegah reload halaman

            // Ubah tombol jadi status loading
            if (registerBtn) {
                registerBtn.innerText = 'Memproses...';
                registerBtn.disabled = true;
                registerBtn.style.opacity = '0.7';
            }

            // Kumpulkan Payload dengan aman
            // Catatan: Pastikan ID (inputNama, inputNik, dll) sesuai dengan yang ada di register.html Anda
            const payload = {
                nama_lengkap: document.getElementById('inputNama') ? document.getElementById('inputNama').value : '',
                nik: document.getElementById('inputNik') ? document.getElementById('inputNik').value : '',
                no_whatsapp: document.getElementById('inputWa') ? document.getElementById('inputWa').value : '',
                email: document.getElementById('inputEmail') ? document.getElementById('inputEmail').value : '',
                password: document.getElementById('inputPassword') ? document.getElementById('inputPassword').value : '',
                
                // FIX UTAMA: Karena form pemilihan pekerjaan dihapus, kita set otomatis:
                posisi_dilamar: "Belum Ditentukan"
            };

            try {
                // Tembak API Registrasi
                const response = await fetch('http://localhost:3000/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    alert("Registrasi berhasil! Silakan masuk dengan akun baru Anda.");
                    // Mengarahkan pengguna kembali ke halaman Login
                    window.location.href = 'index.html'; 
                } else {
                    alert(result.message || "Gagal melakukan registrasi. Periksa kembali data Anda.");
                    // Kembalikan status tombol
                    if (registerBtn) {
                        registerBtn.innerText = 'Daftar Sekarang';
                        registerBtn.disabled = false;
                        registerBtn.style.opacity = '1';
                    }
                }
            } catch (error) {
                console.error("Gagal registrasi:", error);
                alert("Terjadi kesalahan sistem/koneksi. Pastikan server aktif.");
                // Kembalikan status tombol
                if (registerBtn) {
                    registerBtn.innerText = 'Daftar Sekarang';
                    registerBtn.disabled = false;
                    registerBtn.style.opacity = '1';
                }
            }
        });
    }
});