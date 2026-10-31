<?php

header("Content-Type: application/json; charset=utf-8");

require_once __DIR__ . "/../classes/Cart.php";
require_once __DIR__ . "/../middleware/admin.php";
require_once __DIR__ . "/../middleware/csrf.php";

function fail(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode([
        "success" => false,
        "message" => $message
    ]);
    exit;
}

function ok($data): void
{
    echo json_encode([
        "success" => true,
        "data" => $data
    ]);
    exit;
}

function intField(array $body, string $key): ?int
{
    $value = filter_var($body[$key] ?? null, FILTER_VALIDATE_INT);

    return ($value !== false && $value > 0) ? $value : null;
}

function validDate($date): bool
{
    return is_string($date)
        && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
        && checkdate(
            (int) substr($date, 5, 2),
            (int) substr($date, 8, 2),
            (int) substr($date, 0, 4)
        );
}

function getLatest(Cart $cart, array $body): array
{
    if (!is_string($body["username"] ?? "")) fail(400, "Enter a valid order search.");
    $username   = trim($body["username"] ?? "");
    $start_date = $body["start_date"] ?? null;
    $end_date   = $body["end_date"] ?? null;

    $page = filter_var($body["page"] ?? 1, FILTER_VALIDATE_INT);

    if ($page === false || $page < 1) {
        fail(400, "Invalid page number");
    }

    foreach (["start_date" => $start_date, "end_date" => $end_date] as $field => $date) {
        if ($date !== null && $date !== "" && !validDate($date)) {
            fail(400, "Invalid $field. Use YYYY-MM-DD.");
        }
    }

    if ($start_date && $end_date && $start_date > $end_date) {
        fail(400, "Start date must be before or equal to end date");
    }

    $status = $body["status"] ?? null;
    if ($status === "") $status = null;
    if ($status !== null && !in_array($status, ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"], true)) fail(400, "Choose a valid order status.");
    $limit = filter_var($body["limit"] ?? 10, FILTER_VALIDATE_INT);
    if ($limit === false || $limit < 1 || $limit > 50) fail(400, "Choose a page size from 1 to 50.");
    if (($body["lookahead"] ?? false) === true) $limit++;

    return $cart->getLatestOrders(
        $username,
        $start_date ?: null,
        $end_date ?: null,
        $page,
        $limit,
        $status
    );
}

function getDetails(Cart $cart, array $body): array
{
    $order_id = intField($body, "order_id");

    if (!$order_id) {
        fail(400, "Invalid order ID");
    }

    $data = $cart->getOrderDetails($order_id);

    if ($data === null) {
        fail(404, "Order not found");
    }

    return $data;
}

try {
    $user   = requireUser();
    $cart   = new Cart();
    $method = $_SERVER["REQUEST_METHOD"];

    if ($method === "GET") {
        $body = $_GET;
    } else {
        $body = json_decode(file_get_contents("php://input"), true);

        if (!is_array($body)) {
            $body = [];
        }
    }

    $action = $body["action"] ?? "";

    if (!in_array($method, ["GET", "POST", "PATCH", "DELETE"], true)) {
        header("Allow: GET, POST, PATCH, DELETE");
        fail(405, "Method not allowed");
    }

    $user_id = (int)$user["id"];

    // Coupon code sent by the browser (query string on GET, JSON body on POST).
    // Only the code is sent; the percentage is always looked up in `discounts`.
    $coupon = trim((string)($body["coupon_code"] ?? ""));
    $coupon = $coupon !== "" ? $coupon : null;

    if (in_array($action, ["latest", "details", "order_status"], true) && $user["role"] !== "admin") fail(403, "Admin access required.");
    if ($method !== "GET") requireCsrf();

    if (!$user_id) {
        fail(400, "Invalid user ID");
    }

    switch ($method) {
        case "GET":
            if ($action === "items") {
                ok($cart->getCard($user_id));
            }

            if ($action === "total") {
                ok($cart->getCartTotal($user_id, $coupon));
            }

            if ($action === "csrf") {
                if (empty($_SESSION["csrf_token"])) {
                    $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
                }
                ok(["csrf_token" => $_SESSION["csrf_token"]]);
            }

            if ($action === "profile") {
                ok($cart->getProfile($user_id));
            }

if ($action === "my_orders") {
    $page = filter_var($body["page"] ?? 1, FILTER_VALIDATE_INT);

    if ($page === false || $page < 1) {
        fail(400, "Invalid page number");
    }

    ok($cart->getMyOrders($user_id, $page, 10));
}

if ($action === "my_order_details") {
    $order_id = intField($body, "order_id");

    if (!$order_id) {
        fail(400, "Invalid order ID");
    }

    $data = $cart->getMyOrderDetails($user_id, $order_id);

    if ($data === null) {
        fail(404, "Order not found");
    }

    ok($data);
}

            if ($action === "latest") {
                ok(getLatest($cart, $body));
            }

            if ($action === "details") {
                ok(getDetails($cart, $body));
            }

            fail(400, "Invalid action");
            break;

        case "POST":
            if ($action === "details") {
                ok(getDetails($cart, $body));
            }

            if ($action === "latest") {
                ok(getLatest($cart, $body));
            }

            if ($action === "add") {
                $variant_id = intField($body, "variant_id");
                $quantity   = intField($body, "quantity");

                if (!$variant_id) {
                    fail(400, "Invalid variant ID");
                }

                if (!$quantity) {
                    fail(400, "Invalid quantity");
                }

                ok($cart->addItme($user_id, $variant_id, $quantity));
            }

            if ($action === "checkout") {
                $shipping_address = trim($body["shipping_address"] ?? "");

                if ($shipping_address === "") {
                    fail(400, "Shipping address is required");
                }

                $phone = $body["phone"] ?? null;
                if ($phone !== null && !is_string($phone)) {
                    fail(422, "Enter a valid phone number.");
                }
                ok($cart->checkout($user_id, $shipping_address, $coupon, $phone));
            }

            fail(400, "Invalid action");
            break;

        case "PATCH":
            if ($action === "order_status") {
                $order_id = intField($body, "order_id");
                if (!$order_id || !is_string($body["status"] ?? null)) fail(400, "Invalid order status request.");
                ok($cart->updateOrderStatus($order_id, $body["status"]));
            }

            if ($action === "quantity") {
                $cart_item_id = intField($body, "cart_item_id");
                $quantity     = intField($body, "quantity");

                if (!$cart_item_id || !$quantity) {
                    fail(400, "Invalid cart item ID or quantity");
                }

                ok($cart->updateQuantity($user_id, $cart_item_id, $quantity));
            }

            if ($action === "variant") {
                $cart_item_id   = intField($body, "cart_item_id");
                $new_variant_id = intField($body, "new_variant_id");

                if (!$cart_item_id || !$new_variant_id) {
                    fail(400, "Invalid cart item ID or variant ID");
                }

                ok($cart->updateVariant($user_id, $cart_item_id, $new_variant_id));
            }

            if ($action === "status") {
                $order_id = intField($body, "order_id");
                $status   = $body["status"] ?? "";

                if (!$order_id) {
                    fail(400, "Invalid order ID");
                }

                ok($cart->updateStatus($user_id, $order_id, $status));
            }

            fail(400, "Invalid action");
            break;

        case "DELETE":
            if ($action === "remove") {
                $product_id = intField($body, "product_id");

                if (!$product_id) {
                    fail(400, "Invalid product ID");
                }

                ok($cart->removeItme($product_id, $user_id));
            }

            if ($action === "clear") {
                ok($cart->clearCart($user_id));
            }

            fail(400, "Invalid action");
            break;
    }

} catch (InvalidArgumentException $e) {

    fail(422, $e->getMessage());

} catch (Throwable $e) {

    error_log(
        "Eco Marc API Error: " .
        $e->getMessage() .
        " | File: " . $e->getFile() .
        " | Line: " . $e->getLine()
    );

    fail(500, "Orders are temporarily unavailable. Please try again.");
}