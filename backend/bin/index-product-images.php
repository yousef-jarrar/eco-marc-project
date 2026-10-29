<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

try {
    require_once __DIR__ . '/../config/db.php';
    require_once __DIR__ . '/../classes/VisualSearch.php';
    if (!extension_loaded('curl') || !extension_loaded('fileinfo')) {
        throw new RuntimeException('Enable the curl and fileinfo PHP extensions.');
    }
    $imageId = null;
    if (isset($argv[1])) {
        if (!ctype_digit($argv[1]) || (int)$argv[1] < 1 || count($argv) > 2) {
            throw new RuntimeException('Usage: php index-product-images.php [image_id]');
        }
        $imageId = (int)$argv[1];
    }
    $db = (new Database())->connect();
    $results = (new VisualSearch($db))->indexImages($imageId);
    $failed = 0;
    foreach ($results as $result) {
        echo 'Image ' . $result['image_id'] . ': ' . $result['status'];
        if ($result['status'] === 'failed') { $failed++; echo ' - ' . $result['message']; }
        echo PHP_EOL;
    }
    echo 'Saved: ' . (count($results) - $failed) . ', failed: ' . $failed . PHP_EOL;
    if (!$results) echo 'No active product images found.' . PHP_EOL;
    exit($failed ? 1 : 0);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
