<?php
// src/api/items.php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once 'config.php';
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$pdo = connectDB();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGet($pdo);
            break;
        case 'POST':
            handlePost($pdo);
            break;
        case 'PUT':
            handlePut($pdo);
            break;
        case 'DELETE':
            handleDelete($pdo);
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

function handleGet($pdo) {
    if (isset($_GET['id'])) {
        $stmt = $pdo->prepare("
            SELECT m.*, c.name AS category_name, 
                   COUNT(mr.menu_id) AS recipe_count
            FROM menu m 
            LEFT JOIN categories c ON m.category_id = c.category_id
            LEFT JOIN menu_recipes mr ON m.menu_id = mr.menu_id
            WHERE m.menu_id = ?
            GROUP BY m.menu_id
        ");
        $stmt->execute([$_GET['id']]);
        $data = $stmt->fetch();
        
        if ($data) {
            echo json_encode(['success' => true, 'data' => $data]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Menu not found']);
        }
    } else {
        // Query untuk mengambil semua menu (Dibutuhkan oleh POS)
        $stmt = $pdo->query("
            SELECT m.*, c.name AS category_name,
                   COUNT(mr.menu_id) AS recipe_count 
            FROM menu m 
            LEFT JOIN categories c ON m.category_id = c.category_id
            LEFT JOIN menu_recipes mr ON m.menu_id = mr.menu_id
            GROUP BY m.menu_id
            ORDER BY m.menu_id DESC
        ");
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    }
}

function handlePost($pdo) {
    $data = json_decode(file_get_contents("php://input"), true);
    
    if (empty($data['name']) || empty($data['price'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Name and Price required']);
        return;
    }

    $sql = "INSERT INTO menu (name, description, price, category_id, is_available) VALUES (?, ?, ?, ?, ?)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $data['name'],
        $data['description'] ?? '',
        $data['price'],
        $data['category_id'] ?? null,
        $data['is_available'] ?? 1
    ]);

    echo json_encode(['success' => true, 'message' => 'Menu added', 'id' => $pdo->lastInsertId()]);
}

function handlePut($pdo) {
    $data = json_decode(file_get_contents("php://input"), true);
    
    if (empty($data['menu_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Menu ID required']);
        return;
    }

    $sql = "UPDATE menu SET name=?, description=?, price=?, category_id=?, is_available=? WHERE menu_id=?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $data['name'],
        $data['description'] ?? '',
        $data['price'],
        $data['category_id'] ?? null,
        $data['is_available'] ?? 1,
        $data['menu_id']
    ]);

    echo json_encode(['success' => true, 'message' => 'Menu updated']);
}

function handleDelete($pdo) {
    $id = $_GET['id'] ?? null;
    if (!$id) {
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['menu_id'] ?? null;
    }

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Menu ID required']);
        return;
    }

    $stmt = $pdo->prepare("DELETE FROM menu WHERE menu_id = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true, 'message' => 'Menu deleted']);
}
?>