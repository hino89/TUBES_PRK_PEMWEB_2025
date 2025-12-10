<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once __DIR__ . '/db.php';
$pdo = connectDB();

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

function jsonOut($success, $message, $data = null) {
    echo json_encode(["success" => $success, "message" => $message, "data" => $data]);
    exit();
}

$method = $_SERVER["REQUEST_METHOD"];

// ===================================================================
// GET — LIST TRANSACTIONS OR DETAIL
// ===================================================================
if ($method == "GET") {

    if (isset($_GET["trx_id"])) {
        $trx_id = intval($_GET["trx_id"]);

        $stmt = $pdo->prepare("SELECT * FROM transactions WHERE trx_id = ?");
        $stmt->execute([$trx_id]);
        $trx = $stmt->fetch();

        if (!$trx) jsonOut(false, "Transaction not found");

        $stmt = $pdo->prepare("
            SELECT ti.*, m.name 
            FROM transaction_items ti
            JOIN menu m ON ti.menu_id = m.menu_id
            WHERE trx_id = ?
        ");
        $stmt->execute([$trx_id]);
        $items = $stmt->fetchAll();

        $trx["items"] = $items;
        jsonOut(true, "Transaction detail", $trx);
    }

    // Otherwise list all
    $rows = $pdo->query("SELECT * FROM transactions ORDER BY trx_id DESC")->fetchAll();
    jsonOut(true, "List of transactions", $rows);
}


// ===================================================================
// POST — CHECKOUT / CREATE TRANSACTION
// ===================================================================
if ($method == "POST") {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!$data || !isset($data["items"]) || !isset($data["user_id"])) {
        jsonOut(false, "Missing fields: items, user_id");
    }

    $items = $data["items"];
    $user_id = $data["user_id"];
    $table_no = $data["table_no"] ?? null;
    $discount = $data["discount"] ?? 0;
    $tax = $data["tax"] ?? 0;

    // ===============================
    // HITUNG SUBTOTAL
    // ===============================
    $subtotal = 0;

    foreach ($items as $it) {
        $stmt = $pdo->prepare("SELECT price FROM menu WHERE menu_id = ?");
        $stmt->execute([$it["menu_id"]]);
        $price = $stmt->fetchColumn();

        if ($price === false) jsonOut(false, "Menu ID {$it['menu_id']} not found.");

        $subtotal += $price * $it["qty"];
    }

    $total = $subtotal - $discount + $tax;

    // Begin Transaction
    $pdo->beginTransaction();

    try {
        // Insert Header
        $stmt = $pdo->prepare("
            INSERT INTO transactions (user_id, table_no, subtotal, discount_amount, tax_amount, total)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$user_id, $table_no, $subtotal, $discount, $tax, $total]);

        $trx_id = $pdo->lastInsertId();

        // Insert Items + reduce stock
        foreach ($items as $it) {

            // get price
            $stmt = $pdo->prepare("SELECT price FROM menu WHERE menu_id = ?");
            $stmt->execute([$it["menu_id"]]);
            $price = $stmt->fetchColumn();
            $line = $price * $it["qty"];

            // INSERT INTO transaction_items
            $stmt = $pdo->prepare("
                INSERT INTO transaction_items (trx_id, menu_id, qty, price_at_time, line_total)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$trx_id, $it["menu_id"], $it["qty"], $price, $line]);

            // Ambil resep bahan
            $stmt = $pdo->prepare("
                SELECT ingredient_id, qty_used
                FROM menu_recipes
                WHERE menu_id = ?
            ");
            $stmt->execute([$it["menu_id"]]);
            $recipes = $stmt->fetchAll();

            // Kurangi stok + buat log
            foreach ($recipes as $r) {
                $used = $r["qty_used"] * $it["qty"];

                // Kurangi stok
                $pdo->prepare("
                    UPDATE ingredients 
                    SET stock_qty = stock_qty - ?
                    WHERE ingredient_id = ?
                ")->execute([$used, $r["ingredient_id"]]);

                // Add log
                $pdo->prepare("
                    INSERT INTO inventory_logs (ingredient_id, change_qty, reason, related_trx_id)
                    VALUES (?, ?, 'used', ?)
                ")->execute([$r["ingredient_id"], -$used, $trx_id]);
            }
        }

        $pdo->commit();

    } catch (Exception $e) {
        $pdo->rollBack();
        jsonOut(false, "Failed to process order: " . $e->getMessage());
    }

    // Return struct
    $stmt = $pdo->prepare("SELECT * FROM transactions WHERE trx_id = ?");
    $stmt->execute([$trx_id]);
    $trx = $stmt->fetch();

    $stmt = $pdo->prepare("
        SELECT ti.*, m.name
        FROM transaction_items ti
        JOIN menu m ON ti.menu_id = m.menu_id
        WHERE trx_id = ?
    ");
    $stmt->execute([$trx_id]);
    $items = $stmt->fetchAll();

    $trx["items"] = $items;

    jsonOut(true, "Transaction created", $trx);
}

jsonOut(false, "Invalid method");
