<?php
require_once __DIR__ . '/../config/session.php';

function requireCsrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($token) || !hash_equals($_SESSION['csrf_token'], $token)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'code' => 'csrf_invalid', 'message' => 'Your session token expired. Reload the page and try again.']);
        exit;
    }
}
