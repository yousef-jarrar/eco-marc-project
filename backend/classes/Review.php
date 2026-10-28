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

    

}
?>