<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../config/db.php';
$db = (new Database())->connect();
if (!$db->query("SHOW COLUMNS FROM categories LIKE 'public_id'")->fetch()) {
    $db->exec('ALTER TABLE categories ADD COLUMN public_id VARCHAR(255) NULL AFTER image_url');
}
echo "Category image metadata ready. Existing categories preserved.\n";
