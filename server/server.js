const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Mengizinkan Front-End mengakses Back-End
app.use(express.json()); // Agar server bisa membaca dan menerima data format JSON

// Konfigurasi Koneksi Database (Menggunakan Sistem POOL agar tidak terputus)
const db = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'talentflow_db',
    waitForConnections: true,
    connectionLimit: 10, // Maksimal 10 koneksi bersamaan
    queueLimit: 0
});

// Cek Koneksi Database (Sistem Pool)
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Gagal terkoneksi ke database:', err.message);
        return;
    }
    console.log('✅ Berhasil terhubung ke database MySQL (Sistem Pool Aktif!)');
    connection.release(); // Kembalikan koneksi ke dalam pool setelah dicek
});

// Endpoint/Route Dasar (Untuk Testing)
app.get('/api/test', (req, res) => {
    res.json({ message: "Server TalentFlow API Berjalan dengan Baik!" });
});

// ─── 1. API AMBIL DATA SEMUA PELAMAR (SINKRONISASI STATUS KUIS REAL-TIME) ───
app.get('/api/pelamar', (req, res) => {
    // Menghitung kuis 'Selesai' langsung dari DB, menghapus kebutuhan dummy data
    const sql = `
        SELECT p.*, 
        (SELECT COUNT(*) FROM hasil_akademik h WHERE h.pelamar_id = p.id AND h.status_pengerjaan = 'Selesai') AS kuis_selesai 
        FROM pelamar p 
        ORDER BY p.id DESC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Gagal mengambil data pelamar:', err);
            return res.status(500).json({ message: 'Terjadi kesalahan server' });
        }
        res.json(results);
    });
});

// ─── 2. API AMBIL DATA SEMUA KUIS ───
app.get('/api/kuis', (req, res) => {
    const sql = "SELECT * FROM kuis_akademik ORDER BY jadwal_ujian ASC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Error server' });
        res.json(results);
    });
});

// ─── 3. API UPDATE DATA KUIS (EDIT) ───
app.put('/api/kuis/:id', (req, res) => {
    const kuisId = req.params.id;
    // Hapus bank_soal karena sistem sekarang menghitungnya otomatis
    const { jadwal_ujian, jumlah_soal } = req.body;

    const sql = "UPDATE kuis_akademik SET jadwal_ujian = ?, jumlah_soal = ? WHERE id = ?";
    db.query(sql, [jadwal_ujian, jumlah_soal, kuisId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error server' });
        res.json({ message: 'Kuis berhasil diupdate' });
    });
});

// ─── 4. API HAPUS DATA KUIS (DELETE) ───
app.delete('/api/kuis/:id', (req, res) => {
    const kuisId = req.params.id;
    
    const sql = "DELETE FROM kuis_akademik WHERE id = ?";
    db.query(sql, [kuisId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error server' });
        res.json({ message: 'Kuis berhasil dihapus' });
    });
});

// ─── 5. API SUBMIT NILAI KUIS (SISI PELAMAR) ───
app.post('/api/submit-kuis', (req, res) => {
    // Menangkap data yang dikirim oleh HP/Laptop pelamar
    const { pelamar_id, kuis_id, skor } = req.body;

    // Perintah memasukkan data ke tabel hasil_akademik di MySQL
    const sql = `
        INSERT INTO hasil_akademik (pelamar_id, kuis_id, skor, status_pengerjaan, tanggal_selesai) 
        VALUES (?, ?, ?, 'Selesai', NOW())
    `;

    db.query(sql, [pelamar_id, kuis_id, skor], (err, result) => {
        if (err) {
            console.error('❌ Gagal menyimpan nilai:', err);
            return res.status(500).json({ message: 'Terjadi kesalahan saat menyimpan nilai' });
        }
        res.json({ message: 'Jawaban berhasil dikirim dan nilai disimpan!', insertId: result.insertId });
    });
});

// ─── 6. API AUTENTIKASI / LOGIN ───
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Cari akun yang cocok di database
    const sql = "SELECT id, email, role, pelamar_id FROM accounts WHERE email = ? AND password = ?";
    
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error('❌ Gagal cek login:', err);
            return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
        }
        
        if (results.length > 0) {
            // Jika akun ditemukan, kirim data identitasnya ke Front-End
            const user = results[0];
            res.json({ 
                success: true, 
                message: 'Login berhasil',
                data: {
                    accountId: user.id,
                    email: user.email,
                    role: user.role,
                    pelamarId: user.pelamar_id
                }
            });
        } else {
            // Jika tidak ditemukan / salah password
            res.status(401).json({ success: false, message: 'Email atau password salah!' });
        }
    });
});

// ─── 7. API CEK STATUS KUIS PELAMAR ───
app.get('/api/status-kuis/:pelamar_id', (req, res) => {
    const pelamarId = req.params.pelamar_id;
    
    // Cari kuis apa saja yang sudah dikerjakan pelamar ini
    const sql = "SELECT kuis_id, skor FROM hasil_akademik WHERE pelamar_id = ?";
    
    db.query(sql, [pelamarId], (err, results) => {
        if (err) {
            console.error('❌ Gagal mengecek status kuis:', err);
            return res.status(500).json({ message: 'Error server' });
        }
        res.json(results); // Mengirim daftar kuis yang sudah selesai ke Front-End
    });
});

// ─── 8. API ADMIN: GET SEMUA DATA KUIS & STATISTIK ───
app.get('/api/admin/kuis', (req, res) => {
    // UPDATE: Gunakan Subquery dengan GROUP_CONCAT untuk menarik data dari tabel pivot
    const sql = `
        SELECT k.*, 
               (SELECT GROUP_CONCAT(target_posisi SEPARATOR ', ') 
                FROM kuis_target_posisi 
                WHERE kuis_id = k.id) AS target_posisi_dinamis
        FROM kuis_akademik k 
        ORDER BY k.jadwal_ujian ASC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Gagal mengambil data kuis:', err);
            return res.status(500).json({ success: false, message: 'Error server' });
        }

        // Kalkulasi Statistik secara Real-Time
        const totalKuis = results.length;
        const kuisAktif = results.filter(k => k.status === 'Aktif').length;
        
        const hariIni = new Date();
        const kuisTerjadwal = results.filter(k => new Date(k.jadwal_ujian) >= hariIni).length;

        res.json({
            success: true,
            stats: { total: totalKuis, terjadwal: kuisTerjadwal, aktif: kuisAktif },
            data: results
        });
    });
});

