<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/csrf.php';
require_once __DIR__ . '/../classes/Auth.php';

function authReply(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $auth = new Auth((new Database())->connect());
    $config = require __DIR__ . '/../config/auth.php';
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET') {
        $user = $auth->currentUser();
        if (empty($_SESSION['google_nonce'])) $_SESSION['google_nonce'] = bin2hex(random_bytes(32));
        authReply(200, ['success' => true, 'user' => $user, 'csrf_token' => $_SESSION['csrf_token'],
            'google_client_id' => $config['google_client_id'], 'google_nonce' => $_SESSION['google_nonce']]);
    }
    if ($method !== 'POST') {
        header('Allow: GET, POST');
        authReply(405, ['success' => false, 'message' => 'Method not allowed.']);
    }
    requireCsrf();
    $raw = file_get_contents('php://input');
    if (strlen($raw) > 20000) authReply(413, ['success' => false, 'message' => 'Request is too large.']);
    $data = json_decode($raw, true);
    if (!is_array($data)) authReply(400, ['success' => false, 'message' => 'Send a JSON object.']);
    foreach (['action', 'email', 'password', 'first_name', 'last_name', 'credential'] as $field) {
        if (isset($data[$field]) && !is_string($data[$field])) authReply(422, ['success' => false, 'message' => 'Invalid input.']);
    }
    $action = $data['action'] ?? '';
    if ($action === 'logout') {
        $auth->logout();
        authReply(200, ['success' => true, 'user' => null, 'csrf_token' => $_SESSION['csrf_token']]);
    }
    if (!in_array($action, ['login', 'register', 'google', 'link_google'], true)) authReply(400, ['success' => false, 'message' => 'Unknown action.']);
    $ipKey = hash('sha256', 'ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $emailKey = hash('sha256', 'email:' . strtolower(trim($data['email'] ?? '')));
    $auth->checkLimit($ipKey);
    $auth->recordAttempt($ipKey);
    if ($action === 'login') {
        $auth->checkLimit($emailKey);
        $auth->recordAttempt($emailKey);
        if (!filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL) || strlen($data['password'] ?? '') > 72) {
            throw new RuntimeException('Email or password is incorrect.', 401);
        }
        $user = $auth->login($data['email'], $data['password'] ?? '');
    } elseif ($action === 'register') {
        $user = $auth->register($data);
    } else {
        require_once __DIR__ . '/../classes/GoogleIdentity.php';
        $linkUser = null;
        if ($action === 'link_google') {
            $linkUser = $auth->currentUser();
            if (!$linkUser) throw new RuntimeException('Please sign in before linking Google.', 401);
        }
        $nonce = $_SESSION['google_nonce'] ?? '';
        $claims = (new GoogleIdentity($config['google_client_id']))->verify($data['credential'] ?? '', $nonce);
        unset($_SESSION['google_nonce']);
        $user = $auth->googleUser($claims, $linkUser);
    }
    authReply(200, ['success' => true, 'user' => $user, 'csrf_token' => $_SESSION['csrf_token']]);
} catch (Throwable $error) {
    $status = $error instanceof PDOException ? 500 : (int)$error->getCode();
    if (!in_array($status, [400, 401, 403, 409, 413, 422, 429, 503], true)) $status = 500;
    if ($status === 429) header('Retry-After: 900');
    if ($status === 500) error_log('Lumeire authentication error: ' . $error->getMessage());
    authReply($status, ['success' => false, 'message' => $status === 500 ? 'Sign-in is temporarily unavailable. Please try again.' : $error->getMessage()]);
}
