<?php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

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
	error_log('Recipes API Error: ' . $error->getMessage());
	respond(500, [
		'success' => false,
		'message' => 'Terjadi kesalahan pada server.'
	]);
}

function handleGet(PDO $pdo): void
{
	$id = isset($_GET['id']) ? (int) $_GET['id'] : null;

	if ($id) {
		$recipe = fetchRecipe($pdo, $id);
		if (!$recipe) {
			respond(404, ['success' => false, 'message' => 'Resep tidak ditemukan.']);
		}

		respond(200, ['success' => true, 'data' => $recipe]);
	}

	$menuId = isset($_GET['menu_id']) ? (int) $_GET['menu_id'] : null;
	$ingredientId = isset($_GET['ingredient_id']) ? (int) $_GET['ingredient_id'] : null;
	$search = isset($_GET['q']) ? trim($_GET['q']) : '';

	$query = baseRecipeSelect();
	$conditions = [];
	$params = [];

	if ($menuId) {
		$conditions[] = 'mr.menu_id = :menu_id';
		$params[':menu_id'] = $menuId;
	}

	if ($ingredientId) {
		$conditions[] = 'mr.ingredient_id = :ingredient_id';
		$params[':ingredient_id'] = $ingredientId;
	}

	if ($search !== '') {
		$conditions[] = '(m.name LIKE :search OR i.name LIKE :search)';
		$params[':search'] = '%' . $search . '%';
	}

	if ($conditions) {
		$query .= ' WHERE ' . implode(' AND ', $conditions);
	}

	$query .= ' ORDER BY m.name ASC, i.name ASC';

	$stmt = $pdo->prepare($query);
	$stmt->execute($params);
	$data = $stmt->fetchAll();

	respond(200, ['success' => true, 'data' => $data]);
}

function handlePost(PDO $pdo): void
{
	$payload = getJsonInput();

	$menuId = isset($payload['menu_id']) ? (int) $payload['menu_id'] : 0;
	$ingredientId = isset($payload['ingredient_id']) ? (int) $payload['ingredient_id'] : 0;
	$qtyUsed = isset($payload['qty_used']) ? (float) $payload['qty_used'] : 0;
	$unit = normalizeNullableString($payload['unit'] ?? null);

	validateRecipeInput($menuId, $ingredientId, $qtyUsed);

	$stmt = $pdo->prepare('INSERT INTO menu_recipes (menu_id, ingredient_id, qty_used, unit) VALUES (:menu_id, :ingredient_id, :qty_used, :unit)');

	try {
		$stmt->execute([
			':menu_id' => $menuId,
			':ingredient_id' => $ingredientId,
			':qty_used' => $qtyUsed,
			':unit' => $unit,
		]);
	} catch (PDOException $e) {
		if ($e->getCode() === '23000') {
			respond(409, ['success' => false, 'message' => 'Bahan ini sudah terdaftar pada menu yang sama.']);
		}
		throw $e;
	}

	$newId = (int) $pdo->lastInsertId();
	$recipe = fetchRecipe($pdo, $newId);

	respond(201, [
		'success' => true,
		'message' => 'Resep menu berhasil ditambahkan.',
		'data' => $recipe,
	]);
}

