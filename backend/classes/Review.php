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
}
?>