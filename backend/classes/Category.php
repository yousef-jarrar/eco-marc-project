<?php

require_once __DIR__ . '/Products.php';

class Category
{
    private PDO $conn;
    private array $removedImages = [];

    public function __construct(PDO $conn)
    {
        $this->conn = $conn;
    }

    public function removedImageIds(): array
    {
        return $this->removedImages;
    }

    public function getAllCategories(bool $includeInactive = true): array
    {
        return $this->conn->query("SELECT * FROM categories" . ($includeInactive ? "" : " WHERE status = 'active'") . " ORDER BY id DESC")->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getCategoriesById(int $id): array|false
    {
        $statement = $this->conn->prepare('SELECT * FROM categories WHERE id = ?');
        $statement->execute([$id]);
        return $statement->fetch(PDO::FETCH_ASSOC);
    }

    public function allcategoriesProducts(int $id): array
    {
        $statement = $this->conn->prepare('SELECT * FROM products WHERE category_id = ?');
        $statement->execute([$id]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function creatCategories(string $name, ?string $imageUrl, ?string $publicId = null, string $status = 'active'): bool
    {
        $statement = $this->conn->prepare(
            'INSERT INTO categories (name, image_url, public_id, status) VALUES (?, ?, ?, ?)'
        );
        return $statement->execute([$name, $imageUrl, $publicId, $status]);
    }

    private function lockCategory(int $id): array
    {
        $sql = 'SELECT * FROM categories WHERE id = ?';
        if ($this->conn->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
            $sql .= ' FOR UPDATE';
        }
        $statement = $this->conn->prepare($sql);
        $statement->execute([$id]);
        $category = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$category) {
            throw new RuntimeException('Category not found.', 404);
        }
        return $category;
    }

    public function updateCategories(
        int $id,
        string $name,
        ?string $imageUrl,
        ?string $publicId = null,
        string $status = 'active'
    ): bool {
        $this->removedImages = [];
        $ownsTransaction = !$this->conn->inTransaction();
        if ($ownsTransaction) {
            $this->conn->beginTransaction();
        }

        try {
            $old = $this->lockCategory($id);
            $statement = $this->conn->prepare(
                'UPDATE categories SET name = ?, image_url = ?, public_id = ?, status = ? WHERE id = ?'
            );
            $statement->execute([$name, $imageUrl, $publicId, $status, $id]);
            if (!empty($old['public_id']) && $old['public_id'] !== $publicId) {
                $this->removedImages[] = $old['public_id'];
            }
            if ($ownsTransaction) {
                $this->conn->commit();
            }
            return true;
        } catch (Throwable $error) {
            if ($ownsTransaction && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            throw $error;
        }
    }
}
