<?php
require_once __DIR__ . '/Products.php';

class Category {
    private PDO $conn;
    private array $removedImages = [];
    public function removedImageIds(): array { return $this->removedImages; }
    public function __construct(PDO $conn) { $this->conn = $conn; }

    public function getAllCategories() {
        return $this->conn->query('SELECT * FROM categories')->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getCategoriesById($id) {
        $statement = $this->conn->prepare('SELECT * FROM categories WHERE id = ?');
        $statement->execute([$id]);
        return $statement->fetch(PDO::FETCH_ASSOC);
    }

    public function allcategoriesProducts($id) {
        $statement = $this->conn->prepare('SELECT * FROM products WHERE category_id = ?');
        $statement->execute([$id]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function creatCategories($name, $imageUrl, $publicId = null) {
        $statement = $this->conn->prepare('INSERT INTO categories (name, image_url, public_id) VALUES (?, ?, ?)');
        return $statement->execute([$name, $imageUrl, $publicId]);
    }

    private function lockCategory($id): array {
        $sql = 'SELECT * FROM categories WHERE id = ?';
        if ($this->conn->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') $sql .= ' FOR UPDATE';
        $statement = $this->conn->prepare($sql);
        $statement->execute([$id]);
        $category = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$category) throw new RuntimeException('Category not found.', 404);
        return $category;
    }

    public function updateCategories($id, $name, $imageUrl, $publicId = null) {
        $this->removedImages = [];
        $removedImages = [];
        $this->conn->beginTransaction();
        try {
            $old = $this->lockCategory($id);
            $statement = $this->conn->prepare('UPDATE categories SET name = ?, image_url = ?, public_id = ? WHERE id = ?');
            $statement->execute([$name, $imageUrl, $publicId, $id]);
            if (!empty($old['public_id']) && $old['public_id'] !== $publicId) {
                $removedImages[] = $old['public_id'];
            }
            $this->conn->commit();
            $this->removedImages = $removedImages;
            return true;
        } catch (Throwable $error) {
            $this->conn->rollBack();
            throw $error;
        }
    }

    public function deleteCategories($id) {
        $this->removedImages = [];
        $removedImages = [];
        $this->conn->beginTransaction();
        try {
            $old = $this->lockCategory($id);
            if ($this->allcategoriesProducts($id)) throw new DomainException('Move the products to another category before deleting this category.');
            $statement = $this->conn->prepare('DELETE FROM categories WHERE id = ?');
            $statement->execute([$id]);
            if (!empty($old['public_id'])) $removedImages[] = $old['public_id'];
            $this->conn->commit();
            $this->removedImages = $removedImages;
            return true;
        } catch (Throwable $error) {
            $this->conn->rollBack();
            throw $error;
        }
    }
}
