<?php
// src/db.php
// Panggil file konfigurasi
require_once 'config.php'; 

/**
 * Mendapatkan koneksi ke database 'warkops_db' menggunakan PDO.
 *
 * Fungsi ini menggunakan PDO untuk koneksi yang aman. Jika koneksi gagal,
 * skrip akan dihentikan, mencatat error, dan mengirim respons 500.
 * * @return PDO Objek koneksi database yang berhasil.
 */
function connectDB() {
    // 1. Data Source Name (DSN)
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;

    // 2. Opsi konfigurasi PDO
    $options = [
        // Mengaktifkan mode exception untuk error SQL
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        // Mengatur hasil fetch default ke array asosiatif
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Menonaktifkan emulasi prepared statement (keamanan & kinerja)
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        // Membuat instance PDO baru
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (\PDOException $e) {
        // Penanganan Error Koneksi: Log error dan hentikan skrip.
        // error_log() digunakan untuk mencatat error tanpa menampilkannya langsung ke pengguna.
        error_log("Database Connection Error: " . $e->getMessage());
        
        // Mengirimkan respons HTTP 500 (Internal Server Error)
        http_response_code(500); 
        
        // Hentikan eksekusi skrip dan kirim pesan error (format JSON)
        die(json_encode([
            'success' => false, 
            'message' => 'Terjadi kesalahan koneksi database. Silakan coba lagi nanti.'
        ]));
    }
}