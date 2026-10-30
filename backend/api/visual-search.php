<?php
ini_set('display_errors', '0');
set_time_limit(150);
$searchStage = 'setup';
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

    if (!extension_loaded('curl') || !extension_loaded('fileinfo')) throw new RuntimeException('Visual search PHP extensions missing.');
    $searchStage = 'database';
    $db = (new Database())->connect();
    $searchStage = 'search';
    $products = (new VisualSearch($db))->search($path);
    $searchStage = 'catalog';
    if ($products) {
        $ids = array_column($products, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $statement = $db->prepare("SELECT p.id, p.price, d.percentage, c.name AS category,
            EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.quantity>0) AS in_stock
            FROM products p JOIN categories c ON c.id=p.category_id
            LEFT JOIN discounts d ON d.id=p.discount_id WHERE p.id IN ($placeholders)");
        $statement->execute($ids);
        $catalog = array_column($statement->fetchAll(PDO::FETCH_ASSOC), null, 'id');
        foreach ($products as &$product) {
            if (!isset($catalog[$product['id']])) continue;
            $current = $catalog[$product['id']];
            $product['price'] = round((float)$current['price'] * (1 - max(0,min(100,(float)$current['percentage'])) / 100),2);
            $product['category'] = $current['category'];
            $product['in_stock'] = (bool)$current['in_stock'];
        }
        unset($product);
    }
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
    $code = 'visual_search_unavailable';
    $message = 'Visual search is temporarily unavailable. Check the Python service and image index.';
    if ($error->getMessage() === 'Visual search PHP extensions missing.') {
        $code = 'php_extensions_missing'; $message = 'Enable curl and fileinfo in Apache PHP, then restart Apache.';
    } elseif ($error->getMessage() === 'Python service unavailable. Start it on port 8001.') {
        $code = 'python_unreachable'; $message = 'PHP cannot reach the CLIP service at 127.0.0.1:8001. Start Python on the same computer as PHP.';
    } elseif (strpos($error->getMessage(),'Python could not process the image') === 0) {
        $code = 'python_image_rejected'; $message = 'The CLIP service could not process this image. Check its terminal output or try another photo.';
    } elseif ($error->getMessage() === 'VISUAL_SEARCH_URL must use the local Python service.') {
        $code = 'python_url_invalid'; $message = 'Set VISUAL_SEARCH_URL to http://127.0.0.1:8001 or remove the override to use the default.';
    } elseif ($error instanceof PDOException && $searchStage === 'search') {
        $code = 'visual_index_unavailable'; $message = 'The image index could not be read. Check the product_embeddings table and your database setup.';
    } elseif ($searchStage === 'database') {
        $code = 'database_unavailable'; $message = 'The project database is unavailable. Check MySQL and the backend database configuration.';
    } elseif ($searchStage === 'catalog') {
        $code = 'product_catalog_unavailable'; $message = 'Product prices or stock could not be read. Check the product tables in your database.';
    } elseif ($searchStage === 'setup') {
        $code = 'backend_setup_required'; $message = 'Check backend Composer dependencies and server configuration.';
    }
    error_log('Eco Marc visual search failed at '.$searchStage.' ('.get_class($error).', '.$code.').');
    http_response_code(503);
    echo json_encode(['success' => false, 'code' => $code, 'message' => $message]);
}
