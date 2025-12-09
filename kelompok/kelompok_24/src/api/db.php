<?php
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
        return $pdo;
    } catch (\PDOException $e) {
        error_log("Database Connection Error: " . $e->getMessage());
        http_response_code(500); 
        die(json_encode([
            'success' => false, 
            'message' => 'Terjadi kesalahan koneksi database.'
        ]));
    }
}
?>