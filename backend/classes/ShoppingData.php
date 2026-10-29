<?php
class ShoppingData {
    private PDO $db;
    private ?array $catalog = null;
    public function __construct(PDO $db) { $this->db = $db; }

    public function catalog(): array {
        if ($this->catalog !== null) return $this->catalog;
        $sql = "SELECT p.id,p.name,p.description,p.price,p.category_id,c.name AS category,
            d.percentage,ratings.average_rating,COALESCE(ratings.review_count,0) AS review_count,
            (SELECT i.image_url FROM product_images i WHERE i.product_id=p.id ORDER BY i.is_primary DESC,i.id LIMIT 1) AS image_url,
            k.details,k.reviewed
            FROM products p JOIN categories c ON c.id=p.category_id
            LEFT JOIN discounts d ON d.id=p.discount_id
            LEFT JOIN (SELECT product_id,AVG(rating) AS average_rating,COUNT(*) AS review_count FROM reviews WHERE status='approved' GROUP BY product_id) ratings ON ratings.product_id=p.id
            LEFT JOIN product_ai_details k ON k.product_id=p.id WHERE p.is_active=1 ORDER BY p.id";
        $rows = $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        $variants = [];
        foreach ($this->db->query('SELECT v.product_id,v.size,v.color FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.is_active=1 AND v.quantity>0 ORDER BY v.id')->fetchAll(PDO::FETCH_ASSOC) as $variant) {
            $variants[(int)$variant['product_id']][] = ['size'=>(string)$variant['size'],'color'=>(string)$variant['color']];
        }
        $this->catalog = [];
        foreach ($rows as $row) {
            $metadata = $row['reviewed'] ? json_decode($row['details'] ?? '{}', true) : [];
            $this->catalog[] = [
                'id'=>(int)$row['id'],'name'=>$row['name'],'description'=>mb_substr(strip_tags($row['description'] ?? ''),0,500),
                'price'=>round((float)$row['price']*(1-max(0,min(100,(float)$row['percentage']))/100),2),
                'original_price'=>(float)$row['price'],'category_id'=>(int)$row['category_id'],'category'=>$row['category'],
                'average_rating'=>$row['average_rating']===null?null:(float)$row['average_rating'],'review_count'=>(int)$row['review_count'],
                'image_url'=>$row['image_url'] ?? '', 'variants'=>$variants[(int)$row['id']] ?? [], 'metadata'=>$metadata ?: [],
            ];
        }
        return $this->catalog;
    }

    public function preferences(int $userId): ?array {
        $query = $this->db->prepare('SELECT preferences FROM shopping_preferences WHERE user_id=?');
        $query->execute([$userId]);
        $json = $query->fetchColumn();
        return $json === false ? null : json_decode($json,true);
    }

    public function savePreferences(int $userId, array $data): array {
        if (($data['consent'] ?? false) !== true) throw new InvalidArgumentException('Confirm that you want to save and use these shopping preferences.');
        $values = [];
        foreach (['clothing_size','shoe_size','style'] as $field) {
            if (!is_string($data[$field] ?? '')) throw new InvalidArgumentException('Invalid preference value.');
            $values[$field] = trim($data[$field] ?? '');
        }
        if (!in_array($values['clothing_size'],['','XS','S','M','L','XL','XXL'],true)) throw new InvalidArgumentException('Choose a valid clothing size.');
        if ($values['shoe_size'] !== '' && (!ctype_digit($values['shoe_size']) || (int)$values['shoe_size']<20 || (int)$values['shoe_size']>55)) throw new InvalidArgumentException('Use a shoe size from 20 to 55.');
        if (!in_array($values['style'],['','casual','formal','sporty'],true)) throw new InvalidArgumentException('Choose a valid style.');
        $budget = $data['budget'] ?? null;
        if ($budget !== null && ((!is_int($budget) && !is_float($budget)) || !is_finite((float)$budget) || $budget<0 || $budget>10000)) throw new InvalidArgumentException('Use a budget from 0 to 10000 JOD, or leave it blank.');
        $values['budget'] = $budget === null ? null : round($budget,2);
        $query = $this->db->prepare('INSERT INTO shopping_preferences (user_id,preferences) VALUES (?,?) ON DUPLICATE KEY UPDATE preferences=VALUES(preferences),consent_at=CURRENT_TIMESTAMP');
        $query->execute([$userId,json_encode($values,JSON_THROW_ON_ERROR)]);
        return $values;
    }

    public function deletePreferences(int $userId): void {
        $query=$this->db->prepare('DELETE FROM shopping_preferences WHERE user_id=?');$query->execute([$userId]);
    }

    public function knowledge(): array {
        $row=$this->db->query('SELECT content,reviewed FROM store_ai_knowledge WHERE id=1')->fetch(PDO::FETCH_ASSOC);
        return $row ? ['content'=>json_decode($row['content'],true),'reviewed'=>(bool)$row['reviewed']] : ['content'=>[],'reviewed'=>false];
    }

    public function saveKnowledge(array $data, ?int $productId): void {
        if (!is_bool($data['reviewed'] ?? null)) throw new InvalidArgumentException('Confirm whether the information has been reviewed.');
        $fields = $productId === null ? ['returns','delivery_times','delivery_areas','payment_methods','contact'] : ['gender','material','care','brand','size_guide','style'];
        $content=[];
        foreach($fields as $field){
            $value=$data[$field]??'';
            if(!is_string($value)||mb_strlen($value)>2000)throw new InvalidArgumentException('Use text up to 2000 characters per field.');
            $content[$field]=trim($value);
        }
        if($productId!==null){
            if(!in_array($content['gender'],['','unisex','men','women'],true)||!in_array($content['style'],['','casual','formal','sporty'],true))throw new InvalidArgumentException('Choose valid product labels.');
            $check=$this->db->prepare('SELECT id FROM products WHERE id=? AND is_active=1');$check->execute([$productId]);
            if(!$check->fetchColumn())throw new InvalidArgumentException('Choose an active product.');
            $query=$this->db->prepare('INSERT INTO product_ai_details(product_id,details,reviewed) VALUES (?,?,?) ON DUPLICATE KEY UPDATE details=VALUES(details),reviewed=VALUES(reviewed)');
        }else $query=$this->db->prepare('INSERT INTO store_ai_knowledge(id,content,reviewed) VALUES (?,?,?) ON DUPLICATE KEY UPDATE content=VALUES(content),reviewed=VALUES(reviewed)');
        $query->execute([$productId??1,json_encode($content,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),(int)$data['reviewed']]);
    }

    public function productDetails(int $id): array {
        $query=$this->db->prepare('SELECT details,reviewed FROM product_ai_details WHERE product_id=?');$query->execute([$id]);$row=$query->fetch(PDO::FETCH_ASSOC);
        return $row?['content'=>json_decode($row['details'],true),'reviewed'=>(bool)$row['reviewed']]:['content'=>[],'reviewed'=>false];
    }
}
