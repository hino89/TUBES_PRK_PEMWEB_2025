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
        $category_id = isset($_GET['id']) ? (int)$_GET['id'] : null;

        if ($category_id) {
            $sql = "SELECT * FROM categories WHERE category_id = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute(['id' => $category_id]);
            $category = $stmt->fetch();

            if ($category) {
                http_response_code(200);
                echo json_encode(['success' => true, 'data' => $category]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Kategori tidak ditemukan.']);
            }
        } else {
            $sql = "SELECT * FROM categories ORDER BY name ASC";
            $stmt = $pdo->query($sql);
            $categories = $stmt->fetchAll();

            http_response_code(200);
            echo json_encode(['success' => true, 'data' => $categories]);
        }
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal mengambil data kategori: ' . $e->getMessage()]);
    }
}

function handlePostRequest($pdo) {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!isset($data['name'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nama kategori harus diisi.']);
        return;
    }
    
    $name = $data['name'];
    $description = $data['description'] ?? null;

    try {
        $sql = "INSERT INTO categories (name, description) VALUES (:name, :description)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['name' => $name, 'description' => $description]);

        http_response_code(201);
        echo json_encode(['success' => true, 'message' => 'Kategori berhasil ditambahkan.', 'id' => $pdo->lastInsertId()]);
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') {
             http_response_code(409);
             echo json_encode(['success' => false, 'message' => 'Nama kategori sudah ada.']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Gagal menambahkan kategori: ' . $e->getMessage()]);
        }
    }
}

function handlePutRequest($pdo) {
    $category_id = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $data = json_decode(file_get_contents("php://input"), true);

    if (!$category_id || !isset($data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID atau data tidak valid.']);
        return;
    }
    
    $set_clauses = [];
    $execute_params = ['id' => $category_id];

    if (isset($data['name'])) {
        $set_clauses[] = "name = :name";
        $execute_params['name'] = $data['name'];
    }
    if (isset($data['description'])) {
        $set_clauses[] = "description = :description";
        $execute_params['description'] = $data['description'];
    }
    
    if (empty($set_clauses)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Tidak ada field yang valid untuk diupdate.']);
        return;
    }

    try {
        $sql = "UPDATE categories SET " . implode(', ', $set_clauses) . " WHERE category_id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($execute_params);

        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Kategori berhasil diupdate.']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Kategori tidak ditemukan atau tidak ada perubahan data.']);
        }
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') {
             http_response_code(409);
             echo json_encode(['success' => false, 'message' => 'Nama kategori sudah digunakan.']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Gagal mengupdate kategori: ' . $e->getMessage()]);
        }
    }
}

function handleDeleteRequest($pdo) {
    $category_id = isset($_GET['id']) ? (int)$_GET['id'] : null;

    if (!$category_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID harus disertakan.']);
        return;
    }

    try {
        // Hapus kategori
        $sql = "DELETE FROM categories WHERE category_id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $category_id]);

        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Kategori berhasil dihapus.']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Kategori tidak ditemukan.']);
        }
    } catch (\PDOException $e) {
        if ($e->getCode() === '23000') {
             http_response_code(409);
             echo json_encode(['success' => false, 'message' => 'Kategori tidak dapat dihapus karena masih digunakan oleh beberapa Menu.']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Gagal menghapus kategori: ' . $e->getMessage()]);
        }
    }
}
?>