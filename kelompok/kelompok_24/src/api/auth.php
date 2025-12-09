<?php
// src/api/auth.php

require_once '../config.php';
require_once '../db.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$pdo = connectDB(); 
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    handleLogin($pdo);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
}

function handleLogin($pdo) {
    $data = json_decode(file_get_contents("php://input"), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Username dan password wajib diisi.']);
        return;
    }

    try {
        // 1. Cari user yang aktif
        $sql = "SELECT user_id, username, password_hash, full_name, role FROM users WHERE username = :username AND is_active = TRUE";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch();

        if ($user) {
            // 2. Verifikasi Password
            if (password_verify($password, $user['password_hash'])) {
                
                // Login Berhasil: Kirim data sesi yang dibutuhkan frontend
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'message' => 'Login berhasil!',
                    'user_data' => [
                        'id' => $user['user_id'],
                        'name' => $user['full_name'],
                        'role' => $user['role'],
                    ]
                ]);
            } else {
                // Password salah
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Username atau password salah.']);
            }
        } else {
            // User tidak ditemukan atau tidak aktif
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Username atau password salah.']);
        }
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan sistem.']);
    }
}