<?php
require_once __DIR__ . '/../config/db.php';

class Discounts
{
    private PDO $db;

    public function __construct(?PDO $connection = null)
    {
        $this->db = $connection ?? (new Database())->connect();
    }

    private function validate(array $discount): void
    {
        if (!is_string($discount['name'] ?? null) || trim($discount['name']) === '' || mb_strlen($discount['name']) > 100) {
            throw new InvalidArgumentException('Enter a discount name of 100 characters or less.');
        }
        if (!in_array($discount['type'] ?? '', ['normal', 'coupon'], true)) {
            throw new InvalidArgumentException('Choose a product discount or coupon.');
        }
        if (!is_numeric($discount['percentage'] ?? null) || !is_finite((float)$discount['percentage']) || $discount['percentage'] < 0 || $discount['percentage'] > 100) {
            throw new InvalidArgumentException('Percentage must be between 0 and 100.');
        }
        foreach (['start_date', 'end_date'] as $field) {
            $value = $discount[$field] ?? null;
            if ($value === null) continue;
            if (!is_string($value)) throw new InvalidArgumentException('Use a valid date or leave it empty.');
            $date = DateTime::createFromFormat('!Y-m-d H:i:s', $value);
            if (!$date || $date->format('Y-m-d H:i:s') !== $value) throw new InvalidArgumentException('Use a valid date and time.');
        }
        if (($discount['start_date'] ?? null) !== null && ($discount['end_date'] ?? null) !== null && $discount['start_date'] >= $discount['end_date']) {
            throw new InvalidArgumentException('End date must be after start date.');
        }
    }

    private function validateSchedule(array $discount, array $current = []): void
    {
        $serverNow = $this->db->query('SELECT NOW()')->fetchColumn();
        $now = substr($serverNow,0,16) . ':00';
        foreach (['start_date','end_date'] as $field) {
            $value = $discount[$field] ?? null;
            if ($value === null || $value === ($current[$field] ?? null)) continue;
            if ($field === 'start_date' && $value < $now) throw new InvalidArgumentException('Start date cannot be in the past. Choose the current time or a future time.');
            if ($field === 'end_date' && $value <= $serverNow) throw new InvalidArgumentException('End date must be in the future.');
        }
    }

    private function couponCode($value, ?int $exceptId = null): string
    {
        if (!is_string($value)) throw new InvalidArgumentException('Enter your coupon code.');
        $code = strtoupper(trim($value));
        if (!preg_match('/^[A-Z0-9][A-Z0-9_-]{2,39}$/', $code)) throw new InvalidArgumentException('Coupon codes need 3–40 letters or numbers, with optional hyphens or underscores.');
        $stmt = $this->db->prepare('SELECT id FROM discounts WHERE coupon_code=? AND id<>? LIMIT 1');
        $stmt->execute([$code,$exceptId ?? 0]);
        if ($stmt->fetchColumn()) throw new InvalidArgumentException('This coupon code is already in use. Choose another code.');
        return $code;
    }

    private function attachProducts(array $discount): array
    {
        $stmt = $this->db->prepare('SELECT id FROM products WHERE discount_id=? AND is_active=1 ORDER BY id');
        $stmt->execute([$discount['id']]);
        $discount['product_ids'] = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        $discount['product_count'] = count($discount['product_ids']);
        return $discount;
    }

    private function assignProducts(int $id, string $type, array $productIds): void
    {
        $ids = [];
        foreach ($productIds as $value) {
            $number = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($number === false || is_bool($value)) throw new InvalidArgumentException('Choose valid products.');
            $ids[] = (int)$number;
        }
        $ids = array_values(array_unique($ids));
        if (count($ids) > 1000) throw new InvalidArgumentException('Select up to 1,000 products per discount.');
        if ($type === 'coupon' && $ids) throw new InvalidArgumentException('Coupons are entered at checkout and cannot be assigned to products.');
        if ($ids) {
            $marks = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $this->db->prepare("SELECT id FROM products WHERE id IN ($marks) AND is_active=1 FOR UPDATE");
            $stmt->execute($ids);
            if (count($stmt->fetchAll()) !== count($ids)) throw new InvalidArgumentException('One or more selected products are unavailable. Refresh and try again.');
        }
        $stmt = $this->db->prepare('UPDATE products SET discount_id=NULL WHERE discount_id=? AND is_active=1');
        $stmt->execute([$id]);
        if ($ids) {
            $stmt = $this->db->prepare("UPDATE products SET discount_id=? WHERE id IN ($marks) AND is_active=1");
            $stmt->execute(array_merge([$id], $ids));
        }
    }

