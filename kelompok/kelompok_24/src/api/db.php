<?php
// src/db.php

// WAJIB: Mulai output buffering untuk menangkap semua output yang tidak diinginkan
ob_start();

require_once 'config.php'; 

function connectDB() {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        
        // PENTING: Bersihkan buffer yang mungkin berisi spasi/newline dari file include
        ob_clean();
        
        return $pdo;
    } catch (\PDOException $e) {
        // Jika koneksi gagal, hentikan buffer dan kirim JSON error
        ob_end_clean();
        
        error_log("Database Connection Error: " . $e->getMessage());
        
        // Kirim header JSON sebelum kirim error
        header("Content-Type: application/json");
        http_response_code(500); 
        
        die(json_encode([
            'success' => false, 
            'message' => 'Terjadi kesalahan koneksi database: ' . $e->getMessage()
        ]));
    }
}
?>