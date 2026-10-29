
<?php

class Customer
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function getAll(string $search = ""): array
    {
        $sql = "
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.address,
                u.created_at,
                COUNT(DISTINCT CASE
                    WHEN c.status IN (
                        'pending',
                        'confirmed',
                        'processing',
                        'shipped',
                        'delivered'
                    )
                    THEN c.id
                END) AS orders,
                COALESCE(SUM(
                    CASE
                        WHEN c.status = 'delivered' THEN cd.total
                        ELSE 0
                    END
                ), 0) AS total_spent
            FROM users u
            LEFT JOIN carts c ON c.user_id = u.id
            LEFT JOIN cart_details cd ON cd.cart_id = c.id
            WHERE u.role = 'customer'
        ";

        $params = [];

        if ($search !== "") {
            $sql .= "
                AND (
                    u.first_name LIKE :search1
                    OR u.last_name LIKE :search2
                    OR u.email LIKE :search3
                )
            ";

            $term = "%" . $search . "%";
            $params = [
                "search1" => $term,
                "search2" => $term,
                "search3" => $term
            ];
        }

        $sql .= "
            GROUP BY
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.address,
                u.created_at
            ORDER BY u.id DESC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

     
    public function getById(int $id): array|false
    {
        $sql = "
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.address,
                u.role,
                u.created_at,
                COUNT(DISTINCT CASE
                    WHEN c.status IN (
                        'pending',
                        'confirmed',
                        'processing',
                        'shipped',
                        'delivered'
                    )
                    THEN c.id
                END) AS orders,
                COALESCE(SUM(
                    CASE
                        WHEN c.status = 'delivered' THEN cd.total
                        ELSE 0
                    END
                ), 0) AS total_spent
            FROM users u
            LEFT JOIN carts c ON c.user_id = u.id
            LEFT JOIN cart_details cd ON cd.cart_id = c.id
            WHERE u.id = :id AND u.role = 'customer'
            GROUP BY
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.address,
                u.role,
                u.created_at
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(["id" => $id]);

        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

     
    public function create(array $data): int
    {
        $sql = "INSERT INTO users
                    (first_name, last_name, email, phone, address, role)
                VALUES
                    (:first_name, :last_name, :email, :phone, :address, 'customer')";

        $stmt = $this->db->prepare($sql);

        $stmt->execute([
            "first_name" => $data["first_name"],
            "last_name"  => $data["last_name"],
            "email"      => $data["email"],
            "phone"      => $data["phone"] === "" ? null : $data["phone"],
            "address"    => $data["address"] === "" ? null : $data["address"]
        ]);

        return (int) $this->db->lastInsertId();
    }

     
    public function update(int $id, array $data): void
    {
        $sql = "UPDATE users
                SET first_name = :first_name,
                    last_name = :last_name,
                    email = :email,
                    phone = :phone,
                    address = :address
                WHERE id = :id AND role = 'customer'";

        $stmt = $this->db->prepare($sql);

        $stmt->execute([
            "id"         => $id,
            "first_name" => $data["first_name"],
            "last_name"  => $data["last_name"],
            "email"      => $data["email"],
            "phone"      => $data["phone"] === "" ? null : $data["phone"],
            "address"    => $data["address"] === "" ? null : $data["address"]
        ]);
    }

     
    public function delete(int $id): bool
    {
        $sql = "DELETE FROM users
                WHERE id = :id AND role = 'customer'";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(["id" => $id]);

        return $stmt->rowCount() > 0;
    }
}
