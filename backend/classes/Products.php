<?php


class Product
{
    private $connect;
    private array $removedImages = [];

    public function __construct(?PDO $connection = null)
    {
        if ($connection !== null) {
            $this->connect = $connection;
        } else {
            require_once __DIR__ . "/../config/db.php";
            $db = new Database();
            $this->connect = $db->connect();
        }
    }

     
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

     
    private function addProductDetails($product)
    {
        $sql = "SELECT id, image_url, public_id, is_primary
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

         
         

        return $product;
    }

     
    public function categoryExists($categoryId)
    {
        $stmt = $this->connect->prepare(
            "SELECT id FROM categories WHERE id = ?"
        );

        $stmt->execute([$categoryId]);

        return $stmt->fetch(PDO::FETCH_ASSOC) ? true : false;
    }

     
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

     
    public function productExists($id)
    {
        $stmt = $this->connect->prepare(
            "SELECT id FROM products WHERE id = ?"
        );

        $stmt->execute([$id]);

        return $stmt->fetch(PDO::FETCH_ASSOC) ? true : false;
    }

     
    public function createProduct($data, $imagePaths, $variants)
    {
        $this->removedImages = [];
        $this->connect->beginTransaction();
        try {
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

         
        $sql = "INSERT INTO product_images
                    (product_id, image_url, public_id, is_primary)
                VALUES (?, ?, ?, ?)";

        $stmt = $this->connect->prepare($sql);

        foreach ($imagePaths as $index => $imagePath) {
            $stmt->execute([
                $productId,
                is_array($imagePath) ? $imagePath['image_url'] : $imagePath,
                is_array($imagePath) ? $imagePath['public_id'] : null,
                $index === 0 ? 1 : 0
            ]);
        }

        $this->connect->commit();
        return $productId;
        } catch (Throwable $error) {
            if ($this->connect->inTransaction()) $this->connect->rollBack();
            throw $error;
        }
    }

     
     
    public function updateProduct($id, $data, $imagePaths, $variants, ?array $keepImages = null)
    {
        $this->removedImages = [];
        $removedImages = [];
        $this->connect->beginTransaction();
        try {
            $statement = $this->connect->prepare("UPDATE products SET name = ?, description = ?,
                price = ?, quantity = ?, category_id = ?, discount_id = ?, is_active = ? WHERE id = ?");
            $statement->execute([
                $data['name'], $data['description'], $data['price'], $data['quantity'],
                $data['category_id'], $data['discount_id'], $data['is_active'], $id
            ]);

            $statement = $this->connect->prepare('SELECT id, size, color FROM product_variants WHERE product_id = ?');
            $statement->execute([$id]);
            $oldVariants = $statement->fetchAll(PDO::FETCH_ASSOC);
            $keptIds = [];

            foreach ($variants as $variant) {
                $matchingId = null;
                foreach ($oldVariants as $oldVariant) {
                    if ($oldVariant['size'] === $variant['size'] &&
                        strtolower($oldVariant['color']) === strtolower($variant['color'])) {
                        $matchingId = (int) $oldVariant['id'];
                        break;
                    }
                }

                if ($matchingId !== null) {
                    $statement = $this->connect->prepare('UPDATE product_variants SET quantity = ?, color = ? WHERE id = ? AND product_id = ?');
                    $statement->execute([$variant['quantity'], $variant['color'], $matchingId, $id]);
                    $keptIds[] = $matchingId;
                } else {
                    $statement = $this->connect->prepare('INSERT INTO product_variants (product_id, size, color, quantity) VALUES (?, ?, ?, ?)');
                    $statement->execute([$id, $variant['size'], $variant['color'], $variant['quantity']]);
                }
            }

            foreach ($oldVariants as $oldVariant) {
                if (in_array((int) $oldVariant['id'], $keptIds, true)) continue;

                $statement = $this->connect->prepare('SELECT COUNT(*) FROM cart_items WHERE variant_id = ?');
                $statement->execute([$oldVariant['id']]);
                if ((int) $statement->fetchColumn() > 0) {
                    throw new DomainException('This size/color is used by an existing cart or order. Keep it and set its quantity to zero instead.');
                }

                $statement = $this->connect->prepare('DELETE FROM product_variants WHERE id = ? AND product_id = ?');
                $statement->execute([$oldVariant['id'], $id]);
            }

            $statement = $this->connect->prepare('SELECT id, image_url, public_id FROM product_images WHERE product_id = ?');
            $statement->execute([$id]);
            $oldImages = $statement->fetchAll(PDO::FETCH_ASSOC);

            if ($keepImages !== null) {
                $allowedImages = array_column($oldImages, 'image_url');
                foreach ($keepImages as $image) {
                    if (!is_string($image) || !in_array($image, $allowedImages, true)) {
                        throw new InvalidArgumentException('One of the existing images does not belong to this product.');
                    }
                }
                foreach ($oldImages as $image) {
                    if (!in_array($image['image_url'], $keepImages, true)) {
                        if (!empty($image['public_id'])) $removedImages[] = $image['public_id'];
                        $statement = $this->connect->prepare('DELETE FROM product_images WHERE id = ? AND product_id = ?');
                        $statement->execute([$image['id'], $id]);
                    }
                }
            }

            foreach ($imagePaths as $imagePath) {
                $statement = $this->connect->prepare('INSERT INTO product_images (product_id, image_url, public_id, is_primary) VALUES (?, ?, ?, 0)');
                $statement->execute([$id, is_array($imagePath) ? $imagePath['image_url'] : $imagePath,
                    is_array($imagePath) ? $imagePath['public_id'] : null]);
            }

            $statement = $this->connect->prepare('SELECT id FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, id ASC LIMIT 1');
            $statement->execute([$id]);
            $primaryImageId = $statement->fetchColumn();
            if ($primaryImageId !== false) {
                $statement = $this->connect->prepare('UPDATE product_images SET is_primary = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE product_id = ?');
                $statement->execute([$primaryImageId, $id]);
            }

            $this->connect->commit();
            $this->removedImages = $removedImages;
            return true;
        } catch (Throwable $error) {
            if ($this->connect->inTransaction()) $this->connect->rollBack();
            throw $error;
        }
    }


    public function removedImageIds(): array { return $this->removedImages; }

    public function imageUsesPublicId(string $publicId): bool {
        $statement = $this->connect->prepare('SELECT (SELECT COUNT(*) FROM product_images WHERE public_id = ?) + (SELECT COUNT(*) FROM categories WHERE public_id = ?)');
        $statement->execute([$publicId, $publicId]);
        return (int)$statement->fetchColumn() > 0;
    }

     
    public function deleteProduct($id)
    {
        $stmt = $this->connect->prepare(
            "UPDATE products SET is_active = 0 WHERE id = ?"
        );

        return $stmt->execute([$id]);
    }

     
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
