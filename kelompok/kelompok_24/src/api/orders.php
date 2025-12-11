<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once 'config.php';
require_once "db.php";

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit();
}

$pdo = connectDB();

function jsonOut($success, $message, $data = null) {
    echo json_encode(["success" => $success, "message" => $message, "data" => $data]);
    exit();
}

$method = $_SERVER["REQUEST_METHOD"];

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
        $items = $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as &$item) {
            $stmt_mod = $pdo->prepare("
                SELECT tim.*, mm.name 
                FROM transaction_item_modifiers tim
                JOIN menu_modifiers mm ON tim.modifier_id = mm.modifier_id
                WHERE tim.trx_item_id = ?
            ");
            $stmt_mod->execute([$item['item_id']]);
            $item["modifiers"] = $stmt_mod->fetchAll(PDO::FETCH_ASSOC);
        }

        $trx["items"] = $items;
        jsonOut(true, "Transaction detail", $trx);
    }

    $rows = $pdo->query("SELECT * FROM transactions ORDER BY trx_id DESC")->fetchAll();
    jsonOut(true, "List of transactions", $rows);
}


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

    $subtotal = 0;
    foreach ($items as $it) {
        $subtotal += $it["price"] * $it["qty"];
    }

    $total = $subtotal - $discount + $tax;

    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare("
            INSERT INTO transactions (user_id, table_no, subtotal, discount_amount, tax_amount, total)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$user_id, $table_no, $subtotal, $discount, $tax, $total]);

        $trx_id = $pdo->lastInsertId();

        foreach ($items as $it) {
            $line_total = $it["price"] * $it["qty"];
            $unit_price_final = $it['price']; 
            $base_price = $it['base_price'];

            $stmt = $pdo->prepare("
                INSERT INTO transaction_items (trx_id, menu_id, qty, price_at_time, line_total)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$trx_id, $it["menu_id"], $it["qty"], $unit_price_final, $line_total]);
            $trx_item_id = $pdo->lastInsertId();

            if (!empty($it["modifiers"])) {
                $stmt_mod = $pdo->prepare("
                    INSERT INTO transaction_item_modifiers (trx_item_id, modifier_id, price)
                    VALUES (?, ?, ?)
                ");
                foreach ($it["modifiers"] as $mod) {
                    $stmt_mod->execute([$trx_item_id, $mod["modifier_id"], $mod["price"]]);
                }
            }

            $stmt = $pdo->prepare("
                SELECT ingredient_id, qty_used
                FROM menu_recipes
                WHERE menu_id = ?
            ");
            $stmt->execute([$it["menu_id"]]);
            $recipes = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($recipes as $r) {
                $used = $r["qty_used"] * $it["qty"];

                $pdo->prepare("
                    UPDATE ingredients 
                    SET stock_qty = stock_qty - ?
                    WHERE ingredient_id = ?
                ")->execute([$used, $r["ingredient_id"]]);

                $pdo->prepare("
                    INSERT INTO inventory_logs (ingredient_id, change_qty, reason, related_trx_id)
                    VALUES (?, ?, 'used', ?)
                ")->execute([$r["ingredient_id"], -$used, $trx_id]);
            }
            
            if (!empty($it["modifiers"])) {
                $stmt_mod_ing = $pdo->prepare("
                    SELECT ingredient_id 
                    FROM menu_modifiers
                    WHERE modifier_id = ? AND ingredient_id IS NOT NULL
                ");
                
                foreach ($it["modifiers"] as $mod) {
                    $stmt_mod_ing->execute([$mod["modifier_id"]]);
                    $mod_ing_id = $stmt_mod_ing->fetchColumn();
                    
                    if ($mod_ing_id) {
                        $mod_used = $it["qty"];

                        $pdo->prepare("
                            UPDATE ingredients 
                            SET stock_qty = stock_qty - ?
                            WHERE ingredient_id = ?
                        ")->execute([$mod_used, $mod_ing_id]);

                        $pdo->prepare("
                            INSERT INTO inventory_logs (ingredient_id, change_qty, reason, related_trx_id, note)
                            VALUES (?, ?, 'used_modifier', ?, 'Modifier: " . $mod["modifier_id"] . "')
                        ")->execute([$mod_ing_id, -$mod_used, $trx_id]);
                    }
                }
            }
        }

        $pdo->commit();

    } catch (Exception $e) {
        $pdo->rollBack();
        jsonOut(false, "Failed to process order (DB Error): " . $e->getMessage());
    }

    $stmt = $pdo->prepare("SELECT * FROM transactions WHERE trx_id = ?");
    $stmt->execute([$trx_id]);
    $trx = $stmt->fetch();

    jsonOut(true, "Transaction created", ["trx_id" => $trx_id, "total" => $trx['total']]);
}

if ($method == "PUT") {
    $data = json_decode(file_get_contents("php://input"), true);
    
    if (!isset($data["trx_id"]) || !isset($data["payment"])) {
        jsonOut(false, "Missing fields: trx_id, payment");
    }
    
    $trx_id = intval($data["trx_id"]);
    $payment = floatval($data["payment"]);
    $note = $data["note"] ?? null;
    
    $stmt = $pdo->prepare("SELECT total FROM transactions WHERE trx_id = ?");
    $stmt->execute([$trx_id]);
    $total = $stmt->fetchColumn();
    
    if ($total === false) jsonOut(false, "Transaction not found");
    
    $change = $payment - $total;
    
    $stmt = $pdo->prepare("
        UPDATE transactions 
        SET payment = ?, change_amount = ?, note = ?, is_completed = 1
        WHERE trx_id = ?
    ");
    $stmt->execute([$payment, $change, $note, $trx_id]);
    
    jsonOut(true, "Payment updated", [
        "trx_id" => $trx_id,
        "payment" => $payment,
        "change" => $change
    ]);
}

jsonOut(false, "Invalid method");