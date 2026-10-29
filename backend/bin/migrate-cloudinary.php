<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../config/db.php';
$db = (new Database())->connect();
if (!$db->query("SHOW COLUMNS FROM product_images LIKE 'public_id'")->fetch()) {
    $db->exec('ALTER TABLE product_images ADD COLUMN public_id VARCHAR(255) NULL AFTER image_url');
}
echo "Cloudinary image schema ready. Existing images preserved.\n";
