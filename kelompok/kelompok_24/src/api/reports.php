<?php
require_once '../config.php';
require_once '../db.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}


$pdo = connectDB(); 
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    handleReportRequest($pdo);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method ' . $method . ' not allowed.']);
}

/**
 * Mengambil semua data laporan yang dibutuhkan (Metrics, Weekly Sales, History).
 */
function handleReportRequest($pdo) {
    try {
        $rangePreset = isset($_GET['range']) ? strtolower($_GET['range']) : '7d';
        $startInput = $_GET['start_date'] ?? null;
        $endInput = $_GET['end_date'] ?? null;
        [$startDate, $endDate] = resolveRange($rangePreset, $startInput, $endInput);

        $operatorId = isset($_GET['operator_id']) && $_GET['operator_id'] !== ''
            ? (int) $_GET['operator_id']
            : null;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 15;
        if ($limit < 5) $limit = 5;
        if ($limit > 50) $limit = 50;

        $metrics = getTopMetrics($pdo, $startDate, $endDate, $operatorId);
        $dailySales = getDailySalesData($pdo, $startDate, $endDate, $operatorId);
        $transactionHistory = getTransactionHistory($pdo, $startDate, $endDate, $operatorId, $limit);
        $operators = getOperatorOptions($pdo);

        $response = [
            'success' => true,
            'filters' => [
                'range' => [
                    'preset' => $rangePreset,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                ],
                'operator_id' => $operatorId,
                'operators' => $operators,
            ],
            'metrics' => $metrics,
            'daily_sales' => $dailySales,
            'weekly_sales' => $dailySales,
            'transaction_history' => $transactionHistory
        ];

        http_response_code(200);
        echo json_encode($response);

    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal menghasilkan laporan: ' . $e->getMessage()]);
    }
}

/**
 * Menghitung metrik utama (Revenue, Total Trx, Best Seller).
 */
function getTopMetrics($pdo, $startDate, $endDate, $operatorId = null) {
    $params = [
        ':start' => $startDate . ' 00:00:00',
        ':end' => $endDate . ' 23:59:59'
    ];

    $sqlMetrics = "SELECT 
        COALESCE(SUM(total), 0) AS total_revenue,
        COUNT(trx_id) AS total_transactions
        FROM transactions
        WHERE datetime BETWEEN :start AND :end";

    if ($operatorId) {
        $sqlMetrics .= ' AND user_id = :operator_id';
        $params[':operator_id'] = $operatorId;
    }

    $stmtMetrics = $pdo->prepare($sqlMetrics);
    $stmtMetrics->execute($params);
    $metrics = $stmtMetrics->fetch();

    $sqlBest = "SELECT 
        m.name,
        SUM(ti.qty) AS total_qty_sold
        FROM transaction_items ti
        JOIN menu m ON ti.menu_id = m.menu_id
        JOIN transactions t ON ti.trx_id = t.trx_id
        WHERE t.datetime BETWEEN :start AND :end";

    if ($operatorId) {
        $sqlBest .= ' AND t.user_id = :operator_id';
    }

    $sqlBest .= ' GROUP BY ti.menu_id, m.name ORDER BY total_qty_sold DESC LIMIT 1';

    $stmtBest = $pdo->prepare($sqlBest);
    $stmtBest->execute($params);
    $best = $stmtBest->fetch();

    return [
        'total_revenue' => isset($metrics['total_revenue']) ? (float) $metrics['total_revenue'] : 0,
        'total_transactions' => isset($metrics['total_transactions']) ? (int) $metrics['total_transactions'] : 0,
        'best_seller_name' => $best ? $best['name'] : 'N/A',
        'best_seller_units' => $best ? (int) $best['total_qty_sold'] : 0,
        'profit_margin' => 0.38
    ];
}

/**
 * Mengambil data penjualan harian dalam rentang waktu (misalnya per minggu).
 */
