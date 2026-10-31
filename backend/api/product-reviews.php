<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../classes/Review.php';
require_once __DIR__ . '/../middleware/admin.php';
require_once __DIR__ . '/../middleware/csrf.php';
function productReviewResponse(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}
try {
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        productReviewResponse(405, ['success' => false, 'message' => 'Method not allowed.']);
    }
    $connection = (new Database())->connect();
    $review = new Review($connection);
    if ($method === 'POST') {
        $user = requireUser();
        requireCsrf();
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) throw new InvalidArgumentException('Send valid review data.');
        $productId = filter_var($body['product_id'] ?? null, FILTER_VALIDATE_INT);
        $rating = filter_var($body['rating'] ?? null, FILTER_VALIDATE_INT);
        if (!$productId || $productId < 1 || !$rating || $rating < 1 || $rating > 5 || !is_string($body['comment'] ?? null)) throw new InvalidArgumentException('Choose a valid product, 1–5 stars and a comment.');
        $own = $review->saveProductReview($productId, (int)$user['id'], $rating, $body['comment']);
        productReviewResponse(200, ['success' => true, 'message' => 'Your review was sent for moderation.', 'data' => $own]);
    }
    $productId = filter_var($_GET['product_id'] ?? null, FILTER_VALIDATE_INT);
    $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT);
    $rating = isset($_GET['rating']) ? filter_var($_GET['rating'], FILTER_VALIDATE_INT) : null;
    $sort = $_GET['sort'] ?? 'newest';
    if (!$productId || $productId < 1 || !$page || $page < 1 || ($rating !== null && (!$rating || $rating < 1 || $rating > 5)) || !in_array($sort, ['newest', 'highest', 'lowest'], true)) throw new InvalidArgumentException('Choose valid review filters.');
    $product = $connection->prepare("SELECT p.id FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=? AND p.is_active=1 AND c.status='active'");
    $product->execute([$productId]);
    if (!$product->fetchColumn()) productReviewResponse(404, ['success' => false, 'message' => 'This product is not available.']);
    $user = (new Auth($connection))->currentUser();
    productReviewResponse(200, ['success' => true, 'data' => $review->productReviews($productId, $page, $rating, $sort, $user ? (int)$user['id'] : null)]);
} catch (InvalidArgumentException $error) {
    productReviewResponse(422, ['success' => false, 'message' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('Product reviews: ' . $error->getMessage());
    productReviewResponse(500, ['success' => false, 'message' => 'Reviews are temporarily unavailable. Please try again.']);
}
