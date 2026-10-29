<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    $sessionConfig = require __DIR__ . '/auth.php';
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('ECOMARCSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $sessionConfig['cookie_path'],
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    if (!session_start()) throw new RuntimeException('Session storage is unavailable. Check the PHP session configuration.', 503);
}
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