function getDailySalesData($pdo, $startDate, $endDate, $operatorId = null) {
    $params = [
        ':start' => $startDate . ' 00:00:00',
        ':end' => $endDate . ' 23:59:59'
    ];

    $sql = "SELECT 
        DATE(datetime) AS sale_date,
        SUM(total) AS daily_revenue
        FROM transactions
        WHERE datetime BETWEEN :start AND :end";

    if ($operatorId) {
        $sql .= ' AND user_id = :operator_id';
        $params[':operator_id'] = $operatorId;
    }

    $sql .= ' GROUP BY sale_date ORDER BY sale_date ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll();

    $formatted = [];
    foreach ($results as $row) {
        $formatted[$row['sale_date']] = (float) $row['daily_revenue'];
    }

    return $formatted;
}

/**
 * Mengambil daftar transaksi terbaru.
 */
function getTransactionHistory($pdo, $startDate, $endDate, $operatorId = null, $limit = 10) {
    $params = [
        ':start' => $startDate . ' 00:00:00',
        ':end' => $endDate . ' 23:59:59'
    ];

    $sql = "SELECT 
        t.trx_id,
        t.datetime,
        t.total,
        t.payment,
        t.change_amount,
        t.note,
        u.username AS operator_username,
        GROUP_CONCAT(CONCAT(ti.qty, 'x ', m.name) SEPARATOR ', ') AS item_summary
        FROM transactions t
        JOIN users u ON t.user_id = u.user_id
        JOIN transaction_items ti ON t.trx_id = ti.trx_id
        JOIN menu m ON ti.menu_id = m.menu_id
        WHERE t.datetime BETWEEN :start AND :end";

    if ($operatorId) {
        $sql .= ' AND t.user_id = :operator_id';
    }

    $sql .= ' GROUP BY t.trx_id, t.datetime, t.total, t.payment, t.change_amount, t.note, u.username'
        . ' ORDER BY t.datetime DESC LIMIT :limit';

    $stmt = $pdo->prepare($sql);
    if ($operatorId) {
        $params[':operator_id'] = $operatorId;
    }
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['total'] = (float) $row['total'];
        $row['payment'] = isset($row['payment']) ? (float) $row['payment'] : 0;
        $row['change_amount'] = isset($row['change_amount']) ? (float) $row['change_amount'] : 0;
        $row['status'] = determineStatus($row);
    }

    return $rows;
}

function determineStatus(array $transaction): string
{
    $note = strtolower($transaction['note'] ?? '');
    if (strpos($note, 'void') !== false) {
        return 'VOID';
    }

    if ($transaction['payment'] >= $transaction['total']) {
        return 'PAID';
    }

    return 'UNPAID';
}

function getOperatorOptions($pdo): array
{
    $sql = "SELECT user_id, username, full_name FROM users WHERE is_active = 1 ORDER BY username";
    $rows = $pdo->query($sql)->fetchAll();

    return array_map(function ($row) {
        return [
            'id' => (int) $row['user_id'],
            'label' => $row['full_name'] ?: $row['username'],
            'username' => $row['username']
        ];
    }, $rows);
}

function resolveRange(string $preset, ?string $startInput, ?string $endInput): array
{
    $today = new DateTimeImmutable('today');

    if ($preset === 'custom') {
        $start = sanitizeDate($startInput) ?? $today->format('Y-m-d');
        $end = sanitizeDate($endInput) ?? $start;
        if ($end < $start) {
            $tmp = $start;
            $start = $end;
            $end = $tmp;
        }
        return [$start, $end];
    }

    switch ($preset) {
        case 'today':
            $start = $today;
            break;
        case '30d':
            $start = $today->sub(new DateInterval('P29D'));
            break;
        case '7d':
        default:
            $start = $today->sub(new DateInterval('P6D'));
            $preset = '7d';
            break;
    }

    return [$start->format('Y-m-d'), $today->format('Y-m-d')];
}

function sanitizeDate(?string $value): ?string
{
    if (!$value) {
        return null;
    }

    $date = DateTime::createFromFormat('Y-m-d', $value);
    return $date ? $date->format('Y-m-d') : null;
}
?>