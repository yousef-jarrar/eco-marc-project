<?php

header("Content-Type: application/json; charset=utf-8");

require_once __DIR__ . "/../classes/Cart.php";

try {
    $cart = new Cart();
    $method = $_SERVER["REQUEST_METHOD"];
    $body = json_decode(file_get_contents("php://input"), true);

    if (!is_array($body)) {
        $body = [];
    }

    $action = $body["action"] ?? "";

    switch ($method) {
        case "GET":
            $user_id = filter_var(
                $body["user_id"] ?? null,
                FILTER_VALIDATE_INT
            );

            if (!$user_id || $user_id <= 0) {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Invalid user ID"
                ]);
                break;
            }

            if ($action === "items") {
                $data = $cart->getCard($user_id);
            } elseif ($action === "total") {
                $data = $cart->getCartTotal($user_id);
            } elseif ($action === "latest") {
    $username = trim($body["username"] ?? "");
    $start_date = $body["start_date"] ?? null;
    $end_date = $body["end_date"] ?? null;

    $page = filter_var(
        $body["page"] ?? 1,
        FILTER_VALIDATE_INT
    );

    if ($page === false || $page < 1) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Invalid page number"
        ]);
        break;
    }

    foreach (["start_date" => $start_date, "end_date" => $end_date] as $field => $date) {
        if (
            $date !== null &&
            $date !== "" &&
            (
                !is_string($date) ||
                !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ||
                !checkdate(
                    (int) substr($date, 5, 2),
                    (int) substr($date, 8, 2),
                    (int) substr($date, 0, 4)
                )
            )
        ) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Invalid " . $field . ". Use YYYY-MM-DD."
            ]);
            break 2;
        }
    }

    if (
        $start_date && $end_date &&
        $start_date > $end_date
    ) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Start date must be before or equal to end date"
        ]);
        break;
    }

    $data = $cart->getLatestOrders(
        $username,
        $start_date ?: null,
        $end_date ?: null,
        $page
    );
}
 else {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Invalid action"
                ]);
                break;
            }

            echo json_encode([
                "success" => true,
                "data" => $data
            ]);
            break;

        case "POST":
            $user_id = filter_var(
                $body["user_id"] ?? null,
                FILTER_VALIDATE_INT
            );

            if (!$user_id || $user_id <= 0) {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Invalid user ID"
                ]);
                break;
            }

            if ($action === "add") {
                $variant_id = filter_var(
                    $body["variant_id"] ?? null,
                    FILTER_VALIDATE_INT
                );

                $quantity = filter_var(
                    $body["quantity"] ?? null,
                    FILTER_VALIDATE_INT
                );

                if (!$variant_id || $variant_id <= 0) {
                    http_response_code(400);
                    echo json_encode([
                        "success" => false,
                        "message" => "Invalid variant ID"
                    ]);
                    break;
                }

                if (!$quantity || $quantity <= 0) {
                    http_response_code(400);
                    echo json_encode([
                        "success" => false,
                        "message" => "Invalid quantity"
                    ]);
                    break;
                }

                $data = $cart->addItme(
                    $user_id,
                    $variant_id,
                    $quantity
                );
            } elseif ($action === "checkout") {
                $shipping_address = trim(
                    $body["shipping_address"] ?? ""
                );

                if ($shipping_address === "") {
                    http_response_code(400);
                    echo json_encode([
                        "success" => false,
                        "message" => "Shipping address is required"
                    ]);
                    break;
                }

                $data = $cart->checkout(
                    $user_id,
                    $shipping_address
                );
            } else {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Invalid action"
                ]);
                break;
            }

            echo json_encode([
                "success" => true,
                "data" => $data
            ]);
            break;

        case "PATCH":
            $user_id = filter_var(
                $body["user_id"] ?? null,
                FILTER_VALIDATE_INT
            );

            if (!$user_id || $user_id <= 0) {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Invalid user ID"
                ]);
                break;
            }

            if ($action === "quantity") {
                $cart_item_id = filter_var(
                    $body["cart_item_id"] ?? null,
                    FILTER_VALIDATE_INT
                );

                $quantity = filter_var(
                    $body["quantity"] ?? null,
                    FILTER_VALIDATE_INT
                );

                if (
                    !$cart_item_id ||
                    $cart_item_id <= 0 ||
                    !$quantity ||
                    $quantity <= 0
                ) {
                    http_response_code(400);
                    echo json_encode([
                        "success" => false,
                        "message" => "Invalid cart item ID or quantity"
                    ]);
                    break;
                }

                $data = $cart->updateQuantity(
                    $user_id,
                    $cart_item_id,
                    $quantity
                );
            } elseif ($action === "variant") {
                $cart_item_id = filter_var(
                    $body["cart_item_id"] ?? null,
                    FILTER_VALIDATE_INT
                );

                $new_variant_id = filter_var(
                    $body["new_variant_id"] ?? null,
                    FILTER_VALIDATE_INT
                );

                if (
                    !$cart_item_id ||
                    $cart_item_id <= 0 ||
                    !$new_variant_id ||
                    $new_variant_id <= 0
                ) {
                    http_response_code(400);
                    echo json_encode([
                        "success" => false,
                        "message" => "Invalid cart item ID or variant ID"
                    ]);
                    break;
                }

                $data = $cart->updateVariant(
                    $user_id,
                    $cart_item_id,
                    $new_variant_id
                );
            } elseif ($action === "status") {
                $status = $body["status"] ?? "";

                if (!in_array($status, ["cancelled"], true)) {
                    http_response_code(400);
                    echo json_encode([
                        "success" => false,
                        "message" => "Invalid status"
                    ]);
                    break;
                }

                $data = $cart->updateStatus(
                    $user_id,
                    $status
                );
            } else {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Invalid action"
                ]);
                break;
            }

            echo json_encode([
                "success" => true,
                "data" => $data
            ]);
            break;

        case "DELETE":
            $user_id = filter_var(
                $body["user_id"] ?? null,
                FILTER_VALIDATE_INT
            );

            if (!$user_id || $user_id <= 0) {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Invalid user ID"
                ]);
                break;
            }

            if ($action === "remove") {
                $product_id = filter_var(
                    $body["product_id"] ?? null,
                    FILTER_VALIDATE_INT
                );

                if (!$product_id || $product_id <= 0) {
                    http_response_code(400);
                    echo json_encode([
                        "success" => false,
                        "message" => "Invalid product ID"
                    ]);
                    break;
                }

                $data = $cart->removeItme(
                    $product_id,
                    $user_id
                );
            } elseif ($action === "clear") {
                $data = $cart->clearCart($user_id);
            } else {
                http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Invalid action"
                ]);
                break;
            }

            echo json_encode([
                "success" => true,
                "data" => $data
            ]);
            break;

        default:
            header("Allow: GET, POST, PATCH, DELETE");
            http_response_code(405);
            echo json_encode([
                "success" => false,
                "message" => "Method not allowed"
            ]);
            break;
    }
} catch (Throwable $e) {
    error_log($e->getMessage());

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Internal server error"
    ]);
}