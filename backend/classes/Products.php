<?php

require_once __DIR__ . "/../config/db.php";

class Product
{
    private $connect;

    public function __construct()
    {
        $db = new Database();
        $this->connect = $db->connect();
    }

    // Get all active products
    public function getProducts()
    {
        $sql = "SELECT
                    p.*,
                    c.name AS category_name,
                    d.name AS discount_name,
                    d.percentage AS discount_percentage
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN discounts d ON p.discount_id = d.id
                WHERE p.is_active = 1
                ORDER BY p.id DESC";

        $products = $this->connect
            ->query($sql)
            ->fetchAll(PDO::FETCH_ASSOC);

        foreach ($products as &$product) {
            $product = $this->addProductDetails($product);
        }

        unset($product);

        return $products;
    }

    // Get one product
    public function getProduct($id)
    {
        $sql = "SELECT
                    p.*,
                    c.name AS category_name,
                    d.name AS discount_name,
                    d.percentage AS discount_percentage
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN discounts d ON p.discount_id = d.id
                WHERE p.id = ?";

        $stmt = $this->connect->prepare($sql);
        $stmt->execute([$id]);

        $product = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$product) {
            return false;
        }

        return $this->addProductDetails($product);
    }

    // Add images and variants without changing product quantity
    private function addProductDetails($product)
    {
        $sql = "SELECT id, image_url, is_primary
                FROM product_images
                WHERE product_id = ?
                ORDER BY is_primary DESC, id ASC";

        $stmt = $this->connect->prepare($sql);
        $stmt->execute([$product["id"]]);

        $product["images"] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $product["image_url"] = "";

        if (!empty($product["images"])) {
            $product["image_url"] = $product["images"][0]["image_url"];
        }

        $sql = "SELECT id, size, color, quantity
                FROM product_variants
                WHERE product_id = ?
                ORDER BY id ASC";

        $stmt = $this->connect->prepare($sql);
        $stmt->execute([$product["id"]]);

        $product["variants"] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Keep quantity from the products table.
        // Do not calculate it from the variants.

        return $product;
    }

    // Check category
    public function categoryExists($categoryId)
    {
        $stmt = $this->connect->prepare(
            "SELECT id FROM categories WHERE id = ?"
        );

        $stmt->execute([$categoryId]);

        return $stmt->fetch(PDO::FETCH_ASSOC) ? true : false;
    }

    // Check discount
    public function discountExists($discountId)
    {
        if ($discountId === null || $discountId === "") {
            return true;
        }

        $stmt = $this->connect->prepare(
            "SELECT id FROM discounts WHERE id = ?"
        );

        $stmt->execute([$discountId]);

        return $stmt->fetch(PDO::FETCH_ASSOC) ? true : false;
    }

    // Check product
    public function productExists($id)
    {
        $stmt = $this->connect->prepare(
            "SELECT id FROM products WHERE id = ?"
        );

        $stmt->execute([$id]);

        return $stmt->fetch(PDO::FETCH_ASSOC) ? true : false;
    }

    // Create product
    public function createProduct($data, $imagePaths, $variants)
    {
        $sql = "INSERT INTO products
                    (name, description, price, quantity,
                     category_id, discount_id, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)";

        $stmt = $this->connect->prepare($sql);

        $stmt->execute([
            $data["name"],
            $data["description"],
            $data["price"],
            $data["quantity"],
            $data["category_id"],
            $data["discount_id"],
            $data["is_active"]
        ]);

        $productId = $this->connect->lastInsertId();

        // Save variants
        $sql = "INSERT INTO product_variants
                    (product_id, size, color, quantity)
                VALUES (?, ?, ?, ?)";

        $stmt = $this->connect->prepare($sql);

        foreach ($variants as $variant) {
            $stmt->execute([
                $productId,
                $variant["size"],
                $variant["color"],
                $variant["quantity"]
            ]);
        }

        // Save multiple images
        $sql = "INSERT INTO product_images
                    (product_id, image_url, is_primary)
                VALUES (?, ?, ?)";

        $stmt = $this->connect->prepare($sql);

        foreach ($imagePaths as $index => $imagePath) {
            $stmt->execute([
                $productId,
                $imagePath,
                $index === 0 ? 1 : 0
            ]);
        }

        return $productId;
    }

    // Update product
    public function updateProduct($id, $data, $imagePaths, $variants)
    {
        $sql = "UPDATE products
                SET name = ?,
                    description = ?,
                    price = ?,
                    quantity = ?,
                    category_id = ?,
                    discount_id = ?,
                    is_active = ?
                WHERE id = ?";

        $stmt = $this->connect->prepare($sql);

        $stmt->execute([
            $data["name"],
            $data["description"],
            $data["price"],
            $data["quantity"],
            $data["category_id"],
            $data["discount_id"],
            $data["is_active"],
            $id
        ]);

        // Replace existing variants
        $stmt = $this->connect->prepare(
            "DELETE FROM product_variants WHERE product_id = ?"
        );

        $stmt->execute([$id]);

        $sql = "INSERT INTO product_variants
                    (product_id, size, color, quantity)
                VALUES (?, ?, ?, ?)";

        $stmt = $this->connect->prepare($sql);

        foreach ($variants as $variant) {
            $stmt->execute([
                $id,
                $variant["size"],
                $variant["color"],
                $variant["quantity"]
            ]);
        }

        // Add new images without removing existing images
        if (!empty($imagePaths)) {
            $stmt = $this->connect->prepare(
                "SELECT COUNT(*) FROM product_images WHERE product_id = ?"
            );

            $stmt->execute([$id]);
            $hasImages = (int) $stmt->fetchColumn() > 0;

            $sql = "INSERT INTO product_images
                        (product_id, image_url, is_primary)
                    VALUES (?, ?, ?)";

            $stmt = $this->connect->prepare($sql);

            foreach ($imagePaths as $index => $imagePath) {
                $isPrimary = (!$hasImages && $index === 0) ? 1 : 0;

                $stmt->execute([
                    $id,
                    $imagePath,
                    $isPrimary
                ]);
            }
        }

        return true;
    }

    // Delete product (soft delete)
    public function deleteProduct($id)
    {
        $stmt = $this->connect->prepare(
            "UPDATE products SET is_active = 0 WHERE id = ?"
        );

        return $stmt->execute([$id]);
    }

    // Get products by category
    public function getProductsByCategory($categoryId)
    {
        $stmt = $this->connect->prepare(
            "SELECT id
             FROM products
             WHERE category_id = ? AND is_active = 1"
        );

        $stmt->execute([$categoryId]);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $products = [];

        foreach ($rows as $row) {
            $product = $this->getProduct($row["id"]);

            if ($product) {
                $products[] = $product;
            }
        }

        return $products;
    }
}
