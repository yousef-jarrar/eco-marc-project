
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
///////////////////////////////////////////////////////////////////////
     public function getProducts()
    {
        $sql = "SELECT
                    p.*,
                    c.name AS category_name,
                    d.name AS discount_name,
                    d.percentage AS discount_percentage,
                    pi.image_url
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN discounts d ON p.discount_id = d.id
                LEFT JOIN product_images pi
                    ON p.id = pi.product_id AND pi.is_primary = 1  AND p.is_active = 1";

        return $this->connect->query($sql)->fetchAll();
    }
    ////////////////////////////////////////////////////////
    public function getProduct($id)
    {
        $sql = "SELECT
                    p.*,
                    c.name AS category_name,
                    d.name AS discount_name,
                    d.percentage AS discount_percentage,
                    pi.image_url
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN discounts d ON p.discount_id = d.id
                LEFT JOIN product_images pi
                    ON p.id = pi.product_id AND pi.is_primary = 1
                WHERE p.id = ?
                AND p.is_active = 1";

        $stmt = $this->connect->prepare($sql);
        $stmt->execute([$id]);

        return $stmt->fetch();
    }

    ///////////////////////////////////////////////////
    public function categoryExists($id)
    {
        $stmt = $this->connect->prepare(
            "SELECT id FROM categories WHERE id = ?"
        );

        $stmt->execute([$id]);

        return $stmt->fetch() !== false;
    }

/////////////////////////////////////////////////////////

public function getProductsByCategory($categoryId)
{
    $sql = "SELECT
                p.*,
                c.name AS category_name,
                d.name AS discount_name,
                d.percentage AS discount_percentage,
                pi.image_url
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN discounts d ON p.discount_id = d.id
            LEFT JOIN product_images pi
                ON p.id = pi.product_id AND pi.is_primary = 1
            WHERE p.category_id = ?
            AND p.is_active = 1";

    $stmt = $this->connect->prepare($sql);
    $stmt->execute([$categoryId]);

    return $stmt->fetchAll();
}


//////////////////////////////////////////
    public function discountExists($id)
    {
        $stmt = $this->connect->prepare(
            "SELECT id FROM discounts WHERE id = ?"
        );

        $stmt->execute([$id]);

        return $stmt->fetch() !== false;
    }

////////////////////////////////////////////////////////
    public function productExists($id)
    {
        $stmt = $this->connect->prepare(
            "SELECT id FROM products WHERE id = ?"
        );

        $stmt->execute([$id]);

        return $stmt->fetch() !== false;
    }

  /////////////////////////////////////////////////
    public function createProduct($data, $imagePath)
    {
        $sql = "INSERT INTO products
                (name, description, price, category_id,
                 discount_id, is_active)
                VALUES (?, ?, ?, ?, ?, ?)";

        $stmt = $this->connect->prepare($sql);

        $stmt->execute([
            $data["name"],
            $data["description"] ?? null,
            $data["price"],
            $data["category_id"],
            $data["discount_id"] ?? null,
            $data["is_active"] ?? 1
        ]);

        $productId = $this->connect->lastInsertId();

        $sql = "INSERT INTO product_images
                (product_id, image_url, is_primary)
                VALUES (?, ?, 1)";

        $stmt = $this->connect->prepare($sql);

        $stmt->execute([$productId, $imagePath]);

        return $productId;
    }
    ////////////////////////////////////////////
     public function updateProduct($id, $data)
    {
        $sql = "UPDATE products
                SET name = ?,
                    description = ?,
                    price = ?,
                    category_id = ?,
                    discount_id = ?,
                    is_active = ?
                WHERE id = ?";

        $stmt = $this->connect->prepare($sql);

        return $stmt->execute([
            $data["name"],
            $data["description"] ?? null,
            $data["price"],
            $data["category_id"],
            $data["discount_id"] ?? null,
            $data["is_active"] ?? 1,
            $id
        ]);
    }
///////////////////////////////////////
public function deleteProduct($id)
{
    $sql = "UPDATE products
            SET is_active = 0
            WHERE id = ?";

    $stmt = $this->connect->prepare($sql);

    return $stmt->execute([$id]);
}

   
}
?>
