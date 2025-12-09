<?php
require_once '../config.php';
require_once '../db.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$pdo = connectDB(); 
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetRequest($pdo);
        break;
    case 'POST':
        handlePostRequest($pdo);
        break;
    case 'PUT':
        handlePutRequest($pdo);
        break;
    case 'DELETE':
        handleDeleteRequest($pdo);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method ' . $method . ' not allowed.']);
        break;
}

function handleGetRequest($pdo) {
    try {
        $user_id = isset($_GET['id']) ? (int)$_GET['id'] : null;

        if ($user_id) {
            $sql = "SELECT user_id, username, full_name, role, is_active FROM users WHERE user_id = :id AND is_active = TRUE";
            $stmt = $pdo->prepare($sql);
            $stmt->execute(['id' => $user_id]);
            $user = $stmt->fetch();

            if ($user) {
                http_response_code(200);
                echo json_encode(['success' => true, 'data' => $user]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User not found.']);
            }
        } else {
            $sql = "SELECT user_id, username, full_name, role, is_active FROM users WHERE is_active = TRUE ORDER BY user_id DESC";
            $stmt = $pdo->query($sql);
            $users = $stmt->fetchAll();

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $users]);
        }
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal mengambil data user: ' . $e->getMessage()]);
    }
}

function handlePostRequest($pdo) {
    $data = json_decode(file_get_contents("php://input"), true);

    if (
        !isset($data['username']) || 
        !isset($data['password']) || 
        !isset($data['full_name']) || 
        !isset($data['role'])
    ) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Data yang diperlukan tidak lengkap.']);
        return;
    }
    
    $username = $data['username'];
    $password = $data['password'];
    $full_name = $data['full_name'];
    $role = $data['role'];

    if (!in_array($role, ['admin', 'kasir'])) {
        http_response_code(400); 
        echo json_encode(['success' => false, 'message' => 'Nilai role tidak valid.']);
        return;
    }

    $password_hash = password_hash($password, PASSWORD_BCRYPT);

    try {
        $sql = "INSERT INTO users (username, password_hash, full_name, role) VALUES (:username, :hash, :full_name, :role)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            'username' => $username,
            'hash' => $password_hash,
            'full_name' => $full_name,
            'role' => $role
        ]);

        http_response_code(201);
        echo json_encode(['success' => true, 'message' => 'User berhasil ditambahkan.', 'id' => $pdo->lastInsertId()]);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') {
             http_response_code(409);
             echo json_encode(['success' => false, 'message' => 'Username sudah digunakan.']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Gagal menambahkan user: ' . $e->getMessage()]);
        }
    }
}

function handlePutRequest($pdo) {
    $user_id = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $data = json_decode(file_get_contents("php://input"), true);

    if (!$user_id || !isset($data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID pengguna atau data yang dikirim tidak valid.']);
        return;
    }
    
    $set_clauses = [];
    $execute_params = ['id' => $user_id];

    if (isset($data['username'])) {
        $set_clauses[] = "username = :username";
        $execute_params['username'] = $data['username'];
    }
    if (isset($data['full_name'])) {
        $set_clauses[] = "full_name = :full_name";
        $execute_params['full_name'] = $data['full_name'];
    }
    if (isset($data['role']) && in_array($data['role'], ['admin', 'kasir'])) {
        $set_clauses[] = "role = :role";
        $execute_params['role'] = $data['role'];
    }
    if (isset($data['password']) && !empty($data['password'])) {
        $set_clauses[] = "password_hash = :hash";
        $execute_params['hash'] = password_hash($data['password'], PASSWORD_BCRYPT);
    }
    
    if (empty($set_clauses)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Tidak ada field yang valid untuk diupdate.']);
        return;
    }

    try {
        $sql = "UPDATE users SET " . implode(', ', $set_clauses) . " WHERE user_id = :id AND is_active = TRUE";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($execute_params);

        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'User berhasil diupdate.']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User tidak ditemukan atau tidak ada perubahan data.']);
        }
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') {
             http_response_code(409);
             echo json_encode(['success' => false, 'message' => 'Username sudah digunakan oleh user lain.']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Gagal mengupdate user: ' . $e->getMessage()]);
        }
    }
}

function handleDeleteRequest($pdo) {
    $user_id = isset($_GET['id']) ? (int)$_GET['id'] : null;

    if (!$user_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID pengguna harus disertakan.']);
        return;
    }

    try {
        $sql = "UPDATE users SET is_active = FALSE WHERE user_id = :id AND is_active = TRUE";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $user_id]);

        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'User berhasil dinonaktifkan.']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User tidak ditemukan atau sudah tidak aktif.']);
        }
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal menonaktifkan user: ' . $e->getMessage()]);
    }
}
?>