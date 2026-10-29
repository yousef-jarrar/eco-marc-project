<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../config/db.php';
try {
    $db = (new Database())->connect();
    $sql = file_get_contents(__DIR__ . '/../../database/migrations/20261029_shopping_ai.sql');
    foreach (explode(';', $sql) as $statement) if (trim($statement) !== '') $db->exec($statement);
    echo "Shopping AI tables ready. No preferences or store facts were invented.\n";
} catch (Throwable $error) {
    fwrite(STDERR, "Shopping AI migration failed. Check the database configuration and migration schema.\n");
    exit(1);
}