    public function addDiscount(string $name, string $type, float $percentage, ?string $startDate, ?string $endDate, array $productIds = [], ?string $couponCode = null): int
    {
        $this->validate(['name'=>$name,'type'=>$type,'percentage'=>$percentage,'start_date'=>$startDate,'end_date'=>$endDate]);
        $this->validateSchedule(['start_date'=>$startDate,'end_date'=>$endDate]);
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) $this->db->beginTransaction();
        try {
            $code = $type === 'coupon' ? $this->couponCode($couponCode) : null;
            $stmt = $this->db->prepare('INSERT INTO discounts (name,type,coupon_code,percentage,start_date,end_date,is_active) VALUES (?,?,?,?,?,?,1)');
            $stmt->execute([trim($name),$type,$code,$percentage,$startDate,$endDate]);
            $id = (int)$this->db->lastInsertId();
            $this->assignProducts($id, $type, $productIds);
            if ($ownTransaction) $this->db->commit();
            return $id;
        } catch (Throwable $error) {
            if ($ownTransaction && $this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function getDiscounts(int $page = 1, ?string $name = null, ?string $startDate = null, ?string $endDate = null, bool $includeInactive = false): array
    {
        $where = [$includeInactive ? '1=1' : 'is_active=1'];
        $values = [];
        if ($name !== null && trim($name) !== '') { $where[]='name LIKE ?'; $values[]='%'.trim($name).'%'; }
        if ($startDate !== null) { $where[]='start_date>=?'; $values[]=$startDate; }
        if ($endDate !== null) { $where[]='end_date<=?'; $values[]=$endDate; }
        $filter = implode(' AND ', $where);
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM discounts WHERE $filter");
        $stmt->execute($values);
        $total = (int)$stmt->fetchColumn();
        $offset = (max(1,$page)-1)*10;
        $stmt = $this->db->prepare("SELECT *, CASE WHEN is_active=0 THEN 'inactive' WHEN start_date>NOW() THEN 'scheduled' WHEN end_date<NOW() THEN 'expired' ELSE 'active' END AS promotion_status FROM discounts WHERE $filter ORDER BY id DESC LIMIT 10 OFFSET $offset");
        $stmt->execute($values);
        $rows = array_map([$this,'attachProducts'], $stmt->fetchAll(PDO::FETCH_ASSOC));
        return ['server_time'=>$this->db->query('SELECT NOW()')->fetchColumn(),'data'=>$rows,'pagination'=>['page'=>$page,'limit'=>10,'total'=>$total,'total_pages'=>(int)ceil($total/10)]];
    }

    public function getById(int $id, bool $includeInactive = false)
    {
        $stmt = $this->db->prepare('SELECT * FROM discounts WHERE id=?' . ($includeInactive ? '' : ' AND is_active=1'));
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->attachProducts($row) : false;
    }

    public function updateDiscount(int $id, array $changes): bool
    {
        $ownTransaction = !$this->db->inTransaction();
        if ($ownTransaction) $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare('SELECT * FROM discounts WHERE id=? AND is_active=1 FOR UPDATE');
            $stmt->execute([$id]);
            $current = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$current) throw new InvalidArgumentException('Active discount not found.');
            $fields = array_intersect_key($changes, array_flip(['percentage','start_date','end_date','coupon_code']));
            if (array_key_exists('coupon_code',$fields)) {
                if ($current['type'] !== 'coupon') throw new InvalidArgumentException('Product discounts do not use coupon codes.');
                $fields['coupon_code'] = $this->couponCode($fields['coupon_code'],$id);
            }
            $this->validate(array_replace($current,$fields));
            $this->validateSchedule(array_replace($current,$fields),$current);
            $changed = false;
            if ($fields) {
                $parts = array_map(static fn($field) => "$field=?",array_keys($fields));
                $stmt = $this->db->prepare('UPDATE discounts SET '.implode(',',$parts).' WHERE id=?');
                $stmt->execute(array_merge(array_values($fields),[$id]));
                $changed = $stmt->rowCount() > 0;
            }
            if (array_key_exists('product_ids',$changes)) {
                if (!is_array($changes['product_ids'])) throw new InvalidArgumentException('Choose valid products.');
                $this->assignProducts($id,$current['type'],$changes['product_ids']);
                $changed = true;
            }
            if ($ownTransaction) $this->db->commit();
            return $changed;
        } catch (Throwable $error) {
            if ($ownTransaction && $this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function deleteDiscount(int $id): bool
    {
        $stmt = $this->db->prepare('UPDATE discounts SET is_active=0 WHERE id=? AND is_active=1');
        $stmt->execute([$id]);
        return $stmt->rowCount()>0;
    }
}
