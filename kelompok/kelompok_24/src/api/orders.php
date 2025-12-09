<?php
// src/api/orders.php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once 'config.php';
require_once "db.php";

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

function sendJSON($success, $message, $data = null) {
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit();
}

$method = $_SERVER["REQUEST_METHOD"];

// ===========================================================================
// 1. GET — LIST TRANSACTIONS
// ===========================================================================
if ($method === "GET") {
    if (isset($_GET["trx_id"])) {
        $trx_id = intval($_GET["trx_id"]);

        // Ambil header transaksi
        $q = $conn->prepare("SELECT * FROM transactions WHERE trx_id = ?");
        $q->bind_param("i", $trx_id);
        $q->execute();
        $trx = $q->get_result()->fetch_assoc();

        if (!$trx) sendJSON(false, "Transaction not found");

        // Ambil detail item
        $details = [];
        $q = $conn->prepare("
            SELECT ti.*, m.name 
            FROM transaction_items ti
            JOIN menu m ON ti.menu_id = m.menu_id
            WHERE ti.trx_id = ?
        ");
        $q->bind_param("i", $trx_id);
        $q->execute();
        $res = $q->get_result();
        while ($r = $res->fetch_assoc()) $details[] = $r;

        $trx["items"] = $details;

        sendJSON(true, "Transaction detail", $trx);
    }

    // Jika tidak ada trx_id → tampilkan semua transaksi
    $result = $conn->query("SELECT * FROM transactions ORDER BY trx_id DESC");

    $data = [];
    while ($row = $result->fetch_assoc()) $data[] = $row;

    sendJSON(true, "List transactions", $data);
}


// ===========================================================================
// 2. POST — CHECKOUT / CREATE ORDER
// ===========================================================================
if ($method === "POST") {

    $input = json_decode(file_get_contents("php://input"), true);

    if (!$input || !isset($input["items"]) || !isset($input["user_id"])) {
        sendJSON(false, "Missing required fields: items, user_id");
    }

    $items = $input["items"];  // array menu_id, qty
    $user_id = $input["user_id"];
    $table_no = $input["table_no"] ?? null;
    $discount = $input["discount"] ?? 0;
    $tax = $input["tax"] ?? 0;

    // Hitung subtotal
    $subtotal = 0;

    foreach ($items as $it) {
        $q = $conn->prepare("SELECT price FROM menu WHERE menu_id = ?");
        $q->bind_param("i", $it["menu_id"]);
        $q->execute();
        $row = $q->get_result()->fetch_assoc();

        if (!$row) {
            sendJSON(false, "Menu ID {$it['menu_id']} not found");
        }

        $line = $row["price"] * $it["qty"];
        $subtotal += $line;
    }

    // Hitung total
    $total = $subtotal - $discount + $tax;

    // ============================================================
    // Insert ke tabel TRANSACTIONS
    // ============================================================
    $q = $conn->prepare("
        INSERT INTO transactions 
        (user_id, table_no, subtotal, discount_amount, tax_amount, total)
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    $q->bind_param("isdddd",
        $user_id, $table_no, $subtotal, $discount, $tax, $total
    );

    if (!$q->execute()) {
        sendJSON(false, "Failed to create transaction");
    }

    $trx_id = $conn->insert_id;

    // ============================================================
    // Insert DETAIL ITEMS (transaction_items)
    // ============================================================
    foreach ($items as $it) {

        // ambil harga saat ini
        $q = $conn->prepare("SELECT price FROM menu WHERE menu_id = ?");
        $q->bind_param("i", $it["menu_id"]);
        $q->execute();
        $row = $q->get_result()->fetch_assoc();
        $price = $row["price"];
        $line_total = $price * $it["qty"];

        $q2 = $conn->prepare("
            INSERT INTO transaction_items 
            (trx_id, menu_id, qty, price_at_time, line_total)
            VALUES (?, ?, ?, ?, ?)
        ");
        $q2->bind_param("iiidd", 
            $trx_id, 
            $it["menu_id"], 
            $it["qty"], 
            $price, 
            $line_total
        );
        $q2->execute();

        // =============================================
        // KURANGI STOK BAHAN & BUAT INVENTORY LOGS
        // =============================================
        $recipe = $conn->prepare("
            SELECT ingredient_id, qty_used 
            FROM menu_recipes 
            WHERE menu_id = ?
        ");
        $recipe->bind_param("i", $it["menu_id"]);
        $recipe->execute();
        $recipes = $recipe->get_result();

        while ($r = $recipes->fetch_assoc()) {
            $use_qty = $r["qty_used"] * $it["qty"];  // total bahan terpakai

            // Kurangi stok
            $conn->query("
                UPDATE ingredients 
                SET stock_qty = stock_qty - $use_qty 
                WHERE ingredient_id = {$r['ingredient_id']}
            ");

            // Tambah inventory log
            $log = $conn->prepare("
                INSERT INTO inventory_logs 
                (ingredient_id, change_qty, reason, related_trx_id)
                VALUES (?, ?, 'used', ?)
            ");
            $neg = -$use_qty;
            $log->bind_param("idi",
                $r["ingredient_id"], 
                $neg, 
                $trx_id
            );
            $log->execute();
        }
    }

    // ============================================================
    // Ambil struk lengkap untuk frontend
    // ============================================================
    $q = $conn->prepare("SELECT * FROM transactions WHERE trx_id = ?");
    $q->bind_param("i", $trx_id);
    $q->execute();
    $trx = $q->get_result()->fetch_assoc();

    $detail = [];
    $q = $conn->prepare("
        SELECT ti.*, m.name 
        FROM transaction_items ti
        JOIN menu m ON ti.menu_id = m.menu_id
        WHERE ti.trx_id = ?
    ");
    $q->bind_param("i", $trx_id);
    $q->execute();
    $res = $q->get_result();
    while ($row = $res->fetch_assoc()) $detail[] = $row;

    $trx["items"] = $detail;

    sendJSON(true, "Transaction created", $trx);
}

sendJSON(false, "Invalid method");
