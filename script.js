document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. LOGIKA LOGIN (DENGAN JWT)
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
                    // SIMPAN TOKEN DAN DATA USER
                    localStorage.setItem('talentflow_token', result.token);
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
    const registerBtn = document.getElementById('registerBtn');

    if(registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (registerBtn) {
                registerBtn.innerText = 'Memproses...';
                registerBtn.disabled = true;
                registerBtn.style.opacity = '0.7';
            }

            const payload = {
                nama_lengkap: document.getElementById('inputNama') ? document.getElementById('inputNama').value : '',
                nik: document.getElementById('inputNik') ? document.getElementById('inputNik').value : '',
                no_whatsapp: document.getElementById('inputWa') ? document.getElementById('inputWa').value : '',
                email: document.getElementById('inputEmail') ? document.getElementById('inputEmail').value : '',
                password: document.getElementById('inputPassword') ? document.getElementById('inputPassword').value : '',
                posisi_dilamar: "Belum Ditentukan"
            };

            try {
                const response = await fetch('http://localhost:3000/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    alert("Registrasi berhasil! Silakan masuk dengan akun baru Anda.");
                    window.location.href = 'index.html'; 
                } else {
                    alert(result.message || "Gagal melakukan registrasi.");
                    if (registerBtn) {
                        registerBtn.innerText = 'Daftar Sekarang';
                        registerBtn.disabled = false;
                        registerBtn.style.opacity = '1';
                    }
                }
            } catch (error) {
                console.error("Gagal registrasi:", error);
                alert("Terjadi kesalahan sistem/koneksi.");
                if (registerBtn) {
                    registerBtn.innerText = 'Daftar Sekarang';
                    registerBtn.disabled = false;
                    registerBtn.style.opacity = '1';
                }
            }
        });
    }
});
