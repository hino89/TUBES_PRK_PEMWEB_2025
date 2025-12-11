<?php
require_once 'config.php';
require_once 'db.php';

header('Content-Type: application/json');

$pdo = connectDB();

function get($key, $default = null) {
    return $_GET[$key] ?? $default;
}

$start = get('start_date');
$end   = get('end_date');
$operator = get('operator_id', 'all');
$limit = intval(get('limit', 15));

if (!$start || !$end) {
    $start = date('Y-m-d', strtotime('-7 days'));
    $end   = date('Y-m-d');
}

/* ============================================
   1. LOAD OPERATORS
   ============================================ */
$operators = $pdo->query("
    SELECT user_id AS id, username AS label 
    FROM users
")->fetchAll(PDO::FETCH_ASSOC);

/* ============================================
   2. METRICS (WITH OPERATOR FILTER)
   ============================================ */
$metricsSql = "
    SELECT 
        COALESCE(SUM(t.total), 0) AS total_revenue,
        COUNT(*) AS total_transactions
    FROM transactions t
    WHERE DATE(t.datetime) BETWEEN ? AND ?
";

$params = [$start, $end];

if ($operator !== 'all') {
    $metricsSql .= " AND t.user_id = ? ";
    $params[] = $operator;
}

$metricsStmt = $pdo->prepare($metricsSql);
$metricsStmt->execute($params);
$metrics = $metricsStmt->fetch(PDO::FETCH_ASSOC);

/* ============================================
   2B. BEST SELLER FILTERED BY OPERATOR
   ============================================ */
$bestSql = "
    SELECT 
        m.name AS item_name,
        SUM(ti.qty) AS total_qty
    FROM transaction_items ti
    JOIN menu m ON m.menu_id = ti.menu_id
    JOIN transactions t ON t.trx_id = ti.trx_id
    WHERE DATE(t.datetime) BETWEEN ? AND ?
";

$bestParams = [$start, $end];

if ($operator !== 'all') {
    $bestSql .= " AND t.user_id = ? ";
    $bestParams[] = $operator;
}

$bestSql .= "
    GROUP BY ti.menu_id
    ORDER BY total_qty DESC
    LIMIT 1
";

$best = $pdo->prepare($bestSql);
$best->execute($bestParams);
$bestRow = $best->fetch(PDO::FETCH_ASSOC);

$metrics['best_seller_name']  = $bestRow['item_name'] ?? "-";
$metrics['best_seller_units'] = $bestRow['total_qty'] ?? 0;

/* ============================================
   3. DAILY SALES CHART (WITH OPERATOR FILTER)
   ============================================ */
$chartSql = "
    SELECT DATE(t.datetime) AS date, SUM(t.total) AS value
    FROM transactions t
    WHERE DATE(t.datetime) BETWEEN ? AND ?
";

$chartParams = [$start, $end];

if ($operator !== 'all') {
    $chartSql .= " AND t.user_id = ? ";
    $chartParams[] = $operator;
}

$chartSql .= " GROUP BY DATE(t.datetime) ORDER BY date ASC ";

$chart = $pdo->prepare($chartSql);
$chart->execute($chartParams);
$chartRows = $chart->fetchAll(PDO::FETCH_ASSOC);

$daily_sales = [];
foreach ($chartRows as $r) {
    $daily_sales[$r['date']] = intval($r['value']);
}

/* ============================================
   4. TRANSACTION HISTORY (ALREADY CORRECT)
   ============================================ */
$sql = "
    SELECT 
        t.trx_id,
        t.datetime,
        t.total,
        'PAID' AS status,
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

$historyParams = [$start, $end];

if ($operator !== 'all') {
    $sql .= " AND t.user_id = ? ";
    $historyParams[] = $operator;
}

$sql .= " ORDER BY t.datetime DESC LIMIT ? ";
$historyParams[] = $limit;

$stmt = $pdo->prepare($sql);
$stmt->execute($historyParams);
$history = $stmt->fetchAll(PDO::FETCH_ASSOC);

/* ============================================
   FINAL OUTPUT
   ============================================ */
echo json_encode([
    "success" => true,
    "filters" => [
        "start_date" => $start,
        "end_date"   => $end,
        "operators"  => $operators
    ],
    "metrics" => $metrics,
    "daily_sales" => $daily_sales,
    "transaction_history" => $history
]);
?>