// ─── 9. API ADMIN: TAMBAH KUIS BARU (CREATE - LENGKAP DENGAN PIVOT) ───
app.post('/api/admin/kuis', (req, res) => {
    const { nama_kuis, rumpun_ilmu, pohon_ilmu, program_studi, target_posisi, target_posisi_array, durasi_menit, jumlah_soal, jadwal_ujian } = req.body;
    
    // 1. Simpan kuis ke tabel utama
    const sql = `INSERT INTO kuis_akademik 
        (nama_kuis, rumpun_ilmu, pohon_ilmu, program_studi, target_posisi, durasi_menit, jumlah_soal, jadwal_ujian, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aktif')`;
        
    db.query(sql, [nama_kuis, rumpun_ilmu, pohon_ilmu, program_studi, target_posisi, durasi_menit, jumlah_soal, jadwal_ujian], (err, result) => {
        if (err) {
            console.error('❌ Gagal menambah kuis:', err);
            return res.status(500).json({ success: false, message: 'Gagal menyimpan ke database' });
        }
        
        const kuisId = result.insertId;

        // 2. Simpan array target pekerjaan ke tabel Pivot
        if (target_posisi_array && target_posisi_array.length > 0) {
            const values = target_posisi_array.map(posisi => [kuisId, posisi]);
            db.query('INSERT INTO kuis_target_posisi (kuis_id, target_posisi) VALUES ?', [values], (errPivot) => {
                if (errPivot) console.error("Gagal simpan ke pivot tabel:", errPivot);
                res.json({ success: true, message: 'Assessment berhasil ditambahkan!' });
            });
        } else {
            res.json({ success: true, message: 'Assessment berhasil ditambahkan!' });
        }
    });
});

