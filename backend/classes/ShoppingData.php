<?php
require_once __DIR__ . '/DiscountRules.php';
class ShoppingData {
    private PDO $db;
    private ?array $catalog = null;
    public function __construct(PDO $db) { $this->db = $db; }

    public function catalog(): array {
        if ($this->catalog !== null) return $this->catalog;
        $sql = "SELECT p.id,p.name,p.description,p.price,p.category_id,c.name AS category,
            d.percentage,ratings.average_rating,COALESCE(ratings.review_count,0) AS review_count,
            (SELECT i.image_url FROM product_images i WHERE i.product_id=p.id ORDER BY i.is_primary DESC,i.id LIMIT 1) AS image_url
            FROM products p JOIN categories c ON c.id=p.category_id
            LEFT JOIN discounts d ON d.id=p.discount_id AND d.type='normal' AND " . DiscountRules::ACTIVE_SQL . "
            LEFT JOIN (SELECT product_id,AVG(rating) AS average_rating,COUNT(*) AS review_count FROM reviews WHERE status='approved' GROUP BY product_id) ratings ON ratings.product_id=p.id
            WHERE p.is_active=1 ORDER BY p.id";
        $rows = $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        $variants = [];
        foreach ($this->db->query('SELECT v.product_id,v.size,v.color FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.is_active=1 AND v.quantity>0 ORDER BY v.id')->fetchAll(PDO::FETCH_ASSOC) as $variant) {
            $variants[(int)$variant['product_id']][] = ['size'=>(string)$variant['size'],'color'=>(string)$variant['color']];
        }
        $this->catalog = [];
        foreach ($rows as $row) {
            $this->catalog[] = [
                'id'=>(int)$row['id'],'name'=>$row['name'],'description'=>mb_substr(strip_tags($row['description'] ?? ''),0,500),
                'price'=>round((float)$row['price']*(1-max(0,min(100,(float)$row['percentage']))/100),2),
                'original_price'=>(float)$row['price'],'category_id'=>(int)$row['category_id'],'category'=>$row['category'],
                'average_rating'=>$row['average_rating']===null?null:(float)$row['average_rating'],'review_count'=>(int)$row['review_count'],
                'image_url'=>$row['image_url'] ?? '', 'variants'=>$variants[(int)$row['id']] ?? [], 'metadata'=>[],
            ];
        }
        return $this->catalog;
    }

}
