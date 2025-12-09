<?php
require_once 'config.php';
require_once 'db.php';

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
        $today = date('Y-m-d');
        $start_of_week = date('Y-m-d', strtotime('monday this week'));
        $end_of_week = date('Y-m-d', strtotime('sunday this week'));
        
        $metrics = getTopMetrics($pdo, $today);
        $weekly_sales = getWeeklySalesData($pdo, $start_of_week, $end_of_week);
        $transaction_history = getTransactionHistory($pdo, 10); // Ambil 10 transaksi terbaru

        $response = [
            'success' => true,
            'metrics' => $metrics,
            'weekly_sales' => $weekly_sales,
            'transaction_history' => $transaction_history
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
function getTopMetrics($pdo, $date) {
    // 1. Total Revenue dan Total Trx
    $sql_metrics = "SELECT 
        SUM(total) AS total_revenue, 
        COUNT(trx_id) AS total_transactions 
        FROM transactions 
        WHERE DATE(datetime) = :date";
    $stmt_metrics = $pdo->prepare($sql_metrics);
    $stmt_metrics->execute(['date' => $date]);
    $metrics = $stmt_metrics->fetch();
    
    // 2. Best Seller
    $sql_best_seller = "SELECT 
        m.name, 
        SUM(ti.qty) AS total_qty_sold 
        FROM transaction_items ti
        JOIN menu m ON ti.menu_id = m.menu_id
        JOIN transactions t ON ti.trx_id = t.trx_id
        WHERE DATE(t.datetime) = :date
        GROUP BY ti.menu_id, m.name
        ORDER BY total_qty_sold DESC
        LIMIT 1";
    $stmt_best_seller = $pdo->prepare($sql_best_seller);
    $stmt_best_seller->execute(['date' => $date]);
    $best_seller = $stmt_best_seller->fetch();

    return [
        'total_revenue' => (float)$metrics['total_revenue'],
        'total_transactions' => (int)$metrics['total_transactions'],
        'best_seller_name' => $best_seller ? $best_seller['name'] : 'N/A',
        'best_seller_units' => $best_seller ? (int)$best_seller['total_qty_sold'] : 0,
        // Profit Margin membutuhkan perhitungan COGS dari ingredients/recipes, 
        // yang terlalu kompleks untuk API dasar ini. Kita kembalikan nilai default.
        'profit_margin' => 0.38 
    ];
}

/**
 * Mengambil data penjualan harian dalam rentang waktu (misalnya per minggu).
 */
function getWeeklySalesData($pdo, $start_date, $end_date) {
    $sql = "SELECT 
        DATE(datetime) AS sale_date, 
        SUM(total) AS daily_revenue 
        FROM transactions 
        WHERE datetime >= :start_date AND datetime <= DATE_ADD(:end_date, INTERVAL 1 DAY)
        GROUP BY sale_date
        ORDER BY sale_date ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['start_date' => $start_date, 'end_date' => $end_date]);
    
    $results = $stmt->fetchAll();
    $formatted_data = [];

    // Map hasil ke format yang mudah digunakan oleh JS (date => revenue)
    foreach ($results as $row) {
        $formatted_data[$row['sale_date']] = (float)$row['daily_revenue'];
    }
    return $formatted_data;
}

/**
 * Mengambil daftar transaksi terbaru.
 */
function getTransactionHistory($pdo, $limit = 10) {
    $sql = "SELECT 
        t.trx_id, 
        t.datetime, 
        t.total, 
        u.username AS operator_username,
        GROUP_CONCAT(CONCAT(ti.qty, 'x ', m.name) SEPARATOR ', ') AS item_summary
        FROM transactions t
        JOIN users u ON t.user_id = u.user_id
        JOIN transaction_items ti ON t.trx_id = ti.trx_id
        JOIN menu m ON ti.menu_id = m.menu_id
        GROUP BY t.trx_id, t.datetime, t.total, u.username
        ORDER BY t.datetime DESC
        LIMIT :limit";
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    return $stmt->fetchAll();
}
?>