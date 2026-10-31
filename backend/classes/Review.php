<?php 

class Review {
    private PDO $conn;
    public function __construct(PDO $conn) {
        $this->conn = $conn;
    }

    public function getAllReviews() {
        $sql =  "SELECT
                    r.id,
                    r.rating,
                    r.comment,
                    r.status,
                    r.created_at,
                    u.first_name,
                    u.last_name,
                    p.name AS product_name
                FROM reviews r
                JOIN users u ON r.user_id = u.id
                JOIN products p ON r.product_id = p.id
                ORDER BY r.created_at DESC";
        $stmt = $this->conn->query($sql);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getReviewById(int $id) : array|false {
        $sql = "SELECT
                r.id,
                r.rating,
                r.comment,
                r.status,
                r.created_at,
                u.first_name,
                u.last_name,
                p.name AS product_name
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            JOIN products p ON r.product_id = p.id
            WHERE r.id = ?";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([$id]);

        return $stmt->fetch(PDO::FETCH_ASSOC);

    }

    public function updateStatus(int $id, string $status): bool {
        $sql = "UPDATE reviews SET status = ? WHERE id = ?";
        $stmt = $this->conn->prepare($sql);

        return $stmt->execute([$status, $id]);
    }

    public function deleteReview(int $id): bool {
        $sql = "DELETE FROM reviews WHERE id = ?";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([$id]);

        return $stmt->rowCount() > 0;
    }

    public function getStatistics(): array {
        $sql = "SELECT
                    COUNT(*) AS total_reviews,
                    COALESCE(ROUND(AVG(rating), 1), 0) AS average_rating,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_reviews,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_reviews,
                    SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END) AS hidden_reviews
                FROM reviews";

        $stmt = $this->conn->query($sql);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    

    public function productReviews(int $productId, int $page = 1, ?int $rating = null, string $sort = 'newest', ?int $userId = null): array {
        $summaryStatement = $this->conn->prepare("SELECT rating, COUNT(*) AS total FROM reviews WHERE product_id = ? AND status = 'approved' GROUP BY rating");
        $summaryStatement->execute([$productId]);
        $distribution = array_fill(1, 5, 0);
        $total = 0;
        $score = 0;
        foreach ($summaryStatement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $stars = (int)$row['rating'];
            if ($stars < 1 || $stars > 5) continue;
            $count = (int)$row['total'];
            $distribution[$stars] = $count;
            $total += $count;
            $score += $stars * $count;
        }
        $filteredTotal = $rating === null ? $total : $distribution[$rating];
        $pages = max(1, (int)ceil($filteredTotal / 10));
        $page = max(1, min($page, $pages));
        $order = ['newest' => 'r.created_at DESC, r.id DESC', 'highest' => 'r.rating DESC, r.created_at DESC, r.id DESC', 'lowest' => 'r.rating ASC, r.created_at DESC, r.id DESC'][$sort] ?? 'r.created_at DESC, r.id DESC';
        $sql = "SELECT r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = :product AND r.status = 'approved'" . ($rating === null ? '' : ' AND r.rating = :rating') . " ORDER BY $order LIMIT 10 OFFSET :offset";
        $statement = $this->conn->prepare($sql);
        $statement->bindValue(':product', $productId, PDO::PARAM_INT);
        if ($rating !== null) $statement->bindValue(':rating', $rating, PDO::PARAM_INT);
        $statement->bindValue(':offset', ($page - 1) * 10, PDO::PARAM_INT);
        $statement->execute();
        $items = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $last = trim((string)$row['last_name']);
            $row['display_name'] = trim((string)$row['first_name']) . ($last !== '' ? ' ' . mb_substr($last, 0, 1) . '.' : '');
            unset($row['first_name'], $row['last_name']);
            $items[] = $row;
        }
        return ['items' => $items, 'summary' => ['total' => $total, 'average' => $total ? round($score / $total, 1) : null, 'distribution' => $distribution], 'pagination' => ['page' => $page, 'pages' => $pages, 'total' => $filteredTotal], 'own_review' => $userId === null ? null : $this->ownProductReview($productId, $userId)];
    }

    public function ownProductReview(int $productId, int $userId): ?array {
        $statement = $this->conn->prepare('SELECT id, rating, comment, status, created_at FROM reviews WHERE product_id = ? AND user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1');
        $statement->execute([$productId, $userId]);
        return $statement->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function saveProductReview(int $productId, int $userId, int $rating, string $comment): array {
        $comment = trim($comment);
        if ($rating < 1 || $rating > 5 || $comment === '' || mb_strlen($comment) > 2000) throw new InvalidArgumentException('Choose 1–5 stars and write a comment of 1–2,000 characters.');
        $this->conn->beginTransaction();
        try {
            $user = $this->conn->prepare('SELECT id FROM users WHERE id = ? FOR UPDATE');
            $user->execute([$userId]);
            if (!$user->fetchColumn()) throw new InvalidArgumentException('Please sign in again.');
            $product = $this->conn->prepare("SELECT p.id FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ? AND p.is_active = 1 AND c.status = 'active' FOR UPDATE");
            $product->execute([$productId]);
            if (!$product->fetchColumn()) throw new InvalidArgumentException('This product is not available for reviews.');
            $existing = $this->ownProductReview($productId, $userId);
            if ($existing) {
                $statement = $this->conn->prepare("UPDATE reviews SET rating = ?, comment = ?, status = 'pending' WHERE id = ? AND user_id = ?");
                $statement->execute([$rating, $comment, $existing['id'], $userId]);
            } else {
                $statement = $this->conn->prepare("INSERT INTO reviews (product_id, user_id, rating, comment, status) VALUES (?, ?, ?, ?, 'pending')");
                $statement->execute([$productId, $userId, $rating, $comment]);
            }
            $own = $this->ownProductReview($productId, $userId);
            $this->conn->commit();
            return $own;
        } catch (Throwable $error) {
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            throw $error;
        }
    }

}
?>