function handlePut(PDO $pdo): void
{
	$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
	if ($id <= 0) {
		respond(400, ['success' => false, 'message' => 'Parameter id wajib disertakan.']);
	}

	$existing = fetchRecipe($pdo, $id);
	if (!$existing) {
		respond(404, ['success' => false, 'message' => 'Resep tidak ditemukan.']);
	}

	$payload = getJsonInput();

	$fields = [];
	$params = [':id' => $id];

	if (array_key_exists('menu_id', $payload)) {
		$menuId = (int) $payload['menu_id'];
		if ($menuId <= 0) {
			respond(400, ['success' => false, 'message' => 'menu_id harus berupa angka valid.']);
		}
		$fields[] = 'menu_id = :menu_id';
		$params[':menu_id'] = $menuId;
	}

	if (array_key_exists('ingredient_id', $payload)) {
		$ingredientId = (int) $payload['ingredient_id'];
		if ($ingredientId <= 0) {
			respond(400, ['success' => false, 'message' => 'ingredient_id harus berupa angka valid.']);
		}
		$fields[] = 'ingredient_id = :ingredient_id';
		$params[':ingredient_id'] = $ingredientId;
	}

	if (array_key_exists('qty_used', $payload)) {
		$qtyUsed = (float) $payload['qty_used'];
		if ($qtyUsed <= 0) {
			respond(400, ['success' => false, 'message' => 'qty_used harus lebih besar dari 0.']);
		}
		$fields[] = 'qty_used = :qty_used';
		$params[':qty_used'] = $qtyUsed;
	}

	if (array_key_exists('unit', $payload)) {
		$fields[] = 'unit = :unit';
		$params[':unit'] = normalizeNullableString($payload['unit']);
	}

	if (!$fields) {
		respond(400, ['success' => false, 'message' => 'Tidak ada data yang diperbarui.']);
	}

	$sql = 'UPDATE menu_recipes SET ' . implode(', ', $fields) . ' WHERE recipe_id = :id';
	$stmt = $pdo->prepare($sql);

	try {
		$stmt->execute($params);
	} catch (PDOException $e) {
		if ($e->getCode() === '23000') {
			respond(409, ['success' => false, 'message' => 'Kombinasi menu dan bahan sudah digunakan.']);
		}
		throw $e;
	}

	$recipe = fetchRecipe($pdo, $id);

	respond(200, [
		'success' => true,
		'message' => 'Data resep diperbarui.',
		'data' => $recipe,
	]);
}

function handleDelete(PDO $pdo): void
{
	$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
	if ($id <= 0) {
		respond(400, ['success' => false, 'message' => 'Parameter id wajib disertakan.']);
	}

	$stmt = $pdo->prepare('DELETE FROM menu_recipes WHERE recipe_id = :id');
	$stmt->execute([':id' => $id]);

	if ($stmt->rowCount() === 0) {
		respond(404, ['success' => false, 'message' => 'Resep tidak ditemukan atau sudah dihapus.']);
	}

	respond(200, ['success' => true, 'message' => 'Resep berhasil dihapus.']);
}

function fetchRecipe(PDO $pdo, int $id): ?array
{
	$sql = baseRecipeSelect() . ' WHERE mr.recipe_id = :id LIMIT 1';
	$stmt = $pdo->prepare($sql);
	$stmt->execute([':id' => $id]);
	$row = $stmt->fetch();

	return $row ?: null;
}

function baseRecipeSelect(): string
{
	return 'SELECT mr.recipe_id, mr.menu_id, m.name AS menu_name, mr.ingredient_id, i.name AS ingredient_name, mr.qty_used, mr.unit ' .
		'FROM menu_recipes mr ' .
		'LEFT JOIN menu m ON mr.menu_id = m.menu_id ' .
		'LEFT JOIN ingredients i ON mr.ingredient_id = i.ingredient_id';
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

function normalizeNullableString($value): ?string
{
	if ($value === null) {
		return null;
	}

	$trimmed = trim((string) $value);
	return $trimmed === '' ? null : $trimmed;
}

function validateRecipeInput(int $menuId, int $ingredientId, float $qtyUsed): void
{
	if ($menuId <= 0 || $ingredientId <= 0) {
		respond(400, ['success' => false, 'message' => 'menu_id dan ingredient_id wajib diisi dengan angka valid.']);
	}

	if ($qtyUsed <= 0) {
		respond(400, ['success' => false, 'message' => 'qty_used harus lebih besar dari 0.']);
	}
}

function respond(int $statusCode, array $payload): void
{
	http_response_code($statusCode);
	echo json_encode($payload);
	exit;
}
