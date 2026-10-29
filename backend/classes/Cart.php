<?php

require_once __DIR__ . "/../config/db.php";

class Cart
{
    private $db;

    // A discount counts only while it is switched on and inside its date range.
    private const DISCOUNT_IS_LIVE = "d.is_active = 1
        AND (d.start_date IS NULL OR d.start_date <= NOW())
        AND (d.end_date IS NULL OR d.end_date >= NOW())";

    public function __construct()
    {
        $database = new Database();

        $this->db = $database->connect();
    }

    private function getActiveCartId(int $user_id): int
    {
        $sql = "SELECT id FROM carts WHERE user_id = ? AND status = 'active' LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$user_id]);
        $cart = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($cart) {
            return (int) $cart["id"];
        }

        $sql = "INSERT INTO carts (user_id) VALUES (?)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$user_id]);

        return (int) $this->db->lastInsertId();
    }

    public function getCard(int $user_id): array
    {
        $sql = "SELECT c.id AS cart_id, ci.id AS cart_item_id, ci.variant_id, ci.quantity,
                       p.id AS product_id, p.name AS product_name, p.price,
                       COALESCE(d.percentage, 0) AS discount_percentage,
                       pv.size, pv.color, pv.quantity AS stock
                FROM carts c
                JOIN cart_items ci ON ci.cart_id = c.id
                JOIN product_variants pv ON pv.id = ci.variant_id
                JOIN products p ON p.id = pv.product_id
                LEFT JOIN discounts d
                       ON d.id = p.discount_id
                      AND d.type = 'normal'
                      AND " . self::DISCOUNT_IS_LIVE . "
                WHERE c.user_id = ? AND c.status = 'active'";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$user_id]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function addItme(
        int $user_id,
        int $variant_id,
        int $quantity
    ): bool {
        if ($quantity <= 0) {
            throw new InvalidArgumentException(
                "Quantity must be greater than zero."
            );
        }

        $this->db->beginTransaction();

        try {
            $sql = "SELECT pv.id, pv.quantity AS stock
                    FROM product_variants pv
                    JOIN products p ON p.id = pv.product_id
                    WHERE pv.id = ? AND p.is_active = 1
                    FOR UPDATE";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$variant_id]);
            $variant = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$variant) {
                throw new InvalidArgumentException(
                    "Product variant does not exist or is inactive."
                );
            }

            $cart_id = $this->getActiveCartId($user_id);

            $sql = "SELECT quantity FROM cart_items WHERE cart_id = ? AND variant_id = ? FOR UPDATE";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$cart_id, $variant_id]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            $old_quantity = $existing ? (int) $existing["quantity"] : 0;

            if ($old_quantity + $quantity > (int) $variant["stock"]) {
                throw new InvalidArgumentException(
                    "Requested quantity exceeds available stock."
                );
            }

            $sql = "INSERT INTO cart_items (cart_id, variant_id, quantity)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$cart_id, $variant_id, $quantity]);

            $this->db->commit();

            return true;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    public function removeItme(
        int $product_id,
        int $user_id
    ): bool {
        $sql = "DELETE ci
                FROM cart_items ci
                JOIN carts c ON c.id = ci.cart_id
                JOIN product_variants pv ON pv.id = ci.variant_id
                WHERE pv.product_id = ?
                AND c.user_id = ?
                AND c.status = 'active'";

        $stmt = $this->db->prepare($sql);

        return $stmt->execute([$product_id, $user_id]);
    }

