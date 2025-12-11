<?php
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
        
        ob_clean();
        
        return $pdo;
    } catch (\PDOException $e) {
        
        ob_end_clean();
        
        error_log("Database Connection Error: " . $e->getMessage());
        
        header("Content-Type: application/json");
        http_response_code(500); 
        
        die(json_encode([
            'success' => false, 
            'message' => 'Terjadi kesalahan koneksi database: ' . $e->getMessage()
        ]));
    }
}