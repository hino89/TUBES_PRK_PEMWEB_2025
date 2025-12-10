<?php
ob_start();

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

try {
    $today = date('Y-m-d');
    $yesterday = date('Y-m-d', strtotime('-1 day'));

    $sql_today = "SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM transactions WHERE DATE(datetime) = :today";
    $stmt = $pdo->prepare($sql_today);
    $stmt->execute(['today' => $today]);
    $data_today = $stmt->fetch();

    $stmt->execute(['today' => $yesterday]);
    $data_yesterday = $stmt->fetch();

    $sales_growth = 0;
    $total_today = (float)$data_today['total'];
    $total_yesterday = (float)$data_yesterday['total'];

    if ($total_yesterday > 0) {
        $sales_growth = (($total_today - $total_yesterday) / $total_yesterday) * 100;
    } else {
        $sales_growth = $total_today > 0 ? 100 : 0;
    }

    $sql_chart = "SELECT DATE(datetime) as date, COALESCE(SUM(total), 0) as daily_total 
                  FROM transactions 
                  WHERE datetime >= DATE(NOW()) - INTERVAL 6 DAY 
                  GROUP BY DATE(datetime) 
                  ORDER BY date ASC";
    $stmt_chart = $pdo->query($sql_chart);
    $chart_data = $stmt_chart->fetchAll();

    $sql_popular = "SELECT m.name, SUM(ti.qty) as sold_qty 
                    FROM transaction_items ti
                    JOIN transactions t ON ti.trx_id = t.trx_id
                    JOIN menu m ON ti.menu_id = m.menu_id
                    WHERE DATE(t.datetime) = :today
                    GROUP BY ti.menu_id, m.name 
                    ORDER BY sold_qty DESC 
                    LIMIT 5";
    $stmt_popular = $pdo->prepare($sql_popular);
    $stmt_popular->execute(['today' => $today]);
    $popular_items = $stmt_popular->fetchAll();

    ob_clean();

    echo json_encode([
        'success' => true,
        'data' => [
            'sales_today' => $total_today,
            'orders_today' => (int)$data_today['count'],
            'growth_percent' => round($sales_growth, 1),
            'weekly_chart' => $chart_data,
            'popular_items' => $popular_items
        ]
    ]);

} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Internal Server Error: ' . $e->getMessage()
    ]);
}
?>