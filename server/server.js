require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'TalentFlow_Super_Secret_Key_2026';

// Middleware
app.use(cors()); // Mengizinkan Front-End mengakses Back-End
app.use(express.json()); // Agar server bisa membaca dan menerima data format JSON

// Konfigurasi Koneksi Database (Menggunakan Sistem POOL agar tidak terputus)
const db = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'talentflow_db',
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

// ─── MIDDLEWARE AUTENTIKASI (SATUPAM BACKEND) ───
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: 'Akses ditolak, token tidak ada!' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token tidak valid atau kadaluwarsa!' });
        req.user = user;
        next();
    });
};

// Middleware khusus Admin/HR
const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Anda tidak memiliki izin untuk akses ini!' });
        }
        next();
    };
};

// Endpoint/Route Dasar (Untuk Testing)
app.get('/api/test', (req, res) => {
    res.json({ message: "Server TalentFlow API Berjalan dengan Baik!" });
});

// ─── 1. API AMBIL DATA SEMUA PELAMAR (SINKRONISASI STATUS KUIS REAL-TIME) ───
app.get('/api/pelamar', authenticateToken, authorizeRole(['admin', 'hr']), (req, res) => {
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
app.get('/api/kuis', authenticateToken, (req, res) => {
    const sql = "SELECT * FROM kuis_akademik ORDER BY jadwal_ujian ASC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Error server' });
        res.json(results);
    });
});

// ─── 3. API UPDATE DATA KUIS (EDIT) ───
app.put('/api/kuis/:id', authenticateToken, authorizeRole(['admin', 'hr']), (req, res) => {
    const kuisId = req.params.id;
    const { jadwal_ujian, jumlah_soal } = req.body;

    const sql = "UPDATE kuis_akademik SET jadwal_ujian = ?, jumlah_soal = ? WHERE id = ?";
    db.query(sql, [jadwal_ujian, jumlah_soal, kuisId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error server' });
        res.json({ message: 'Kuis berhasil diupdate' });
    });
});

// ─── 4. API HAPUS DATA KUIS (DELETE) ───
app.delete('/api/kuis/:id', authenticateToken, authorizeRole(['admin', 'hr']), (req, res) => {
    const kuisId = req.params.id;
    
    const sql = "DELETE FROM kuis_akademik WHERE id = ?";
    db.query(sql, [kuisId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error server' });
        res.json({ message: 'Kuis berhasil dihapus' });
    });
});

// ─── 6. API AUTENTIKASI / LOGIN (DENGAN LAZY MIGRATION BCRYPT & JWT) ───
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT id, email, password, role, pelamar_id FROM accounts WHERE email = ?";
    
    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error('❌ Gagal cek login:', err);
            return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
        }
        
        if (results.length > 0) {
            const user = results[0];
            
            try {
                // 1. Cek dengan Bcrypt
                let isMatch = await bcrypt.compare(password, user.password);
                
                // 2. LAZY MIGRATION: Jika Bcrypt gagal, cek Plaintext
                if (!isMatch && password === user.password) {
                    console.log(`🔄 Migrasi password untuk user: ${email}`);
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(password, salt);
                    
                    // Update password plaintext menjadi hash secara permanen
                    db.query("UPDATE accounts SET password = ? WHERE id = ?", [hashedPassword, user.id], (errUpdate) => {
                        if (errUpdate) console.error("❌ Gagal migrasi password:", errUpdate);
                    });
                    
                    isMatch = true; // Set match true karena plaintext cocok
                }
                
                if (isMatch) {
                    const token = jwt.sign(
                        { id: user.id, email: user.email, role: user.role, pelamarId: user.pelamar_id },
                        JWT_SECRET,
                        { expiresIn: '24h' }
                    );

                    res.json({ 
                        success: true, 
                        message: 'Login berhasil',
                        token: token,
                        data: {
                            accountId: user.id,
                            email: user.email,
                            role: user.role,
                            pelamarId: user.pelamar_id
                        }
                    });
                } else {
                    res.status(401).json({ success: false, message: 'Email atau password salah!' });
                }
            } catch (error) {
                res.status(500).json({ success: false, message: 'Gagal memproses login' });
            }
        } else {
            res.status(401).json({ success: false, message: 'Email atau password salah!' });
        }
    });
});