// ─── 10. API ADMIN: PERFORMA KUIS (SQL JOIN & AGREGASI) ───
app.get('/api/admin/performa-kuis', (req, res) => {
    // Query ini menggabungkan tabel kuis dan hasil, menghitung jumlah peserta, dan merata-rata skor
    const sql = `
        SELECT 
            k.id, 
            k.nama_kuis AS nama, 
            k.rumpun_ilmu AS prodi, 
            COUNT(h.pelamar_id) AS peserta, 
            COALESCE(ROUND(AVG(h.skor)), 0) AS nilai 
        FROM kuis_akademik k
        LEFT JOIN hasil_akademik h ON k.id = h.kuis_id
        GROUP BY k.id, k.nama_kuis, k.rumpun_ilmu
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Gagal mengambil data performa:', err);
            return res.status(500).json({ success: false, message: 'Gagal query database' });
        }
        res.json({ success: true, data: results });
    });
});

// ─── 11. API ADMIN: LEADERBOARD TOP 5 KUIS ───
app.get('/api/admin/kuis/:id/top5', (req, res) => {
    const kuisId = req.params.id;
    
    // Query ini menggabungkan tabel hasil dengan data pelamar, diurutkan dari skor tertinggi, maksimal 5 orang
    const sql = `
        SELECT p.nama_lengkap AS nama, h.skor 
        FROM hasil_akademik h
        JOIN pelamar p ON h.pelamar_id = p.id
        WHERE h.kuis_id = ?
        ORDER BY h.skor DESC, h.tanggal_selesai ASC
        LIMIT 5
    `;
    
    db.query(sql, [kuisId], (err, results) => {
        if (err) {
            console.error('❌ Gagal mengambil leaderboard:', err);
            return res.status(500).json({ success: false, message: 'Gagal query database' });
        }
        res.json({ success: true, data: results });
    });
});

// ─── 12. API REGISTRASI PELAMAR BARU ───
app.post('/api/register', (req, res) => {
    const { nama_lengkap, nik, no_whatsapp, email, password, posisi_dilamar } = req.body;

    // 1. CEK GANDA: Apakah Email ATAU NIK sudah terdaftar?
    const checkDuplicateSql = "SELECT * FROM pelamar WHERE email = ? OR nik = ?";
    db.query(checkDuplicateSql, [email, nik], (err, results) => {
        if (err) {
            console.error('❌ Gagal cek duplikat:', err);
            return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
        }
        
        if (results.length > 0) {
            // Tentukan pesan error mana yang lebih spesifik
            if (results[0].email === email) {
                return res.status(400).json({ success: false, message: 'Email sudah terdaftar! Silakan gunakan email lain atau login.' });
            } else {
                return res.status(400).json({ success: false, message: 'NIK KTP ini sudah terdaftar di sistem kami!' });
            }
        }

        // 2. Jika aman, masukkan biodata ke tabel pelamar
        const insertPelamarSql = `INSERT INTO pelamar (nama_lengkap, nik, email, no_whatsapp, posisi_dilamar, tanggal_daftar, status_pelamar)
                                  VALUES (?, ?, ?, ?, ?, CURDATE(), 'Review')`;

        const posisi = posisi_dilamar || 'Belum Ditentukan';

        db.query(insertPelamarSql, [nama_lengkap, nik, email, no_whatsapp, posisi], (err, pelamarResult) => {
            if (err) {
                console.error('❌ Gagal insert pelamar:', err);
                return res.status(500).json({ success: false, message: 'Gagal menyimpan profil pelamar' });
            }

            const newPelamarId = pelamarResult.insertId;

            // 3. Buat akun login di tabel accounts
            const insertAccountSql = "INSERT INTO accounts (email, password, role, pelamar_id, nik) VALUES (?, ?, 'pelamar', ?, ?)";
            db.query(insertAccountSql, [email, password, newPelamarId, nik], (err, accountResult) => {
                if (err) {
                    console.error('❌ Gagal insert account:', err);
                    return res.status(500).json({ success: false, message: 'Gagal membuat kredensial login' });
                }

                res.json({ success: true, message: 'Registrasi berhasil! Silakan login.' });
            });
        });
    });
});

// ─── 18. API ADMIN: AMBIL DETAIL TALENT CARD PELAMAR ───
app.get('/api/admin/pelamar/:nik/detail', (req, res) => {
    const nik = req.params.nik;

    // 1. Cari ID Pelamar berdasarkan NIK
    db.query('SELECT id FROM pelamar WHERE nik = ?', [nik], (err, pRes) => {
        if (err || pRes.length === 0) return res.status(404).json({ success: false, message: 'Pelamar tidak ditemukan' });
        
        const pelamarId = pRes[0].id;
        
        // Struktur data kerangka yang akan dikirim ke Frontend
        let resultData = {
            akademik: { "Logika Dasar": "blm test", "Kemampuan Teknis": "blm test", "Bahasa Inggris": "blm test" },
            kraepelin: [],
            disc: [],
            papi: []
        };

        // KARENA KITA MENGGUNAKAN BANYAK TABEL, KITA GUNAKAN PROMISE UNTUK PARALEL QUERY
        const queryDB = (sql, params) => new Promise((resolve, reject) => db.query(sql, params, (e, r) => e ? reject(e) : resolve(r)));

        Promise.all([
            // Ambil data Akademik (Modifikasi sesuai nama kuis di database Anda jika perlu)
            queryDB(`SELECT k.nama_kuis, h.skor FROM hasil_akademik h JOIN kuis_akademik k ON h.kuis_id = k.id WHERE h.pelamar_id = ?`, [pelamarId]),
            // Ambil data Psikotes (Ambil yang terbaru jika ada)
            queryDB(`SELECT grafik_data FROM hasil_kraepelin WHERE pelamar_id = ? ORDER BY id DESC LIMIT 1`, [pelamarId]),
            queryDB(`SELECT grafik_data FROM hasil_disc WHERE pelamar_id = ? ORDER BY id DESC LIMIT 1`, [pelamarId]),
            queryDB(`SELECT grafik_data FROM hasil_papi WHERE pelamar_id = ? ORDER BY id DESC LIMIT 1`, [pelamarId])
        ]).then(([resAkademik, resKraepelin, resDisc, resPapi]) => {
            
            // Masukkan hasil Akademik
            resAkademik.forEach(row => { resultData.akademik[row.nama_kuis] = row.skor; });
            
            // Masukkan hasil Psikotes (Pecah string "12,15..." jadi array angka [12, 15...])
            if (resKraepelin.length > 0) resultData.kraepelin = resKraepelin[0].grafik_data.split(',').map(Number);
            if (resDisc.length > 0) resultData.disc = resDisc[0].grafik_data.split(',').map(Number);
            if (resPapi.length > 0) resultData.papi = resPapi[0].grafik_data.split(',').map(Number);

            res.json({ success: true, data: resultData });
            
        }).catch(err => {
            console.error(err);
            res.status(500).json({ success: false, message: 'Gagal merakit data' });
        });
    });
});

// ─── 19. API PELAMAR: SUBMIT HASIL KRAEPELIN ───
app.post('/api/user/submit-kraepelin', (req, res) => {
    const { pelamar_id, grafik_data } = req.body;
    
    // grafik_data dari frontend berbentuk array: [12, 14, 15, 11...]
    // MySQL menyimpannya sebagai string teks: "12,14,15,11"
    const dataString = grafik_data.join(',');

    const sql = "INSERT INTO hasil_kraepelin (pelamar_id, grafik_data, tanggal_tes) VALUES (?, ?, NOW())";
    db.query(sql, [pelamar_id, dataString], (err, result) => {
        if (err) {
            console.error('❌ Gagal menyimpan Kraepelin:', err);
            return res.status(500).json({ success: false, message: 'Gagal menyimpan hasil tes.' });
        }
        res.json({ success: true, message: 'Tes Kraepelin selesai dan berhasil disimpan!' });
    });
});

// ─── 20. API PELAMAR: AMBIL INFO KUIS & DAFTAR SOAL (VERSI ADAPTIF & STRICT LIMIT) ───
app.get('/api/user/kuis/:id/soal', (req, res) => {
    const kuisId = req.params.id;
    const pelamarId = req.query.pelamarId; // WAJIB DIKIRIM DARI FRONTEND

    if (!pelamarId || pelamarId === 'undefined' || pelamarId === 'null') {
        return res.status(401).json({ success: false, message: 'Akses Ditolak: Sesi pelamar tidak valid.' });
    }

    const checkSql = `
        SELECT k.id FROM kuis_akademik k
        JOIN pelamar p ON p.id = ?
        WHERE k.id = ? 
        AND (
            k.target_posisi = 'Semua Posisi'
            OR k.id IN (SELECT kuis_id FROM kuis_target_posisi WHERE target_posisi = 'Semua Posisi')
            OR k.target_posisi = p.posisi_dilamar
            OR k.id IN (SELECT kuis_id FROM kuis_target_posisi WHERE target_posisi = p.posisi_dilamar)
        )
    `;

    db.query(checkSql, [pelamarId, kuisId], (err, checkRes) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        if (checkRes.length === 0) return res.status(403).json({ success: false, message: 'Akses Ditolak.' });

        // AMBIL JUMLAH SOAL SEBAGAI LIMIT (Fix Question Mismatch)
        db.query('SELECT nama_kuis, durasi_menit, jumlah_soal FROM kuis_akademik WHERE id = ?', [kuisId], (err, kuisRes) => {
            if (err || kuisRes.length === 0) return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan' });
            
            const infoKuis = kuisRes[0];
            const limitSoal = Number(infoKuis.jumlah_soal); 
            
            db.query('SELECT * FROM soal_akademik WHERE kuis_id = ? ORDER BY RAND() LIMIT ?', [kuisId, limitSoal], (err, soalRes) => {
                if (err) return res.status(500).json({ success: false, message: 'Database error' });
                
                const soalAman = soalRes.map(soal => {
                    let opsiObj = {};
                    if (soal.opsi_jawaban) {
                        try { 
                            opsiObj = typeof soal.opsi_jawaban === 'string' ? JSON.parse(soal.opsi_jawaban) : soal.opsi_jawaban; 
                            while (typeof opsiObj === 'string') opsiObj = JSON.parse(opsiObj); 
                        } catch (e) { console.error("JSON error di soal ID " + soal.id); }
                    } else {
                        if(soal.opsi_a) opsiObj['A'] = soal.opsi_a;
                        if(soal.opsi_b) opsiObj['B'] = soal.opsi_b;
                        if(soal.opsi_c) opsiObj['C'] = soal.opsi_c;
                        if(soal.opsi_d) opsiObj['D'] = soal.opsi_d;
                    }
                    return { id: soal.id, tipe_soal: soal.tipe_soal, pertanyaan: soal.pertanyaan, opsi_jawaban: opsiObj };
                });
                
                res.json({ success: true, info: infoKuis, soal: soalAman });
            });
        });
    });
});

// ─── 21. API PELAMAR: SUBMIT JAWABAN KUIS AKADEMIK ───
app.post('/api/user/submit-kuis', (req, res) => {
    const { pelamar_id, kuis_id, jawaban } = req.body;
    // Format jawaban dari frontend: { "id_soal_1": "A", "id_soal_2": "C", ... }

    // 1. Tarik kunci jawaban asli dari database
    db.query('SELECT id, kunci_jawaban FROM soal_akademik WHERE kuis_id = ?', [kuis_id], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        let skor = 0;
        const bobotPerSoal = 100 / rows.length;

        // 2. Koreksi jawaban pelamar
        rows.forEach(soal => {
            if (jawaban[soal.id] === soal.kunci_jawaban) {
                skor += bobotPerSoal; // Tambah nilai jika benar
            }
        });

        const skorAkhir = Math.round(skor); // Bulatkan nilai (misal 83.33 jadi 83)

        // 3. Masukkan hasilnya ke tabel hasil_akademik
        const sqlInsert = 'INSERT INTO hasil_akademik (pelamar_id, kuis_id, skor, status_pengerjaan, tanggal_selesai) VALUES (?, ?, ?, ?, NOW())';
        db.query(sqlInsert, [pelamar_id, kuis_id, skorAkhir, 'Selesai'], (err2) => {
            if (err2) return res.status(500).json({ success: false, message: 'Gagal menyimpan skor' });
            
            res.json({ success: true, skor: skorAkhir });
        });
    });
});

// ─── 22. API PELAMAR: CEK STATUS UJIAN (UNTUK DASHBOARD) ───
app.get('/api/user/status-ujian/:pelamar_id', (req, res) => {
    const pelamarId = req.params.pelamar_id;

    // 1. Cek Kuis Akademik
    db.query('SELECT kuis_id FROM hasil_akademik WHERE pelamar_id = ? AND status_pengerjaan = "Selesai"', [pelamarId], (err, akademikRes) => {
        if (err) return res.status(500).json({ success: false });
        const kuisSelesai = akademikRes.map(row => row.kuis_id);

        // 2. Cek Tes Kraepelin
        db.query('SELECT id FROM hasil_kraepelin WHERE pelamar_id = ? LIMIT 1', [pelamarId], (err, kraepelinRes) => {
            const kraepelinSelesai = kraepelinRes && kraepelinRes.length > 0;

            // 3. Cek Tes DISC
            db.query('SELECT id FROM hasil_disc WHERE pelamar_id = ? LIMIT 1', [pelamarId], (err, discRes) => {
                const discSelesai = discRes && discRes.length > 0;

                // 4. Cek Tes PAPI Kostick (BARU DITAMBAHKAN)
                db.query('SELECT id FROM hasil_papi WHERE pelamar_id = ? LIMIT 1', [pelamarId], (err, papiRes) => {
                    const papiSelesai = papiRes && papiRes.length > 0;

                    // Kirim laporan lengkap ke Dashboard User
                    res.json({
                        success: true,
                        akademik_selesai: kuisSelesai,
                        kraepelin_selesai: kraepelinSelesai,
                        disc_selesai: discSelesai,
                        papi_selesai: papiSelesai // Data kunci PAPI dikirim ke Frontend
                    });
                });
            });
        });
    });
});

// ─── 23. API ADMIN: MANAJEMEN BANK SOAL ───

// A. Ambil semua soal berdasarkan Modul (Kuis ID)
app.get('/api/admin/soal/:kuis_id', (req, res) => {
    db.query('SELECT * FROM soal_akademik WHERE kuis_id = ? ORDER BY id DESC', [req.params.kuis_id], (err, rows) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: rows });
    });
});

// B. Tambah Soal Baru (Sistem Opsi ENDLESS / JSON)
app.post('/api/admin/soal', (req, res) => {
    // Tangkap opsi_jawaban (Berupa Objek Dinamis) dari frontend
    const { kuis_id, tipe_soal, pertanyaan, opsi_jawaban, kunci_jawaban } = req.body;
    
    // Ubah Objek menjadi String JSON agar bisa masuk ke MySQL
    const opsiJSON = opsi_jawaban ? JSON.stringify(opsi_jawaban) : null;
    
    const sql = 'INSERT INTO soal_akademik (kuis_id, tipe_soal, pertanyaan, opsi_jawaban, kunci_jawaban) VALUES (?, ?, ?, ?, ?)';
    
    db.query(sql, [kuis_id, tipe_soal || 'Pilihan Ganda', pertanyaan, opsiJSON, kunci_jawaban], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, message: 'Soal berhasil ditambahkan' });
    });
});

// C. Hapus Soal
app.delete('/api/admin/soal/:id', (req, res) => {
    db.query('DELETE FROM soal_akademik WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, message: 'Soal dihapus' });
    });
});

// ─── 24. API ADMIN: REFERENSI RUMPUN ILMU (DARI DATABASE - 3 TINGKAT) ───
app.get('/api/admin/referensi-ilmu', (req, res) => {
    db.query('SELECT rumpun_ilmu, pohon_ilmu, cabang_ilmu FROM referensi_ilmu ORDER BY rumpun_ilmu, pohon_ilmu, cabang_ilmu', (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        const referensi = {};
        rows.forEach(row => {
            if (!row.rumpun_ilmu || !row.pohon_ilmu || !row.cabang_ilmu) return; 

            if (!referensi[row.rumpun_ilmu]) referensi[row.rumpun_ilmu] = {};
            if (!referensi[row.rumpun_ilmu][row.pohon_ilmu]) referensi[row.rumpun_ilmu][row.pohon_ilmu] = [];
            
            if (!referensi[row.rumpun_ilmu][row.pohon_ilmu].includes(row.cabang_ilmu)) {
                referensi[row.rumpun_ilmu][row.pohon_ilmu].push(row.cabang_ilmu);
            }
        });

        res.json({ success: true, data: referensi });
    });
});

// ─── 25. API ADMIN: DAFTAR PEKERJAAN (TARGET POSISI) ───
app.get('/api/admin/pekerjaan', (req, res) => {
    db.query('SELECT nama_posisi, deskripsi FROM daftar_pekerjaan ORDER BY nama_posisi ASC', (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, data: rows });
    });
});

// ─── 26. API ADMIN: STATISTIK DASHBOARD (TOTAL, SKOR, LULUS, TREN HARIAN) ───
app.get('/api/admin/dashboard-stats', (req, res) => {
    const queryDB = (sql, params = []) => new Promise((resolve, reject) =>
        db.query(sql, params, (e, r) => e ? reject(e) : resolve(r))
    );

    Promise.all([
        // 1. Total semua pelamar
        queryDB("SELECT COUNT(*) AS total FROM pelamar"),
        
        // 2. Total Kuis Selesai (Akumulasi semua waktu hingga detik ini)
        queryDB("SELECT COUNT(*) AS total FROM hasil_akademik WHERE status_pengerjaan = 'Selesai'"),
        
        // 3. Total Kuis Selesai (Akumulasi hingga akhir hari KEMARIN)
        queryDB("SELECT COUNT(*) AS total FROM hasil_akademik WHERE status_pengerjaan = 'Selesai' AND DATE(tanggal_selesai) < CURDATE()"),
        
        // 4. Rata-rata skor semua kuis
        queryDB("SELECT COALESCE(ROUND(AVG(skor)), 0) AS avg_skor FROM hasil_akademik WHERE status_pengerjaan = 'Selesai'"),
        
        // 5. Pelamar yang statusnya "Diterima"
        queryDB("SELECT COUNT(*) AS total FROM pelamar WHERE status_pelamar = 'Diterima'"),
        
        // 6. Pelamar baru hari ini
        queryDB("SELECT COUNT(*) AS total FROM pelamar WHERE DATE(created_at) = CURDATE()")
    ]).then(([totalRes, kuisSekarangRes, kuisKemarinRes, skorRes, lulusRes, baruRes]) => {
        
        // --- LOGIKA TREN KENAIKAN (Persentase Harian) ---
        let totalKuisSekarang = kuisSekarangRes[0].total;
        let totalKuisKemarin = kuisKemarinRes[0].total;
        let trenKuis = 0;
        
        if (totalKuisKemarin === 0) {
            // Sesuai Aturan Anda: Khusus hari pertama (data kemarin kosong), set jadi 0
            trenKuis = 0; 
        } else {
            // Rumus Persentase Kenaikan: ((Sekarang - Kemarin) / Kemarin) * 100
            trenKuis = ((totalKuisSekarang - totalKuisKemarin) / totalKuisKemarin) * 100;
        }

        res.json({
            success: true,
            data: {
                total_pelamar:  totalRes[0].total,
                total_kuis_selesai: totalKuisSekarang,
                total_kuis_kemarin: totalKuisKemarin, // Kirim angka mentah kemarin
                tren_kuis_selesai: trenKuis,
                rata_rata_skor:  skorRes[0].avg_skor,
                lulus_seleksi:   lulusRes[0].total,
                pendaftar_baru:  baruRes[0].total
                }
        });
    }).catch(err => {
        console.error('❌ Gagal mengambil dashboard stats:', err);
        res.status(500).json({ success: false, message: 'Gagal query database' });
    });
});

// ─── 27. API PELAMAR: AMBIL PROFIL & STATUS (MEMPERBAIKI DASHBOARD STUCK) ───
app.get('/api/user/profil/:id', (req, res) => {
    db.query('SELECT posisi_dilamar FROM pelamar WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        if (results.length === 0) return res.status(404).json({ success: false, message: 'Pelamar tidak ditemukan' });
        res.json({ success: true, data: { posisi_dilamar: results[0].posisi_dilamar } });
    });
});

// ─── 28. API PELAMAR: PILIH PEKERJAAN (JIKA BELUM MEMILIH) ───
app.put('/api/user/pilih-pekerjaan', (req, res) => {
    const { pelamar_id, posisi_dilamar } = req.body;
    db.query('UPDATE pelamar SET posisi_dilamar = ? WHERE id = ?', [posisi_dilamar, pelamar_id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true });
    });
});

// ─── 29. API PELAMAR: DAFTAR KUIS TERSEDIA (SESUAI POSISI) ───
app.get('/api/user/kuis-tersedia/:pelamarId', (req, res) => {
    const pelamarId = req.params.pelamarId;
    db.query('SELECT posisi_dilamar FROM pelamar WHERE id = ?', [pelamarId], (err, pRes) => {
        if (err || pRes.length === 0) return res.status(404).json({ success: false, message: 'Pelamar tidak ditemukan' });

        const posisiUser = (pRes[0]?.posisi_dilamar || '').trim();
        const sql = `
            SELECT * FROM kuis_akademik
            WHERE target_posisi = 'Semua Posisi'
               OR id IN (SELECT kuis_id FROM kuis_target_posisi WHERE TRIM(target_posisi) = 'Semua Posisi')
               OR target_posisi = ?
               OR id IN (SELECT kuis_id FROM kuis_target_posisi WHERE target_posisi = ?)
        `;
        db.query(sql, [posisiUser, posisiUser], (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: 'Database error' });
            res.json({ success: true, data: rows });
        });
    });
});

// ─── 30. API BANK SOAL DISC ───
app.get('/api/user/soal-disc', (req, res) => {
    db.query('SELECT * FROM soal_disc ORDER BY id ASC', (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, data: rows });
    });
});
app.get('/api/admin/soal-disc', (req, res) => {
    db.query('SELECT * FROM soal_disc ORDER BY id ASC', (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, data: rows });
    });
});

// ─── 31. API PELAMAR: AMBIL SOAL PAPI KOSTICK ───
app.get('/api/user/soal-papi', (req, res) => {
    db.query('SELECT id, pernyataan_a, pernyataan_b FROM soal_papi ORDER BY id ASC', (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        res.json({ success: true, data: rows });
    });
});

// ─── 32. API PELAMAR: SUBMIT & ALGORITMA SKORING PAPI KOSTICK ───
app.post('/api/user/submit-papi', (req, res) => {
    const { pelamar_id, jawaban } = req.body;
    db.query('SELECT id, dimensi_a, dimensi_b FROM soal_papi', (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        const skorPapi = { G:0, L:0, I:0, T:0, V:0, S:0, R:0, D:0, C:0, E:0, N:0, A:0, P:0, X:0, B:0, O:0, K:0, F:0, W:0, Z:0 };
        rows.forEach(soal => {
            const jawab = jawaban[soal.id];
            if (jawab === 'A' && soal.dimensi_a) skorPapi[soal.dimensi_a] += 1;
            else if (jawab === 'B' && soal.dimensi_b) skorPapi[soal.dimensi_b] += 1;
        });

        const urutanDimensi = ['G','L','I','T','V','S','R','D','C','E','N','A','P','X','B','O','K','F','W','Z'];
        const grafikDataString = urutanDimensi.map(dimensi => skorPapi[dimensi] || 0).join(',');

        db.query("INSERT INTO hasil_papi (pelamar_id, grafik_data, tanggal_tes) VALUES (?, ?, NOW())", [pelamar_id, grafikDataString], (errInsert) => {
            if (errInsert) return res.status(500).json({ success: false, message: 'Gagal menyimpan skor' });
            res.json({ success: true, message: 'Tes PAPI selesai.' });
        });
    });
});

// ─── 33. API ADMIN: LAPORAN PSIKOGRAM (HALAMAN ANALITIK) ───
app.get('/api/admin/laporan-psikogram', (req, res) => {
    const queryDB = (sql) => new Promise((resolve, reject) => db.query(sql, (err, result) => err ? reject(err) : resolve(result)));

    Promise.all([
        queryDB("SELECT grafik_data FROM hasil_kraepelin"),
        queryDB("SELECT grafik_data FROM hasil_disc"),
        queryDB("SELECT grafik_data FROM hasil_papi")
    ]).then(([kRes, dRes, pRes]) => {
        
        // 1. OLAH DATA KRAEPELIN (Kecepatan Rata-rata)
        let kPeserta = kRes.length, kSpeed = 0, kAcc = 95, kChart = new Array(10).fill(0);
        if (kPeserta > 0) {
            let totalSpeed = 0;
            kRes.forEach(row => {
                let arr = row.grafik_data.split(',').map(Number);
                totalSpeed += (arr.reduce((a, b) => a + b, 0) / arr.length);
                for(let i=0; i<10 && i<arr.length; i++) kChart[i] += arr[i];
            });
            kSpeed = Math.round(totalSpeed / kPeserta);
            kChart = kChart.map(v => Math.round(v / kPeserta));
        }

        // 2. OLAH DATA DISC (Persentase Kepribadian)
        let dPeserta = dRes.length, dMaj = "-", dSub = "-", dPct1 = 0, dPct2 = 0, dChart = [0, 0, 0, 0];
        if (dPeserta > 0) {
            dRes.forEach(row => {
                let arr = row.grafik_data.split(',').map(Number);
                for(let i=0; i<4; i++) dChart[i] += arr[i];
            });
            dChart = dChart.map(v => Math.round(v / dPeserta));
            
            const labels = ['D','I','S','C'];
            let sorted = dChart.map((val, idx) => ({val, label: labels[idx]})).sort((a,b) => b.val - a.val);
            dMaj = sorted[0].label; dPct1 = sorted[0].val;
            dSub = sorted[1].label; dPct2 = sorted[1].val;
        }

        // 3. OLAH DATA PAPI KOSTICK (Radar 20 Dimensi)
        let pPeserta = pRes.length, pLScore = 0, pWScore = 0, pChart = new Array(20).fill(0);
        if (pPeserta > 0) {
            pRes.forEach(row => {
                let arr = row.grafik_data.split(',').map(Number);
                for(let i=0; i<20; i++) pChart[i] += arr[i];
            });
            pChart = pChart.map(v => Math.round(v / pPeserta));
            pLScore = pChart[1];  // Index 1 adalah Dimensi L (Leadership)
            pWScore = pChart[18]; // Index 18 adalah Dimensi W (Rules/Aturan)
        }

        // Kirim struktur JSON yang TEPAT seperti yang diminta Frontend
        res.json({
            success: true,
            data: {
                kraepelin: { peserta: kPeserta, speed: kSpeed, acc: kAcc, chart: kChart },
                disc: { peserta: dPeserta, maj: dMaj, sub: dSub, pct1: dPct1, pct2: dPct2, chart: dChart },
                papi: { peserta: pPeserta, l_score: pLScore, w_score: pWScore, chart: pChart }
            }
        });
    }).catch(err => {
        console.error('Laporan Psikogram Error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    });
});

// ─── SATU-SATUNYA APP.LISTEN (JANGAN ADA DUPLIKAT) ───
app.listen(PORT, () => {
    console.log(`🚀 Server API berjalan di http://localhost:${PORT}`);
});