<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

require_once '../config.php';
require_once '../db.php';

$pdo = connectDB();

try {
    $stmt = $pdo->query("SELECT * FROM menu_modifiers WHERE is_active = 1 ORDER BY price ASC");
    $modifiers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data' => $modifiers
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>