<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../config/db.php';
$db = (new Database())->connect();
$columns = $db->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);
foreach (['id', 'email', 'first_name', 'last_name', 'password_hash', 'google_id', 'role'] as $name) {
    if (!in_array($name, $columns, true)) {
        fwrite(STDERR, 'Missing users column: ' . $name . ". Migration stopped.\n"); exit(1);
    }
}
$db->exec(file_get_contents(__DIR__ . '/../../database/migrations/20261029_auth.sql'));
echo "Auth migration ready. Existing users were not changed.\n";
