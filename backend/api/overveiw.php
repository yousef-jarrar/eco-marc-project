<?php

date_default_timezone_set('Asia/Amman');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../classes/overveiw.php';
require_once __DIR__ . '/../middleware/admin.php';

requireAdmin();

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        header('Allow: GET');
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed'
        ]);
        exit;
    }

    foreach (['from', 'to'] as $key) {
        if (isset($_GET[$key]) && !is_string($_GET[$key])) {
            throw new InvalidArgumentException('Reporting dates must be strings.');
        }
    }

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    $connection = (new Database())->connect();
    $overview = new Overview($connection);
    $data = $overview->getReport($_GET['from'] ?? null, $_GET['to'] ?? null);

    echo json_encode(
        ['success' => true, 'data' => $data],
        JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
    );
} catch (InvalidArgumentException $error) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $error->getMessage()
    ]);
} catch (Throwable $error) {
    error_log('Eco Marc overview: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Store overview is temporarily unavailable. Please retry.'
    ]);
}