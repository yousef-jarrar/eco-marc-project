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
echo "Auth migration ready. Existing users were not changed.\n";
