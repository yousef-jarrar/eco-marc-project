<?php

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/Products.php';

class Wishlist
{
    private PDO $db;
    private Product $products;

    public function __construct(?PDO $connection = null)
    {
        if ($connection === null) {
            $connection = (new Database())->connect();
        }

        $this->db = $connection;
        $this->products = new Product($connection);
    }

    public function getAll(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT p.id
             FROM wishlist w
             INNER JOIN products p ON p.id = w.product_id
             WHERE w.user_id = ? AND p.is_active = 1
             ORDER BY p.id DESC'
        );
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $items = [];
        foreach ($rows as $productId) {
            $product = $this->products->getProduct((int) $productId);
            if ($product && (int) ($product['is_active'] ?? 0) === 1) {
                $items[] = $product;
            }
        }

        return $items;
    }

    public function add(int $userId, int $productId): bool
    {
        $check = $this->db->prepare(
            'SELECT id FROM products WHERE id = ? AND is_active = 1 LIMIT 1'
        );
        $check->execute([$productId]);

        if (!$check->fetchColumn()) {
            throw new InvalidArgumentException('Product not found or unavailable.');
        }

        // The wishlist primary key (user_id, product_id) prevents duplicates.
        $stmt = $this->db->prepare(
            'INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)'
        );
        $stmt->execute([$userId, $productId]);

        return $stmt->rowCount() > 0;
    }

    public function remove(int $userId, int $productId): bool
    {
        $stmt = $this->db->prepare(
            'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?'
        );
        $stmt->execute([$userId, $productId]);

        return $stmt->rowCount() > 0;
    }

    public function contains(int $userId, int $productId): bool
    {
        $stmt = $this->db->prepare(
            'SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ? LIMIT 1'
        );
        $stmt->execute([$userId, $productId]);

        return (bool) $stmt->fetchColumn();
    }
}
