<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../classes/Wishlist.php';
require_once __DIR__ . '/../middleware/admin.php';
require_once __DIR__ . '/../middleware/csrf.php';

function wishlistRespond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function wishlistBody(): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
        return $_GET;
    }

    $decoded = json_decode(file_get_contents('php://input'), true);
    return is_array($decoded) ? $decoded : [];
}

function wishlistProductId(array $data): ?int
{
    $id = filter_var($data['product_id'] ?? null, FILTER_VALIDATE_INT);
    return ($id !== false && $id !== null && $id > 0) ? (int) $id : null;
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST', 'DELETE'], true)) {
        header('Allow: GET, POST, DELETE');
        wishlistRespond(405, ['success' => false, 'message' => 'Method not allowed.']);
    }

    $user = requireUser();
    $userId = (int) ($user['id'] ?? 0);
    if ($userId < 1) {
        wishlistRespond(401, ['success' => false, 'message' => 'Please sign in.']);
    }

    if ($method !== 'GET') {
        requireCsrf();
    }

    $data = wishlistBody();
    $action = is_string($data['action'] ?? null) ? $data['action'] : '';
    $wishlist = new Wishlist();

    if ($method === 'GET') {
        if ($action === 'contains') {
            $productId = wishlistProductId($data);
            if (!$productId) {
                wishlistRespond(400, ['success' => false, 'message' => 'A valid product_id is required.']);
            }
            wishlistRespond(200, [
                'success' => true,
                'data' => ['is_favorite' => $wishlist->contains($userId, $productId)]
            ]);
        }

        wishlistRespond(200, ['success' => true, 'data' => $wishlist->getAll($userId)]);
    }

    $productId = wishlistProductId($data);
    if (!$productId) {
        wishlistRespond(400, ['success' => false, 'message' => 'A valid product_id is required.']);
    }

    if ($method === 'POST') {
        $added = $wishlist->add($userId, $productId);
        wishlistRespond(200, [
            'success' => true,
            'added' => $added,
            'message' => $added ? 'Product added to your wishlist.' : 'Product is already in your wishlist.'
        ]);
    }

    $removed = $wishlist->remove($userId, $productId);
    wishlistRespond(200, [
        'success' => true,
        'removed' => $removed,
        'message' => $removed ? 'Product removed from your wishlist.' : 'Product was not in your wishlist.'
    ]);
} catch (InvalidArgumentException $error) {
    wishlistRespond(404, ['success' => false, 'message' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('Wishlist API error: ' . $error->getMessage());
    wishlistRespond(500, ['success' => false, 'message' => 'Could not process the wishlist request. Please try again.']);
}
