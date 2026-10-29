<?php

require_once __DIR__ . '/AdminAI.php';

class Overview
{
    private PDO $connection;
    private AdminAI $analytics;

    public function __construct(PDO $connection)
    {
        $this->connection = $connection;
        $this->analytics = new AdminAI($connection);
    }

    private function getRecentOrders(array $period, int $limit = 6): array
    {
        $statement = $this->connection->prepare(
            "SELECT c.id, c.status, c.created_at, cd.placed_at, cd.total,
                    u.first_name, u.last_name,
                    COALESCE(SUM(ci.quantity), 0) AS item_count
             FROM carts c
             JOIN cart_details cd ON cd.cart_id = c.id
             JOIN users u ON u.id = c.user_id
             LEFT JOIN cart_items ci ON ci.cart_id = c.id
             WHERE c.status <> 'active'
               AND cd.placed_at >= ? AND cd.placed_at < ?
             GROUP BY c.id, c.status, c.created_at, cd.placed_at, cd.total,
                      u.first_name, u.last_name
             ORDER BY cd.placed_at DESC, c.id DESC
             LIMIT ?"
        );
        $statement->bindValue(1, $period['from']);
        $statement->bindValue(2, $period['end_exclusive']);
        $statement->bindValue(3, max(1, min(20, $limit)), PDO::PARAM_INT);
        $statement->execute();
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getInventoryAttention(int $limit = 5): array
    {
        $statement = $this->connection->prepare(
            "SELECT p.id AS product_id, p.name,
                    COUNT(CASE WHEN pv.quantity <= 5 THEN 1 END) AS low_stock_variants,
                    MIN(pv.quantity) AS minimum_quantity
             FROM products p
             JOIN product_variants pv ON pv.product_id = p.id
             WHERE p.is_active = 1
             GROUP BY p.id, p.name
             HAVING MIN(pv.quantity) <= 5
             ORDER BY minimum_quantity ASC, p.id ASC
             LIMIT ?"
        );
        $statement->bindValue(1, max(1, min(20, $limit)), PDO::PARAM_INT);
        $statement->execute();
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    private function getInventoryAttentionCount(): int
    {
        return (int) $this->connection->query(
            "SELECT COUNT(DISTINCT p.id)
             FROM products p
             JOIN product_variants pv ON pv.product_id = p.id
             WHERE p.is_active = 1 AND pv.quantity <= 5"
        )->fetchColumn();
    }

    private function getRecentReviews(int $limit = 6): array
    {
        $statement = $this->connection->prepare(
            "SELECT r.id, r.rating, r.comment, r.status, r.created_at,
                    u.first_name, u.last_name, p.name AS product_name
             FROM reviews r
             JOIN users u ON u.id = r.user_id
             JOIN products p ON p.id = r.product_id
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT ?"
        );
        $statement->bindValue(1, max(1, min(20, $limit)), PDO::PARAM_INT);
        $statement->execute();
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getReport(?string $from = null, ?string $to = null): array
    {
        $period = AdminAI::getPeriod($from, $to);
        $this->connection->exec("SET time_zone = '+03:00'");

        $ownsTransaction = !$this->connection->inTransaction();
        if ($ownsTransaction) {
            $this->connection->beginTransaction();
        }

        try {
            $summary = $this->analytics->getSummary($period);
            $report = [
                'period' => $period,
                'summary' => $summary,
                'daily_revenue' => $this->analytics->getDailyRevenue($period),
                'orders_by_status' => $this->analytics->getOrdersByStatus($period),
                'revenue_by_category' => $this->analytics->getRevenueByCategory($period),
                'recent_orders' => $this->getRecentOrders($period),
                'top_selling_products' => $this->analytics->getTopSellingProducts($period, 5),
                'inventory_attention' => $this->getInventoryAttention(),
                'inventory_attention_count' => $this->getInventoryAttentionCount(),
                'recent_reviews' => $this->getRecentReviews(),
                'total_products' => (int) $this->connection
                    ->query('SELECT COUNT(*) FROM products WHERE is_active = 1')
                    ->fetchColumn(),
                'total_categories' => (int) $this->connection
                    ->query('SELECT COUNT(*) FROM categories')
                    ->fetchColumn(),
                'revenue_rule' => 'Confirmed, processing, shipped and delivered order totals, including delivery and after discounts.',
                'limitations' => [
                    'Category revenue uses current catalog prices because historical item-price snapshots are not stored.'
                ]
            ];

            if ($ownsTransaction) {
                $this->connection->commit();
            }
            return $report;
        } catch (Throwable $error) {
            if ($ownsTransaction && $this->connection->inTransaction()) {
                $this->connection->rollBack();
            }
            throw $error;
        }
    }
}