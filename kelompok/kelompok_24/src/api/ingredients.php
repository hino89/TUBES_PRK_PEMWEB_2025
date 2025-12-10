<?php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

require_once 'config.php';
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
	http_response_code(204);
	exit;
}

$pdo = connectDB();

try {
	switch ($method) {
		case 'GET':
			handleGet($pdo);
			break;
		case 'POST':
			handlePost($pdo);
			break;
		case 'PUT':
		case 'PATCH':
			handlePut($pdo);
			break;
		case 'DELETE':
			handleDelete($pdo);
			break;
		default:
			respond(405, [
				'success' => false,
				'message' => 'Metode tidak diperbolehkan untuk endpoint ini.'
			]);
	}
} catch (Throwable $error) {
	error_log('Ingredients API Error: ' . $error->getMessage());
	respond(500, [
		'success' => false,
		'message' => 'Terjadi kesalahan pada server.'
	]);
}

function handleGet(PDO $pdo): void
{
	$id = isset($_GET['id']) ? (int) $_GET['id'] : null;

	if ($id) {
		$ingredient = fetchIngredient($pdo, $id);
		if (!$ingredient) {
			respond(404, ['success' => false, 'message' => 'Bahan baku tidak ditemukan.']);
		}

		respond(200, ['success' => true, 'data' => $ingredient]);
	}

	$search = isset($_GET['q']) ? trim($_GET['q']) : '';
	$lowStockOnly = isset($_GET['low_stock_only']) && $_GET['low_stock_only'] !== '0';

	$query = 'SELECT ingredient_id, name, unit, stock_qty, low_stock_threshold, created_at, updated_at FROM ingredients';
	$conditions = [];
	$params = [];

	if ($search !== '') {
		$conditions[] = 'name LIKE :search';
		$params[':search'] = '%' . $search . '%';
	}

	if ($lowStockOnly) {
		$conditions[] = '(low_stock_threshold IS NOT NULL AND stock_qty <= low_stock_threshold)';
	}

	if ($conditions) {
		$query .= ' WHERE ' . implode(' AND ', $conditions);
	}

	$query .= ' ORDER BY updated_at DESC';

	$stmt = $pdo->prepare($query);
	$stmt->execute($params);
	$data = $stmt->fetchAll();

	respond(200, ['success' => true, 'data' => $data]);
}

function handlePost(PDO $pdo): void
{
	$payload = getJsonInput();

	$name = trim($payload['name'] ?? '');
	$unit = trim($payload['unit'] ?? '');
	$stockQty = isset($payload['stock_qty']) ? (float) $payload['stock_qty'] : 0;
	$lowStock = array_key_exists('low_stock_threshold', $payload) && $payload['low_stock_threshold'] !== null
		? (float) $payload['low_stock_threshold']
		: null;

	if ($name === '' || $unit === '') {
		respond(400, ['success' => false, 'message' => 'Nama dan satuan wajib diisi.']);
	}

	$stmt = $pdo->prepare('INSERT INTO ingredients (name, unit, stock_qty, low_stock_threshold) VALUES (:name, :unit, :stock_qty, :low_stock)');
	$stmt->execute([
		':name' => $name,
		':unit' => $unit,
		':stock_qty' => $stockQty,
		':low_stock' => $lowStock,
	]);

	$newId = (int) $pdo->lastInsertId();
	$ingredient = fetchIngredient($pdo, $newId);

	respond(201, [
		'success' => true,
		'message' => 'Bahan baku berhasil ditambahkan.',
		'data' => $ingredient,
	]);
}

function handlePut(PDO $pdo): void
{
	$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
	if ($id <= 0) {
		respond(400, ['success' => false, 'message' => 'Parameter id wajib disertakan.']);
	}

	if (!fetchIngredient($pdo, $id)) {
		respond(404, ['success' => false, 'message' => 'Bahan baku tidak ditemukan.']);
	}

	$payload = getJsonInput();

	$fields = [];
	$params = [':id' => $id];

	if (array_key_exists('name', $payload)) {
		$name = trim((string) $payload['name']);
		if ($name === '') {
			respond(400, ['success' => false, 'message' => 'Nama tidak boleh kosong.']);
		}
		$fields[] = 'name = :name';
		$params[':name'] = $name;
	}

	if (array_key_exists('unit', $payload)) {
		$unit = trim((string) $payload['unit']);
		if ($unit === '') {
			respond(400, ['success' => false, 'message' => 'Satuan tidak boleh kosong.']);
		}
		$fields[] = 'unit = :unit';
		$params[':unit'] = $unit;
	}

	if (array_key_exists('stock_qty', $payload)) {
		$fields[] = 'stock_qty = :stock_qty';
		$params[':stock_qty'] = (float) $payload['stock_qty'];
	}

	if (array_key_exists('low_stock_threshold', $payload)) {
		$fields[] = 'low_stock_threshold = :low_stock_threshold';
		$params[':low_stock_threshold'] = $payload['low_stock_threshold'] === null
			? null
			: (float) $payload['low_stock_threshold'];
	}

	if (!$fields) {
		respond(400, ['success' => false, 'message' => 'Tidak ada field yang diperbarui.']);
	}

	$sql = 'UPDATE ingredients SET ' . implode(', ', $fields) . ' WHERE ingredient_id = :id';
	$stmt = $pdo->prepare($sql);
	$stmt->execute($params);

	$ingredient = fetchIngredient($pdo, $id);

	respond(200, [
		'success' => true,
		'message' => 'Data bahan baku berhasil diperbarui.',
		'data' => $ingredient,
	]);
}

function handleDelete(PDO $pdo): void
{
	$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
	if ($id <= 0) {
		respond(400, ['success' => false, 'message' => 'Parameter id wajib disertakan.']);
	}

	$stmt = $pdo->prepare('DELETE FROM ingredients WHERE ingredient_id = :id');
	$stmt->execute([':id' => $id]);

	if ($stmt->rowCount() === 0) {
		respond(404, ['success' => false, 'message' => 'Bahan baku tidak ditemukan atau sudah dihapus.']);
	}

	respond(200, ['success' => true, 'message' => 'Data bahan baku berhasil dihapus.']);
}

function fetchIngredient(PDO $pdo, int $id): ?array
{
	$stmt = $pdo->prepare('SELECT ingredient_id, name, unit, stock_qty, low_stock_threshold, created_at, updated_at FROM ingredients WHERE ingredient_id = :id');
	$stmt->execute([':id' => $id]);
	$row = $stmt->fetch();

	return $row ?: null;
}

function getJsonInput(): array
{
	$raw = file_get_contents('php://input');
	$data = json_decode($raw, true);

	if (!is_array($data)) {
		respond(400, ['success' => false, 'message' => 'Payload harus berupa JSON.']);
	}

	return $data;
}

function respond(int $statusCode, array $payload): void
{
	http_response_code($statusCode);
	echo json_encode($payload);
	exit;
}
