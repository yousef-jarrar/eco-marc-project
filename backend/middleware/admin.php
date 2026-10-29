<?php
require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../classes/Auth.php';

function requireUser(): array {
    $auth = new Auth((new Database())->connect());
    $user = $auth->currentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Please sign in.']);
        exit;
    }
    return $user;
}

function requireRole(string $role): array {
    $user = requireUser();
    if ($user['role'] !== $role) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'You do not have permission to access this resource.']);
        exit;
    }
    return $user;
}

function requireAdmin(): void {
    requireRole('admin');
}
