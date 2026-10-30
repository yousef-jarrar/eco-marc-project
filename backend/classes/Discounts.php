<?php

require_once __DIR__ . "/../config/db.php";

class Discounts
{
    private $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function addDiscount(
        string $name,
        string $type,
        float $percentage,
        ?string $startDate,
        ?string $endDate
    ) {
        if (!in_array($type, ['normal', 'coupon'], true)) {
            throw new InvalidArgumentException("Invalid discount type.");
        }

        if ($percentage < 0 || $percentage > 100) {
            throw new InvalidArgumentException(
                "Percentage must be between 0 and 100."
            );
        }

        $couponCode = $type === 'coupon'
            ? 'SAVE-' . strtoupper(bin2hex(random_bytes(4)))
            : null;

        $sql = "INSERT INTO discounts
                (name, type, coupon_code, percentage,
                 start_date, end_date, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)";

        $stmt = $this->db->prepare($sql);

        return $stmt->execute([
            $name,
            $type,
            $couponCode,
            $percentage,
            $startDate,
            $endDate,
            true
        ]);
    }

    public function getDiscounts(
        int $page = 1,
        ?string $name = null,
        ?string $startDate = null,
        ?string $endDate = null
    ): array {
        $page = max(1, $page);
        $limit = 10;
        $offset = ($page - 1) * $limit;

        $where = ["is_active = 1"];
        $params = [];

        if ($name !== null && trim($name) !== '') {
            $where[] = "name LIKE :name";
            $params['name'] = '%' . trim($name) . '%';
        }

        if ($startDate !== null) {
            $where[] = "start_date >= :start_date";
            $params['start_date'] = $startDate;
        }

        if ($endDate !== null) {
            $where[] = "end_date <= :end_date";
            $params['end_date'] = $endDate;
        }

        $whereSql = " WHERE " . implode(" AND ", $where);

        // Count active discounts matching the filters
        $countSql = "SELECT COUNT(*) FROM discounts" . $whereSql;
        $countStmt = $this->db->prepare($countSql);
        $countStmt->execute($params);

        $total = (int) $countStmt->fetchColumn();

        // Get 10 active discounts per page
        $sql = "SELECT *
                FROM discounts
                $whereSql
                ORDER BY id DESC
                LIMIT $limit OFFSET $offset";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return [
            'data' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => (int) ceil($total / $limit)
            ]
        ];
    }

    public function updateDiscount(
        int $id,
        ?float $amount = null,
        ?string $startDate = null,
        ?string $endDate = null
    ): bool {
        $updates = [];
        $params = [];

        if ($amount !== null) {
            if ($amount < 0 || $amount > 100) {
                throw new InvalidArgumentException(
                    "Percentage must be between 0 and 100."
                );
            }

            $updates[] = "percentage = ?";
            $params[] = $amount;
        }

        if ($startDate !== null) {
            $updates[] = "start_date = ?";
            $params[] = $startDate;
        }

        if ($endDate !== null) {
            $updates[] = "end_date = ?";
            $params[] = $endDate;
        }

        if (empty($updates)) {
            throw new InvalidArgumentException(
                "Provide an amount, start date, or end date to update."
            );
        }

        $params[] = $id;

        $sql = "UPDATE discounts
                SET " . implode(", ", $updates) . "
                WHERE id = ? AND is_active = 1";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->rowCount() > 0;
    }

    public function deleteDiscount(int $id): bool {
        $sql = "UPDATE discounts
                SET is_active = 0
                WHERE id = ? AND is_active = 1";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);

        return $stmt->rowCount() > 0;
    }

    public function getById(int $id) {
    $sql = "SELECT *
            FROM discounts
            WHERE id = ? AND is_active = 1";

    $stmt = $this->db->prepare($sql);
    $stmt->execute([$id]);

    $discount = $stmt->fetch(PDO::FETCH_ASSOC);

    return $discount ?: false;
}


}

