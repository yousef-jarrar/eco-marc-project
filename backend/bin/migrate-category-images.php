<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../config/db.php';
$db = (new Database())->connect();
if (!$db->query("SHOW COLUMNS FROM categories LIKE 'public_id'")->fetch()) {
    $db->exec('ALTER TABLE categories ADD COLUMN public_id VARCHAR(255) NULL AFTER image_url');
}
if (!$db->query("SHOW COLUMNS FROM categories LIKE 'status'")->fetch()) {
    $db->exec("ALTER TABLE categories ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active'");
}
echo "Category image metadata and status ready. Existing categories preserved.\n";
