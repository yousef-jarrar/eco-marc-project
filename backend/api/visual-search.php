<?php
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Use POST with an image file.']);
        exit;
    }
    require_once __DIR__ . '/../config/db.php';
    require_once __DIR__ . '/../classes/VisualSearch.php';
    require_once __DIR__ . '/../classes/ShoppingData.php';
    require_once __DIR__ . '/../middleware/csrf.php';
    requireCsrf();

    $file = $_FILES['image'] ?? null;
    if (!is_array($file) || !is_int($file['error'] ?? null)) {
        throw new InvalidArgumentException('Choose one image to search with.');
    }
    if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
        http_response_code(413);
        echo json_encode(['success' => false, 'message' => 'The image exceeds the server upload limit.']);
        exit;
    }
    $path = $file['tmp_name'] ?? '';
    if ($file['error'] !== UPLOAD_ERR_OK || !is_string($path) || !is_uploaded_file($path)) {
        throw new InvalidArgumentException('The image could not be uploaded.');
    }
    if (filesize($path) > 5 * 1024 * 1024) {
        http_response_code(413);
        echo json_encode(['success' => false, 'message' => 'The image must be 5 MB or smaller.']);
        exit;
    }
    $info = @getimagesize($path);
    if (!$info || !in_array($info['mime'], ['image/jpeg', 'image/png', 'image/webp'], true) ||
        $info[0] * $info[1] > 20000000) {
        throw new InvalidArgumentException('Use a valid JPG, PNG or WebP image up to 20 megapixels.');
    }

    $now = time();
    $recent = array_filter($_SESSION['visual_search_requests'] ?? [], function ($time) use ($now) { return $time > $now - 60; });
    if (count($recent) >= 10) {
        header('Retry-After: 60');
        http_response_code(429);
        echo json_encode(['success' => false, 'message' => 'Please wait a minute before searching again.']);
        exit;
    }
    $recent[] = $now;
    $_SESSION['visual_search_requests'] = array_values($recent);
    session_write_close();

    $db = (new Database())->connect();
    $products = (new VisualSearch($db))->search($path);
    $catalog = array_column((new ShoppingData($db))->catalog(), null, 'id');
    foreach ($products as &$product) {
        if (!isset($catalog[$product['id']])) continue;
        $current = $catalog[$product['id']];
        $product['price'] = $current['price'];
        $product['category'] = $current['category'];
        $product['in_stock'] = count($current['variants']) > 0;
    }
    unset($product);
    echo json_encode([
        'success' => true,
        'products' => $products,
        'message' => $products ? 'Products ranked by visual similarity.' : 'No indexed products are available yet.',
        'score_type' => 'cosine_similarity'
    ], JSON_THROW_ON_ERROR);
} catch (InvalidArgumentException $error) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('Eco Marc visual search failed: ' . get_class($error));
    http_response_code(503);
    echo json_encode(['success' => false, 'message' => 'Visual search is temporarily unavailable. Check the Python service and image index.']);
}