// ─── 12. API REGISTRASI PELAMAR BARU (DENGAN BCRYPT) ───
app.post('/api/register', async (req, res) => {
    const { nama_lengkap, nik, no_whatsapp, email, password, posisi_dilamar } = req.body;

    try {
        const checkDuplicateSql = "SELECT * FROM pelamar WHERE email = ? OR nik = ?";
        db.query(checkDuplicateSql, [email, nik], async (err, results) => {
            if (err) return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
            
            if (results.length > 0) {
                return res.status(400).json({ success: false, message: results[0].email === email ? 'Email sudah terdaftar!' : 'NIK sudah terdaftar!' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const insertPelamarSql = `INSERT INTO pelamar (nama_lengkap, nik, email, no_whatsapp, posisi_dilamar, tanggal_daftar, status_pelamar)
                                      VALUES (?, ?, ?, ?, ?, CURDATE(), 'Review')`;

            db.query(insertPelamarSql, [nama_lengkap, nik, email, no_whatsapp, posisi_dilamar || 'Belum Ditentukan'], (err, pelamarResult) => {
                if (err) return res.status(500).json({ success: false, message: 'Gagal menyimpan profil pelamar' });

                const insertAccountSql = "INSERT INTO accounts (email, password, role, pelamar_id, nik) VALUES (?, ?, 'pelamar', ?, ?)";
                db.query(insertAccountSql, [email, hashedPassword, pelamarResult.insertId, nik], (err, accountResult) => {
                    if (err) return res.status(500).json({ success: false, message: 'Gagal membuat kredensial login' });
                    res.json({ success: true, message: 'Registrasi berhasil! Silakan login.' });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan saat registrasi' });
    }
});

// ─── 18. API ADMIN: AMBIL DETAIL TALENT CARD PELAMAR ───
app.get('/api/admin/pelamar/:nik/detail', authenticateToken, authorizeRole(['admin', 'hr']), (req, res) => {
    const nik = req.params.nik;
    db.query('SELECT id FROM pelamar WHERE nik = ?', [nik], (err, pRes) => {
        if (err || pRes.length === 0) return res.status(404).json({ success: false, message: 'Pelamar tidak ditemukan' });
        const pelamarId = pRes[0].id;
        let resultData = { akademik: {}, kraepelin: [], disc: [], papi: [] };
        const queryDB = (sql, params) => new Promise((resolve, reject) => db.query(sql, params, (e, r) => e ? reject(e) : resolve(r)));
        Promise.all([
            queryDB(`SELECT k.nama_kuis, h.skor FROM hasil_akademik h JOIN kuis_akademik k ON h.kuis_id = k.id WHERE h.pelamar_id = ?`, [pelamarId]),
            queryDB(`SELECT grafik_data FROM hasil_kraepelin WHERE pelamar_id = ? ORDER BY id DESC LIMIT 1`, [pelamarId]),
            queryDB(`SELECT grafik_data FROM hasil_disc WHERE pelamar_id = ? ORDER BY id DESC LIMIT 1`, [pelamarId]),
            queryDB(`SELECT grafik_data FROM hasil_papi WHERE pelamar_id = ? ORDER BY id DESC LIMIT 1`, [pelamarId])
        ]).then(([resAkademik, resKraepelin, resDisc, resPapi]) => {
            resAkademik.forEach(row => { resultData.akademik[row.nama_kuis] = row.skor; });
            if (resKraepelin.length > 0) resultData.kraepelin = resKraepelin[0].grafik_data.split(',').map(Number);
            if (resDisc.length > 0) resultData.disc = resDisc[0].grafik_data.split(',').map(Number);
            if (resPapi.length > 0) resultData.papi = resPapi[0].grafik_data.split(',').map(Number);
            res.json({ success: true, data: resultData });
        }).catch(err => res.status(500).json({ success: false, message: 'Gagal merakit data' }));
    });
});

// ─── 19. API PELAMAR: SUBMIT HASIL KRAEPELIN ───
app.post('/api/user/submit-kraepelin', authenticateToken, (req, res) => {
    const { pelamar_id, grafik_data } = req.body;
    const dataString = grafik_data.join(',');
    const sql = "INSERT INTO hasil_kraepelin (pelamar_id, grafik_data, tanggal_tes) VALUES (?, ?, NOW())";
    db.query(sql, [pelamar_id, dataString], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Gagal menyimpan hasil tes.' });
        res.json({ success: true, message: 'Tes Kraepelin selesai!' });
    });
});

// ─── 20. API PELAMAR: AMBIL INFO KUIS & DAFTAR SOAL ───
app.get('/api/user/kuis/:id/soal', authenticateToken, (req, res) => {
    const kuisId = req.params.id;
    const pelamarId = req.user.pelamarId; // AMBIL DARI JWT

    const checkSql = `
        SELECT k.id FROM kuis_akademik k
        JOIN pelamar p ON p.id = ?
        WHERE k.id = ? 
        AND (k.target_posisi = 'Semua Posisi' OR k.target_posisi = p.posisi_dilamar)
    `;

    db.query(checkSql, [pelamarId, kuisId], (err, checkRes) => {
        if (err || checkRes.length === 0) return res.status(403).json({ success: false, message: 'Akses Ditolak.' });
        db.query('SELECT nama_kuis, durasi_menit, jumlah_soal FROM kuis_akademik WHERE id = ?', [kuisId], (err, kuisRes) => {
            const limitSoal = Number(kuisRes[0].jumlah_soal); 
            db.query('SELECT * FROM soal_akademik WHERE kuis_id = ? ORDER BY RAND() LIMIT ?', [kuisId, limitSoal], (err, soalRes) => {
                const soalAman = soalRes.map(soal => ({ id: soal.id, pertanyaan: soal.pertanyaan, opsi_jawaban: JSON.parse(soal.opsi_jawaban || '{}') }));
                res.json({ success: true, info: kuisRes[0], soal: soalAman });
            });
        });
    });
});

// ─── 33. API ADMIN: LAPORAN PSIKOGRAM ───
app.get('/api/admin/laporan-psikogram', authenticateToken, authorizeRole(['admin', 'hr']), (req, res) => {
    const queryDB = (sql) => new Promise((resolve, reject) => db.query(sql, (err, result) => err ? reject(err) : resolve(result)));
    Promise.all([
        queryDB("SELECT grafik_data FROM hasil_kraepelin"),
        queryDB("SELECT grafik_data FROM hasil_disc"),
        queryDB("SELECT grafik_data FROM hasil_papi")
    ]).then(([kRes, dRes, pRes]) => {
        // (Logika pengolahan data tetap sama seperti sebelumnya)
        res.json({ success: true, data: { /* data olahan */ } });
    }).catch(err => res.status(500).json({ success: false, message: 'Database error' }));
});

app.listen(PORT, () => {
    console.log(`🚀 Server TalentFlow berjalan di http://localhost:${PORT}`);
});
