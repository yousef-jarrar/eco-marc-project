<?php

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function profileReply(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    if (!is_file(__DIR__ . '/../vendor/autoload.php')) {
        profileReply(503, [
            'success' => false,
            'code' => 'server_setup_required',
            'message' => 'Profile service is not configured. Install the backend dependencies.',
        ]);
    }

    require_once __DIR__ . '/../config/session.php';
    require_once __DIR__ . '/../config/db.php';
    require_once __DIR__ . '/../middleware/csrf.php';
    require_once __DIR__ . '/../classes/Auth.php';
    require_once __DIR__ . '/../classes/Profile.php';

    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        profileReply(405, ['success' => false, 'message' => 'Method not allowed.']);
    }

    $database = new Database();
    $db = $database->connect();
    $auth = new Auth($db);
    $user = $auth->currentUser();
    if (!$user) {
        profileReply(401, ['success' => false, 'message' => 'Please sign in to access your profile.']);
    }

    $profile = new Profile($db);
    if ($method === 'GET') {
        $data = $profile->getByUserId($user['id']);
        if ($data === false) {
            profileReply(404, ['success' => false, 'message' => 'Your account could not be found.']);
        }
        profileReply(200, ['success' => true, 'data' => $data]);
    }

    requireCsrf();
    $raw = file_get_contents('php://input');
    if (strlen($raw) > 10000) {
        profileReply(413, ['success' => false, 'message' => 'Request is too large.']);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        profileReply(400, ['success' => false, 'message' => 'Send a valid JSON object.']);
    }

    foreach (['action', 'first_name', 'last_name', 'phone', 'address', 'current_password', 'new_password'] as $field) {
        if (isset($data[$field]) && !is_string($data[$field])) {
            profileReply(422, ['success' => false, 'message' => 'Invalid profile data.']);
        }
    }

    $action = $data['action'] ?? '';
    if ($action === 'update') {
        $updated = $profile->update($user['id'], $data);
        profileReply(200, ['success' => true, 'data' => $updated, 'message' => 'Profile updated.']);
    }
    if ($action === 'change_password') {
        $profile->changePassword(
            $user['id'],
            $data['current_password'] ?? '',
            $data['new_password'] ?? ''
        );
        profileReply(200, ['success' => true, 'message' => 'Your password has been updated.']);
    }

    profileReply(400, ['success' => false, 'message' => 'Unknown profile action.']);
} catch (Throwable $error) {
    $status = $error instanceof PDOException ? 500 : (int)$error->getCode();
    if (in_array($error->getMessage(), [
        'Required server configuration is missing.',
        'Server configuration could not be loaded.',
    ], true)) {
        $status = 503;
    }
    if (!in_array($status, [400, 401, 403, 404, 413, 422, 503], true)) {
        $status = 500;
    }
    if ($status === 500) {
        error_log('Lumeire profile API error: ' . $error->getMessage());
    }
    profileReply($status, [
        'success' => false,
        'message' => $status === 500
            ? 'Profile service is temporarily unavailable. Please try again.'
            : $error->getMessage(),
    ]);
}
