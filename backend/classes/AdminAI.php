<?php

class AdminAI {
    private PDO $conn;

    public function __construct(PDO $conn) {
        $this->conn = $conn;
    }

    public function getTotalRevenue(): float {
        $sql = "SELECT
                    COALESCE(SUM(cd.total), 0) AS total_revenue
                FROM carts c
                JOIN cart_details cd ON cd.cart_id = c.id
                WHERE c.status IN (
                    'confirmed',
                    'processing',
                    'shipped',
                    'delivered'
                )";

        $stmt = $this->conn->query($sql);
        return (float) $stmt->fetchColumn();
    }
    public function getTopSellingProducts(int $limit = 5): array {
        $sql = "SELECT
                    p.id,
                    p.name,
                    SUM(ci.quantity) AS units_sold
                FROM cart_items ci
                JOIN carts c ON ci.cart_id = c.id
                JOIN product_variants pv ON ci.variant_id = pv.id
                JOIN products p ON pv.product_id = p.id
                WHERE c.status IN (
                    'confirmed', 'processing', 'shipped', 'delivered'
                )
                GROUP BY p.id, p.name
                ORDER BY units_sold DESC
                LIMIT ?";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    public function getLowStockProducts(int $threshold = 5): array {
        $sql = "SELECT
                    p.id AS product_id,
                    p.name,
                    pv.id AS variant_id,
                    pv.size,
                    pv.color,
                    pv.quantity
                FROM product_variants pv
                JOIN products p ON pv.product_id = p.id
                WHERE pv.quantity <= ?
                  AND p.is_active = 1
                ORDER BY pv.quantity ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([$threshold]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getOrdersByStatus(): array {
        $sql = "SELECT
                    status,
                    COUNT(*) AS total
                FROM carts
                WHERE status != 'active'
                GROUP BY status";

        $stmt = $this->conn->query($sql);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getBusinessContext(): array {
        return [
            "total_revenue_jod" => $this->getTotalRevenue(),
            "top_selling_products" => $this->getTopSellingProducts(),
            "low_stock_products" => $this->getLowStockProducts(),
            "orders_by_status" => $this->getOrdersByStatus(),
            "lowest_rated_products" => $this->getProductRatings(),
            "daily_revenue" => $this->getDailyRevenue()
        ];
    }

    public function getProductRatings(int $limit = 5): array {
        $sql = "SELECT
                    p.id,
                    p.name,
                    COUNT(r.id) AS total_reviews,
                    ROUND(AVG(r.rating), 2) AS average_rating
                FROM products p
                JOIN reviews r ON r.product_id = p.id
                WHERE r.status = 'approved'
                GROUP BY p.id, p.name
                ORDER BY average_rating ASC, total_reviews DESC
                LIMIT ?";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getDailyRevenue(int $days = 7): array {
        $days = max(1, min($days, 30));

        $sql = "SELECT
                    DATE(cd.placed_at) AS sale_date,
                    COUNT(*) AS total_orders,
                    COALESCE(SUM(cd.total), 0) AS revenue
                FROM cart_details cd
                JOIN carts c ON cd.cart_id = c.id
                WHERE c.status IN (
                    'confirmed',
                    'processing',
                    'shipped',
                    'delivered'
                )
                AND cd.placed_at >= CURDATE() - INTERVAL ? DAY
                GROUP BY DATE(cd.placed_at)
                ORDER BY sale_date ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindValue(1, $days - 1, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);

    }

    public function isBusinessQuestion(string $message): bool {
        $keywords = [
            'revenue', 'sales', 'orders', 'products',
            'stock', 'inventory', 'reviews', 'ratings',
            'customers', 'profit', 'selling',
            'مبيعات', 'إيرادات', 'طلبات', 'منتجات',
            'مخزون', 'تقييمات', 'عملاء', 'أرباح'
        ];
    
        $message = mb_strtolower($message);
    
        foreach ($keywords as $keyword) {
            if (mb_strpos($message, $keyword) !== false) {
                return true;
            }
        }
    
        return false;
    }


}