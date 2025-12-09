<?php
// src/api/items.php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once "db.php";

// Untuk menangani preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Helper fungsi respon
function responseJSON($success, $message, $data = null) {
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data"    => $data
    ]);
    exit();
}

$method = $_SERVER["REQUEST_METHOD"];

// ===========================
// 1. GET (READ)
// ===========================
if ($method === "GET") {

    // GET /api/items.php?id=1 → ambil detail menu
    if (isset($_GET['id'])) {
        $id = intval($_GET['id']);
        $q = $conn->prepare("
            SELECT m.*, c.name AS category_name 
            FROM menu m 
            LEFT JOIN categories c ON m.category_id = c.category_id
            WHERE m.menu_id = ?
        ");
        $q->bind_param("i", $id);
        $q->execute();
        $res = $q->get_result()->fetch_assoc();

        if (!$res) responseJSON(false, "Menu not found");
        responseJSON(true, "Detail menu", $res);
    }

    // GET /api/items.php → ambil semua menu
    $sql = "
        SELECT m.*, c.name AS category_name 
        FROM menu m 
        LEFT JOIN categories c ON m.category_id = c.category_id
        ORDER BY m.menu_id DESC
    ";

    $result = $conn->query($sql);
    $data = [];

    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    responseJSON(true, "List menu", $data);
}


// ===========================
// 2. POST (CREATE)
// ===========================
if ($method === "POST") {
    $input = json_decode(file_get_contents("php://input"), true);

    if (!$input || !isset($input['name']) || !isset($input['price'])) {
        responseJSON(false, "Missing required fields (name, price)");
    }

    $name        = $input['name'];
    $desc        = $input['description'] ?? null;
    $price       = $input['price'];
    $category_id = $input['category_id'] ?? null;
    $is_available = $input['is_available'] ?? 1;

    $q = $conn->prepare("
        INSERT INTO menu (name, description, price, category_id, is_available) 
        VALUES (?, ?, ?, ?, ?)
    ");

    $q->bind_param("ssdii",
        $name,
        $desc,
        $price,
        $category_id,
        $is_available
    );

    if ($q->execute()) {
        responseJSON(true, "Menu added successfully", ["menu_id" => $conn->insert_id]);
    } else {
        responseJSON(false, "Failed to add menu");
    }
}


// ===========================
// 3. PUT (UPDATE)
// ===========================
if ($method === "PUT") {
    $input = json_decode(file_get_contents("php://input"), true);

    if (!$input || !isset($input['menu_id'])) {
        responseJSON(false, "menu_id is required");
    }

    $menu_id     = $input['menu_id'];
    $name        = $input['name'];
    $desc        = $input['description'] ?? null;
    $price       = $input['price'];
    $category_id = $input['category_id'] ?? null;
    $is_available = $input['is_available'] ?? 1;

    $q = $conn->prepare("
        UPDATE menu 
        SET name=?, description=?, price=?, category_id=?, is_available=? 
        WHERE menu_id=?
    ");

    $q->bind_param("ssdi ii",
        $name,
        $desc,
        $price,
        $category_id,
        $is_available,
        $menu_id
    );

    if ($q->execute()) {
        responseJSON(true, "Menu updated successfully");
    } else {
        responseJSON(false, "Failed to update menu");
    }
}


// ===========================
// 4. DELETE
// ===========================
if ($method === "DELETE") {
    parse_str(file_get_contents("php://input"), $input);

    if (!isset($input['menu_id'])) {
        responseJSON(false, "menu_id is required");
    }

    $menu_id = intval($input['menu_id']);

    $q = $conn->prepare("DELETE FROM menu WHERE menu_id = ?");
    $q->bind_param("i", $menu_id);

    if ($q->execute()) {
        responseJSON(true, "Menu deleted successfully");
    } else {
        responseJSON(false, "Failed to delete menu");
    }
}

responseJSON(false, "Invalid method");