    public function updateQuantity(
        int $user_id,
        int $cart_item_id,
        int $quantity
    ): bool {
        if ($quantity <= 0) {
            throw new InvalidArgumentException(
                "Quantity must be greater than zero."
            );
        }

        $this->db->beginTransaction();

        try {
            $sql = "SELECT ci.variant_id, pv.quantity AS stock
                    FROM cart_items ci
                    JOIN carts c ON c.id = ci.cart_id
                    JOIN product_variants pv ON pv.id = ci.variant_id
                    JOIN products p ON p.id = pv.product_id
                    WHERE ci.id = ?
                    AND c.user_id = ?
                    AND c.status = 'active'
                    AND p.is_active = 1
                    FOR UPDATE";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$cart_item_id, $user_id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$item) {
                throw new InvalidArgumentException(
                    "Cart item not found or product is inactive."
                );
            }

            if ($quantity > (int) $item["stock"]) {
                throw new InvalidArgumentException(
                    "Requested quantity exceeds available stock."
                );
            }

            $sql = "UPDATE cart_items SET quantity = ? WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$quantity, $cart_item_id]);

            $this->db->commit();

            return true;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    public function updateVariant(
        int $user_id,
        int $cart_item_id,
        int $new_variant_id
    ): bool {
        $this->db->beginTransaction();

        try {
            $sql = "SELECT ci.variant_id, ci.quantity
                    FROM cart_items ci
                    JOIN carts c ON c.id = ci.cart_id
                    WHERE ci.id = ?
                    AND c.user_id = ?
                    AND c.status = 'active'
                    FOR UPDATE";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$cart_item_id, $user_id]);
            $old_item = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$old_item) {
                throw new InvalidArgumentException(
                    "Cart item not found."
                );
            }

            $old_variant_id = (int) $old_item["variant_id"];
            $quantity = (int) $old_item["quantity"];

            if ($old_variant_id === $new_variant_id) {
                $this->db->commit();

                return true;
            }

            $sql = "SELECT pv.id, pv.quantity AS stock
                    FROM product_variants pv
                    JOIN products p ON p.id = pv.product_id
                    WHERE pv.id = ? AND p.is_active = 1
                    FOR UPDATE";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$new_variant_id]);
            $new_variant = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$new_variant) {
                throw new InvalidArgumentException(
                    "New variant does not exist or is inactive."
                );
            }

            $sql = "SELECT ci.id, ci.quantity
                    FROM cart_items ci
                    JOIN carts c ON c.id = ci.cart_id
                    WHERE c.user_id = ?
                    AND c.status = 'active'
                    AND ci.variant_id = ?
                    FOR UPDATE";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$user_id, $new_variant_id]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            $existing_quantity = $existing ? (int) $existing["quantity"] : 0;

            if (
                $existing_quantity + $quantity > (int) $new_variant["stock"]
            ) {
                throw new InvalidArgumentException(
                    "Not enough stock for the selected variant."
                );
            }

            if ($existing) {
                $sql = "UPDATE cart_items SET quantity = quantity + ? WHERE id = ?";
                $stmt = $this->db->prepare($sql);
                $stmt->execute([$quantity, $existing["id"]]);

                $sql = "DELETE FROM cart_items WHERE id = ?";
                $stmt = $this->db->prepare($sql);
                $stmt->execute([$cart_item_id]);
            } else {
                $sql = "UPDATE cart_items SET variant_id = ? WHERE id = ?";
                $stmt = $this->db->prepare($sql);
                $stmt->execute([$new_variant_id, $cart_item_id]);
            }

            $this->db->commit();

            return true;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    /**
     * Cart page totals. Uses the same calculateTotals() as checkout(),
     * so the cart and the saved order can never disagree.
     */
    public function getCartTotal(int $user_id): array
    {
        $sql = "SELECT id FROM carts WHERE user_id = ? AND status = 'active' LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$user_id]);
        $cart_id = $stmt->fetchColumn();

        if (!$cart_id) {
            return [
                "subtotal" => 0.0,
                "product_discount" => 0.0,
                "coupon_discount" => 0.0,
                "discount_amount" => 0.0,
                "delivery_fee" => 0.0,
                "total" => 0.0,
                "coupon_code" => null
            ];
        }

        $t = $this->calculateTotals((int) $cart_id);

        return [
            "subtotal" => $t["subtotal"],
            "product_discount" => $t["product_discount"],
            "coupon_discount" => $t["coupon_discount"],
            "discount_amount" => $t["discount_amount"],
            "delivery_fee" => $t["delivery_fee"],
            "total" => $t["total"],
            "coupon_code" => $t["coupon_code"]
        ];
    }

    /**
     * 1. Product (normal) discounts come from products.discount_id.
     * 2. The coupon (carts.coupon_id) is taken off the price that is
     *    left after the product discounts.
     * 3. Only discounts that are active and inside their dates count.
     */
    private function calculateTotals(int $cart_id): array
    {
        $sql = "SELECT
                    COALESCE(SUM(p.price * ci.quantity), 0) AS subtotal,
                    COALESCE(SUM(
                        p.price * ci.quantity * COALESCE(d.percentage, 0) / 100
                    ), 0) AS product_discount
                FROM cart_items ci
                JOIN product_variants pv ON pv.id = ci.variant_id
                JOIN products p ON p.id = pv.product_id
                LEFT JOIN discounts d
                       ON d.id = p.discount_id
                      AND d.type = 'normal'
                      AND " . self::DISCOUNT_IS_LIVE . "
                WHERE ci.cart_id = ?";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$cart_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $subtotal = round((float) $row["subtotal"], 2);
        $product_discount = round((float) $row["product_discount"], 2);

        // Coupon on this cart (if any) and whether it is still valid
        $sql = "SELECT c.coupon_id, d.percentage, d.coupon_code
                FROM carts c
                LEFT JOIN discounts d
                       ON d.id = c.coupon_id
                      AND d.type = 'coupon'
                      AND " . self::DISCOUNT_IS_LIVE . "
                WHERE c.id = ?";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$cart_id]);
        $coupon = $stmt->fetch(PDO::FETCH_ASSOC);

        $coupon_discount = 0.0;
        $coupon_code = null;
        $coupon_invalid = false;

        if ($coupon && $coupon["coupon_id"] !== null) {
            if ($coupon["percentage"] === null) {
                $coupon_invalid = true; // expired, switched off, or deleted
            } else {
                $coupon_code = $coupon["coupon_code"];
                $coupon_discount = round(
                    ($subtotal - $product_discount)
                    * (float) $coupon["percentage"] / 100,
                    2
                );
            }
        }

        $discount_amount = round($product_discount + $coupon_discount, 2);
        $delivery_fee = round($this->calculateDeliveryFee($subtotal), 2);
        $total = round(
            max(0, $subtotal - $discount_amount + $delivery_fee),
            2
        );

        return [
            "subtotal" => $subtotal,
            "product_discount" => $product_discount,
            "coupon_discount" => $coupon_discount,
            "discount_amount" => $discount_amount,
            "delivery_fee" => $delivery_fee,
            "total" => $total,
            "coupon_code" => $coupon_code,
            "coupon_invalid" => $coupon_invalid
        ];
    }

    public function applyCoupon(int $user_id, string $code): array
    {
        $code = trim($code);

        if ($code === "") {
            throw new InvalidArgumentException("Coupon code is required.");
        }

        $sql = "SELECT id FROM carts WHERE user_id = ? AND status = 'active' LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$user_id]);
        $cart_id = $stmt->fetchColumn();

        if (!$cart_id) {
            throw new InvalidArgumentException("Your cart is empty.");
        }

        $sql = "SELECT d.id
                FROM discounts d
                WHERE d.coupon_code = ?
                  AND d.type = 'coupon'
                  AND " . self::DISCOUNT_IS_LIVE . "
                LIMIT 1";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$code]);
        $coupon_id = $stmt->fetchColumn();

        if (!$coupon_id) {
            throw new InvalidArgumentException(
                "Invalid or expired coupon code."
            );
        }

        $sql = "UPDATE carts SET coupon_id = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$coupon_id, $cart_id]);

        return $this->getCartTotal($user_id);
    }

    public function removeCoupon(int $user_id): bool
    {
        $sql = "UPDATE carts
                SET coupon_id = NULL
                WHERE user_id = ? AND status = 'active'";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$user_id]);

        return true;
    }

    private function calculateDeliveryFee(float $subtotal): float
    {
        $sql = "SELECT delivery_fee, free_delivery_at FROM settings WHERE id = 1 LIMIT 1";
        $stmt = $this->db->query($sql);
        $settings = $stmt->fetch(PDO::FETCH_ASSOC);

        $delivery_fee = $settings ? (float) $settings["delivery_fee"] : 0.0;
        $free_delivery_at = $settings["free_delivery_at"] ?? null;

        if (
            $free_delivery_at !== null &&
            $subtotal >= (float) $free_delivery_at
        ) {
            return 0.0;
        }

        return $delivery_fee;
    }

    public function checkout(
        int $user_id,
        string $shipping_address
    ): array {
        $shipping_address = trim($shipping_address);

        if ($shipping_address === "") {
            throw new InvalidArgumentException(
                "Shipping address is required."
            );
        }

        $this->db->beginTransaction();

        try {
            $sql = "SELECT id
                    FROM carts
                    WHERE user_id = ?
                    AND status = 'active'
                    LIMIT 1
                    FOR UPDATE";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$user_id]);
            $cart = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$cart) {
                throw new InvalidArgumentException(
                    "No active cart found."
                );
            }

            $cart_id = (int) $cart["id"];

            $sql = "SELECT ci.id, ci.quantity, pv.id AS variant_id,
                           pv.quantity AS stock, p.is_active
                    FROM cart_items ci
                    JOIN product_variants pv ON pv.id = ci.variant_id
                    JOIN products p ON p.id = pv.product_id
                    WHERE ci.cart_id = ?
                    FOR UPDATE";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$cart_id]);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (!$items) {
                throw new InvalidArgumentException(
                    "Your cart is empty."
                );
            }

            foreach ($items as $item) {
                if (!(bool) $item["is_active"]) {
                    throw new InvalidArgumentException(
                        "Your cart contains an inactive product."
                    );
                }

                if ((int) $item["quantity"] > (int) $item["stock"]) {
                    throw new InvalidArgumentException(
                        "One or more items no longer have enough stock."
                    );
                }
            }

            // Take the stock. The WHERE quantity >= ? makes this safe
            // even if two customers check out at the same time.
            $sql = "UPDATE product_variants
                    SET quantity = quantity - ?
                    WHERE id = ? AND quantity >= ?";
            $stockStmt = $this->db->prepare($sql);

            foreach ($items as $item) {
                $stockStmt->execute([
                    $item["quantity"],
                    $item["variant_id"],
                    $item["quantity"]
                ]);

                if ($stockStmt->rowCount() !== 1) {
                    throw new InvalidArgumentException(
                        "One or more items no longer have enough stock."
                    );
                }
            }

            // Same calculation as the cart page: product discounts + coupon.
            $totals = $this->calculateTotals($cart_id);

            if ($totals["coupon_invalid"]) {
                throw new InvalidArgumentException(
                    "The coupon on your cart is no longer valid. Remove it and try again."
                );
            }

            $subtotal = $totals["subtotal"];
            $discount_amount = $totals["discount_amount"];
            $delivery_fee = $totals["delivery_fee"];
            $total = $totals["total"];

            $sql = "INSERT INTO cart_details (
                        cart_id,
                        subtotal,
                        discount_amount,
                        delivery_fee,
                        total,
                        shipping_address
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        subtotal = VALUES(subtotal),
                        discount_amount = VALUES(discount_amount),
                        delivery_fee = VALUES(delivery_fee),
                        total = VALUES(total),
                        shipping_address = VALUES(shipping_address)";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                $cart_id,
                $subtotal,
                $discount_amount,
                $delivery_fee,
                $total,
                $shipping_address
            ]);

            $sql = "UPDATE carts
                    SET status = 'pending'
                    WHERE id = ? AND user_id = ? AND status = 'active'";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$cart_id, $user_id]);

            if ($stmt->rowCount() !== 1) {
                throw new RuntimeException(
                    "Could not complete checkout."
                );
            }

            $this->db->commit();

            return [
                "cart_id" => $cart_id,
                "status" => "pending",
                "subtotal" => round($subtotal, 2),
                "discount_amount" => round($discount_amount, 2),
                "delivery_fee" => round($delivery_fee, 2),
                "total" => round($total, 2)
            ];
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    /**
     * Customer cancels ONE of their own pending orders.
     */
    public function updateStatus(
        int $user_id,
        int $order_id,
        string $status
    ): bool {
        if ($status !== "cancelled") {
            throw new InvalidArgumentException(
                "This status change is not allowed here."
            );
        }

        $this->db->beginTransaction();

        try {
            $sql = "SELECT id FROM carts
                    WHERE id = ? AND user_id = ? AND status = 'pending'
                    FOR UPDATE";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$order_id, $user_id]);

            if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                throw new InvalidArgumentException(
                    "Order not found or can no longer be cancelled."
                );
            }

            $this->restoreStock($order_id);

            $sql = "UPDATE carts SET status = 'cancelled' WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$order_id]);

            $this->db->commit();

            return true;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    /**
     * Admin changes the status of any order (order details page).
     */
    public function updateOrderStatus(int $order_id, string $status): bool
    {
        $allowed = [
            "pending", "confirmed", "processing",
            "shipped", "delivered", "cancelled"
        ];

        if (!in_array($status, $allowed, true)) {
            throw new InvalidArgumentException("Invalid status.");
        }

        $this->db->beginTransaction();

        try {
            $sql = "SELECT status FROM carts
                    WHERE id = ? AND status <> 'active'
                    FOR UPDATE";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$order_id]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                throw new InvalidArgumentException("Order not found.");
            }

            $old_status = $order["status"];

            if ($old_status === $status) {
                $this->db->commit();

                return true;
            }

            if ($old_status === "cancelled") {
                throw new InvalidArgumentException(
                    "A cancelled order cannot be changed."
                );
            }

            if ($status === "cancelled") {
                $this->restoreStock($order_id);
            }

            $sql = "UPDATE carts SET status = ? WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$status, $order_id]);

            $this->db->commit();

            return true;
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    private function restoreStock(int $cart_id): void
    {
        $sql = "UPDATE product_variants pv
                JOIN cart_items ci ON ci.variant_id = pv.id
                SET pv.quantity = pv.quantity + ci.quantity
                WHERE ci.cart_id = ?";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$cart_id]);
    }

    public function clearCart(int $user_id): bool
    {
        $sql = "DELETE ci
                FROM cart_items ci
                JOIN carts c ON c.id = ci.cart_id
                WHERE c.user_id = ? AND c.status = 'active'";

        $stmt = $this->db->prepare($sql);

        return $stmt->execute([$user_id]);
    }

    /**
     * The schema has no placed_at column, so carts.created_at is used
     * as the order date (aliased to placed_at for the front end).
     */
    public function getLatestOrders(
        string $username = "",
        ?string $start_date = null,
        ?string $end_date = null,
        int $page = 1,
        int $limit = 10
    ): array {
        $limit  = max(1, min($limit, 100));
        $page   = max(1, $page);
        $offset = ($page - 1) * $limit;

        $where  = ["c.status <> 'active'"];
        $params = [];

        if ($username !== "") {
            $where[] = "CONCAT(u.first_name, ' ', u.last_name) LIKE :username";
            $params[":username"] = "%" . $username . "%";
        }

        if ($start_date !== null) {
            $where[] = "c.created_at >= :start_date";
            $params[":start_date"] = $start_date;
        }

        if ($end_date !== null) {
            // < next day, so the whole end date is included
            $where[] = "c.created_at < DATE_ADD(:end_date, INTERVAL 1 DAY)";
            $params[":end_date"] = $end_date;
        }

        $sql = "
            SELECT
                c.id AS order_id,
                c.user_id,
                CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
                u.email AS customer_email,
                c.status,
                cd.subtotal,
                cd.discount_amount,
                cd.delivery_fee,
                cd.total,
                cd.shipping_address,
                c.created_at AS placed_at
            FROM carts c
            INNER JOIN users u ON u.id = c.user_id
            INNER JOIN cart_details cd ON cd.cart_id = c.id
            WHERE " . implode(" AND ", $where) . "
            ORDER BY c.created_at DESC, c.id DESC
            LIMIT :limit OFFSET :offset
        ";

        $stmt = $this->db->prepare($sql);

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(":limit", $limit, PDO::PARAM_INT);
        $stmt->bindValue(":offset", $offset, PDO::PARAM_INT);

        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getOrderDetails(int $order_id): ?array
    {
        // Order information
        $sql = "
            SELECT
                c.id AS order_id,
                c.user_id,
                CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
                u.email AS customer_email,
                c.status,
                cd.subtotal,
                cd.discount_amount,
                cd.delivery_fee,
                cd.total,
                cd.shipping_address,
                c.created_at AS placed_at
            FROM carts c
            INNER JOIN users u ON u.id = c.user_id
            INNER JOIN cart_details cd ON cd.cart_id = c.id
            WHERE c.id = ?
              AND c.status <> 'active'
            LIMIT 1
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$order_id]);

        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            return null;
        }

        // Items, with the product's primary image from product_images
        $sql = "
            SELECT
                ci.quantity,
                p.id AS product_id,
                p.name AS product_name,
                p.price,
                (SELECT pi.image_url
                 FROM product_images pi
                 WHERE pi.product_id = p.id
                 ORDER BY pi.is_primary DESC, pi.id ASC
                 LIMIT 1) AS product_image,
                pv.id AS variant_id,
                pv.size,
                pv.color
            FROM cart_items ci
            INNER JOIN product_variants pv ON pv.id = ci.variant_id
            INNER JOIN products p ON p.id = pv.product_id
            WHERE ci.cart_id = ?
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$order_id]);

        $order["items"] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return $order;
    }
}