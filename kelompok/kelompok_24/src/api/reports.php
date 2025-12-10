<?php
require_once 'config.php';
require_once 'db.php';

header('Content-Type: application/json');

$pdo = connectDB();

function get($key, $default = null) {
    return isset($_GET[$key]) ? $_GET[$key] : $default;
}

$start = get('start_date');
$end   = get('end_date');
$operator = get('operator_id', 'all');
$limit = intval(get('limit', 15));

// Default date jika tidak ada param
if (!$start || !$end) {
    $start = date('Y-m-d', strtotime('-7 days'));
    $end = date('Y-m-d');
}

// =======================
// 1. LOAD OPERATORS
// =======================
// Mengambil daftar kasir untuk filter dropdown
$operators = $pdo->query("
    SELECT user_id as id, username AS label, username 
    FROM users
")->fetchAll();

// =======================
// 2. LOAD METRICS
// =======================
// Menggunakan tabel 'transactions' dan 'transaction_items'
$metricsSql = "
    SELECT 
        COALESCE(SUM(t.total), 0) AS total_revenue,
        COUNT(*) AS total_transactions,
        (
            SELECT m.name 
            FROM transaction_items ti
            JOIN menu m ON ti.menu_id = m.menu_id
            JOIN transactions t2 ON ti.trx_id = t2.trx_id
            WHERE DATE(t2.datetime) BETWEEN ? AND ?
            GROUP BY ti.menu_id
            ORDER BY SUM(ti.qty) DESC
            LIMIT 1
        ) AS best_seller_name,
        (
            SELECT COALESCE(SUM(ti.qty), 0)
            FROM transaction_items ti
            JOIN transactions t3 ON ti.trx_id = t3.trx_id
            WHERE DATE(t3.datetime) BETWEEN ? AND ?
            GROUP BY ti.menu_id
            ORDER BY SUM(ti.qty) DESC
            LIMIT 1
        ) AS best_seller_units,
        0.40 AS profit_margin -- Hardcoded estimasi 40%
    FROM transactions t
    WHERE DATE(t.datetime) BETWEEN ? AND ?
";

$metricsStmt = $pdo->prepare($metricsSql);
// Parameter harus diulang karena subquery butuh date range juga
$metricsStmt->execute([$start, $end, $start, $end, $start, $end]);
$metrics = $metricsStmt->fetch();

// =======================
// 3. DAILY SALES CHART
// =======================
$chart = $pdo->prepare("
    SELECT DATE(datetime) AS date, SUM(total) AS value
    FROM transactions
    WHERE DATE(datetime) BETWEEN ? AND ?
    GROUP BY DATE(datetime)
    ORDER BY DATE(datetime)
");
$chart->execute([$start, $end]);
$chartRows = $chart->fetchAll();

$daily_sales = [];
foreach ($chartRows as $r) {
    $daily_sales[$r['date']] = intval($r['value']);
}

// =======================
// 4. TRANSACTION HISTORY
// =======================
// Query kompleks dengan JOIN user dan GROUP_CONCAT item
$sql = "
    SELECT 
        t.trx_id,
        t.datetime,
        t.total,
        'PAID' as status, -- Default status karena kita belum handle void/unpaid
        u.username AS operator_username,
        (
            SELECT GROUP_CONCAT(CONCAT(ti.qty, 'x ', m.name) SEPARATOR ', ')
            FROM transaction_items ti
            JOIN menu m ON m.menu_id = ti.menu_id
            WHERE ti.trx_id = t.trx_id
        ) AS item_summary
    FROM transactions t
    LEFT JOIN users u ON u.user_id = t.user_id
    WHERE DATE(t.datetime) BETWEEN ? AND ?
";
$params = [$start, $end];

if ($operator !== 'all') {
    $sql .= " AND t.user_id = ? ";
    $params[] = $operator;
}

$sql .= " ORDER BY t.datetime DESC LIMIT ?";
$params[] = $limit;

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$history = $stmt->fetchAll();

// =======================
// FINAL OUTPUT
// =======================
echo json_encode([
    "success" => true,
    "filters" => [
        "start_date" => $start,
        "end_date" => $end,
        "operators" => $operators
    ],
    "metrics" => $metrics,
    "daily_sales" => $daily_sales,
    "transaction_history" => $history
]);
?>