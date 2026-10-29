<?php

require_once __DIR__ . "/../config/db.php";

class Cart
{
    private $db;

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
        $sql = "SELECT c.id AS cart_id, ci.id AS cart_item_id, ci.variant_id, ci.quantity, p.id AS product_id, p.name AS product_name, p.price, pv.size, pv.color, pv.quantity AS stock
                FROM carts c
                JOIN cart_items ci ON ci.cart_id = c.id
                JOIN product_variants pv ON pv.id = ci.variant_id
                JOIN products p ON p.id = pv.product_id
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
error_log("updateQuantity user=$user_id item=$cart_item_id qty=$quantity");
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

    public function getCartTotal(int $user_id): array
    {
        $sql = "SELECT
                    COALESCE(SUM(p.price * ci.quantity), 0) AS subtotal,
                    COALESCE(
                        SUM(
                            p.price * ci.quantity * COALESCE(d.percentage, 0) / 100
                        ),
                        0
                    ) AS discount_amount
                FROM carts c
                LEFT JOIN cart_items ci ON ci.cart_id = c.id
                LEFT JOIN product_variants pv ON pv.id = ci.variant_id
                LEFT JOIN products p ON p.id = pv.product_id
                LEFT JOIN discounts d ON d.id = p.discount_id
                WHERE c.user_id = ? AND c.status = 'active'";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$user_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        $subtotal = (float) $result["subtotal"];
        $discount_amount = (float) $result["discount_amount"];

        $sql = "SELECT delivery_fee, free_delivery_at FROM settings WHERE id = 1 LIMIT 1";
        $stmt = $this->db->query($sql);
        $settings = $stmt->fetch(PDO::FETCH_ASSOC);

        $delivery_fee = $settings ? (float) $settings["delivery_fee"] : 0.0;
        $free_delivery_at = $settings["free_delivery_at"] ?? null;

        if (
            $free_delivery_at !== null &&
            $subtotal >= (float) $free_delivery_at
        ) {
            $delivery_fee = 0.0;
        }

        // Subtract discounts and add delivery.
        $total = max(0, $subtotal - $discount_amount + $delivery_fee);

        return [
            "subtotal" => round($subtotal, 2),
            "discount_amount" => round($discount_amount, 2),
            "delivery_fee" => round($delivery_fee, 2),
            "total" => round($total, 2)
        ];
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

            $sql = "SELECT ci.id, ci.quantity, pv.id AS variant_id, pv.quantity AS stock, p.is_active
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

            $sql = "SELECT COALESCE(
                        SUM(p.price * ci.quantity),
                        0
                    ) AS subtotal
                    FROM cart_items ci
                    JOIN product_variants pv ON pv.id = ci.variant_id
                    JOIN products p ON p.id = pv.product_id
                    WHERE ci.cart_id = ?";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([$cart_id]);
            $subtotal = (float) $stmt->fetchColumn();

            $sql = "SELECT delivery_fee, free_delivery_at FROM settings WHERE id = 1 LIMIT 1";
            $stmt = $this->db->query($sql);
            $settings = $stmt->fetch(PDO::FETCH_ASSOC);

            $delivery_fee = $settings ? (float) $settings["delivery_fee"] : 0.0;
            $free_delivery_at = $settings["free_delivery_at"] ?? null;

            if (
                $free_delivery_at !== null &&
                $subtotal >= (float) $free_delivery_at
            ) {
                $delivery_fee = 0.0;
            }

            $discount_amount = 0.0;

            $total = max(
                0,
                $subtotal - $discount_amount + $delivery_fee
            );

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


    public function updateStatus(
        int $user_id,
        string $status
    ): bool {
        if (!in_array($status, ["pending", "cancelled"], true)) {
            throw new InvalidArgumentException(
                "This status change is not allowed here."
            );
        }

        if ($status === "pending") {
            throw new InvalidArgumentException(
                "Use checkout() to submit your cart."
            );
        }

        $sql = "UPDATE carts
                SET status = 'cancelled'
                WHERE user_id = ? AND status = 'pending'";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$user_id]);

        return $stmt->rowCount() > 0;
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

    public function getLatestOrders(int $limit = 10): array
{
    $limit = max(1, min($limit, 100));

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
            cd.placed_at
        FROM carts c
        INNER JOIN users u ON u.id = c.user_id
        INNER JOIN cart_details cd ON cd.cart_id = c.id
        WHERE c.status <> 'active'
        ORDER BY cd.placed_at DESC, c.id DESC
        LIMIT :limit
    ";

    $stmt = $this->db->prepare($sql);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
}