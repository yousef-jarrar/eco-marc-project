<?php

class AdminAI {
    private PDO $conn;

    public function __construct(PDO $conn) {
        $this->conn = $conn;
    }

    // فترة التقرير والفترة السابقة يكون لهما نفس عدد الأيام.
    public static function getPeriod(?string $from = null, ?string $to = null): array {
        $timezone = new DateTimeZone('Asia/Amman');
        $today = new DateTimeImmutable('today', $timezone);
        if ($from === null && $to === null) {
            $from = $today->modify('-6 days')->format('Y-m-d');
            $to = $today->format('Y-m-d');
        }

        $start = self::readDate($from, $timezone);
        $end = self::readDate($to, $timezone);
        if ($start > $end) {
            throw new InvalidArgumentException('The start date must be before the end date.');
        }
        if ($end > $today) {
            throw new InvalidArgumentException('Reports cannot include future dates.');
        }

        $days = (int) $start->diff($end)->days + 1;
        if ($days > 366) {
            throw new InvalidArgumentException('Choose a reporting period of 366 days or less.');
        }

        return [
            'from' => $start->format('Y-m-d'),
            'to' => $end->format('Y-m-d'),
            'end_exclusive' => $end->modify('+1 day')->format('Y-m-d'),
            'days' => $days,
            'previous_from' => $start->modify('-' . $days . ' days')->format('Y-m-d'),
            'previous_to' => $start->modify('-1 day')->format('Y-m-d'),
            'timezone' => 'Asia/Amman'
        ];
    }

    private static function readDate(?string $value, DateTimeZone $timezone): DateTimeImmutable {
        if ($value === null || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            throw new InvalidArgumentException('Supply both dates in YYYY-MM-DD format.');
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, $timezone);
        if ($date === false || $date->format('Y-m-d') !== $value) {
            throw new InvalidArgumentException('One of the reporting dates is invalid.');
        }
        return $date;
    }

    public function getSummary(array $period): array {
        $sql = "SELECT
                    COUNT(*) AS total_orders,
                    COALESCE(SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_orders,
                    COALESCE(SUM(CASE WHEN c.status IN ('confirmed','processing','shipped','delivered') THEN 1 ELSE 0 END), 0) AS eligible_orders,
                    COUNT(DISTINCT CASE WHEN c.status IN ('confirmed','processing','shipped','delivered') THEN c.user_id END) AS customers,
                    COALESCE(SUM(CASE WHEN c.status IN ('confirmed','processing','shipped','delivered') THEN cd.total ELSE 0 END), 0) AS revenue
                FROM carts c
                JOIN cart_details cd ON cd.cart_id = c.id
                WHERE c.status != 'active'
                  AND cd.placed_at >= ? AND cd.placed_at < ?";
        $statement = $this->conn->prepare($sql);
        $statement->execute([$period['from'], $period['end_exclusive']]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        $average = 0;
        if ((int) $row['eligible_orders'] > 0) {
            $average = (float) $row['revenue'] / (int) $row['eligible_orders'];
        }
        return [
            'revenue' => round((float) $row['revenue'], 2),
            'total_orders' => (int) $row['total_orders'],
            'pending_orders' => (int) $row['pending_orders'],
            'eligible_orders' => (int) $row['eligible_orders'],
            'customers' => (int) $row['customers'],
            'average_order_value' => round($average, 2)
        ];
    }

    public static function compare(float $current, float $previous): array {
        $percent = null;
        if ($previous != 0) {
            $percent = round((($current - $previous) / $previous) * 100, 2);
        }
        return ['current' => $current, 'previous' => $previous,
            'difference' => round($current - $previous, 2), 'percent' => $percent];
    }

    public function getTopSellingProducts(array $period, int $limit = 5): array {
        $sql = "SELECT p.id, p.name, SUM(ci.quantity) AS units_sold
                FROM cart_items ci
                JOIN carts c ON c.id = ci.cart_id
                JOIN cart_details cd ON cd.cart_id = c.id
                JOIN product_variants pv ON pv.id = ci.variant_id
                JOIN products p ON p.id = pv.product_id
                WHERE c.status IN ('confirmed','processing','shipped','delivered')
                  AND cd.placed_at >= ? AND cd.placed_at < ?
                GROUP BY p.id, p.name
                ORDER BY units_sold DESC, p.id ASC LIMIT ?";
        $statement = $this->conn->prepare($sql);
        $statement->bindValue(1, $period['from']);
        $statement->bindValue(2, $period['end_exclusive']);
        $statement->bindValue(3, max(1, min(20, $limit)), PDO::PARAM_INT);
        $statement->execute();
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getLowStockProducts(int $threshold = 5): array {
        $sql = "SELECT p.id AS product_id, p.name, pv.id AS variant_id, pv.size, pv.color, pv.quantity
                FROM product_variants pv JOIN products p ON p.id = pv.product_id
                WHERE p.is_active = 1 AND pv.quantity <= ?
                ORDER BY pv.quantity ASC, pv.id ASC LIMIT 50";
        $statement = $this->conn->prepare($sql);
        $statement->execute([$threshold]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getLowStockCount(): int {
        return (int) $this->conn->query("SELECT COUNT(*) FROM product_variants pv
            JOIN products p ON p.id = pv.product_id WHERE p.is_active = 1 AND pv.quantity <= 5")->fetchColumn();
    }

    public function getOrdersByStatus(array $period): array {
        $statement = $this->conn->prepare("SELECT c.status, COUNT(*) AS total
            FROM carts c JOIN cart_details cd ON cd.cart_id = c.id
            WHERE c.status != 'active' AND cd.placed_at >= ? AND cd.placed_at < ?
            GROUP BY c.status ORDER BY c.status");
        $statement->execute([$period['from'], $period['end_exclusive']]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getProductRatings(array $period): array {
        $statement = $this->conn->prepare("SELECT p.id, p.name, COUNT(r.id) AS total_reviews,
                ROUND(AVG(r.rating), 2) AS average_rating
            FROM reviews r JOIN products p ON p.id = r.product_id
            WHERE r.status = 'approved' AND r.created_at >= ? AND r.created_at < ?
            GROUP BY p.id, p.name ORDER BY average_rating ASC, total_reviews DESC, p.id ASC LIMIT 5");
        $statement->execute([$period['from'], $period['end_exclusive']]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getDailyRevenue(array $period): array {
        $statement = $this->conn->prepare("SELECT DATE(cd.placed_at) AS sale_date,
                COUNT(*) AS total_orders, COALESCE(SUM(cd.total), 0) AS revenue
            FROM carts c JOIN cart_details cd ON cd.cart_id = c.id
            WHERE c.status IN ('confirmed','processing','shipped','delivered')
              AND cd.placed_at >= ? AND cd.placed_at < ?
            GROUP BY DATE(cd.placed_at) ORDER BY sale_date ASC");
        $statement->execute([$period['from'], $period['end_exclusive']]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getRevenueByCategory(array $period): array {
        $statement = $this->conn->prepare("SELECT c.id, c.name,
                COALESCE(SUM(ci.quantity * p.price), 0) AS revenue
            FROM cart_items ci
            JOIN carts cart ON cart.id = ci.cart_id
            JOIN cart_details cd ON cd.cart_id = cart.id
            JOIN product_variants pv ON pv.id = ci.variant_id
            JOIN products p ON p.id = pv.product_id
            JOIN categories c ON c.id = p.category_id
            WHERE cart.status IN ('confirmed','processing','shipped','delivered')
              AND cd.placed_at >= ? AND cd.placed_at < ?
            GROUP BY c.id, c.name
            ORDER BY revenue DESC, c.id ASC");
        $statement->execute([$period['from'], $period['end_exclusive']]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    // مخزون المنتجات المذكورة أو الأكثر مبيعاً يساعد في أسئلة المتابعة.
    public function getProductStock(array $productIds, string $question): array {
        $catalog = $this->conn->query('SELECT id, name FROM products WHERE is_active = 1')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($catalog as $product) {
            if (mb_stripos($question, $product['name']) !== false) {
                $productIds[] = (int) $product['id'];
            }
        }
        $productIds = array_slice(array_unique(array_map('intval', $productIds)), 0, 20);
        if (count($productIds) === 0) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        $statement = $this->conn->prepare("SELECT p.id AS product_id, p.name, pv.id AS variant_id,
                pv.size, pv.color, pv.quantity
            FROM products p JOIN product_variants pv ON pv.product_id = p.id
            WHERE p.is_active = 1 AND p.id IN ($placeholders) ORDER BY p.id, pv.id LIMIT 200");
        $statement->execute($productIds);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getMarketingRecommendations(array $period): array {
        $sql = "SELECT p.id, p.name, COALESCE(s.units_sold, 0) AS units_sold,
                COALESCE(stock.quantity, 0) AS stock_quantity,
                COALESCE(stock.variants, 0) AS total_variants,
                COALESCE(stock.available, 0) AS available_variants,
                COALESCE(r.review_count, 0) AS review_count, r.rating
            FROM products p
            LEFT JOIN (
                SELECT pv.product_id, SUM(ci.quantity) AS units_sold
                FROM cart_items ci JOIN product_variants pv ON pv.id = ci.variant_id
                JOIN carts c ON c.id = ci.cart_id JOIN cart_details cd ON cd.cart_id = c.id
                WHERE c.status IN ('confirmed','processing','shipped','delivered')
                  AND cd.placed_at >= ? AND cd.placed_at < ? GROUP BY pv.product_id
            ) s ON s.product_id = p.id
            LEFT JOIN (
                SELECT product_id, SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) AS quantity,
                    COUNT(*) AS variants, SUM(CASE WHEN quantity > 0 THEN 1 ELSE 0 END) AS available
                FROM product_variants GROUP BY product_id
            ) stock ON stock.product_id = p.id
            LEFT JOIN (
                SELECT product_id, COUNT(*) AS review_count, AVG(rating) AS rating
                FROM reviews WHERE status = 'approved' AND created_at >= ? AND created_at < ? GROUP BY product_id
            ) r ON r.product_id = p.id
            WHERE p.is_active = 1 ORDER BY units_sold DESC, stock_quantity DESC, p.id ASC";
        $statement = $this->conn->prepare($sql);
        $statement->execute([$period['from'], $period['end_exclusive'], $period['from'], $period['end_exclusive']]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $advertising = [];
        $offers = [];
        $qualityChecks = [];
        $eligible = [];
        foreach ($rows as $row) {
            if ((int)$row['stock_quantity'] < 10 || (int)$row['total_variants'] === 0 ||
                (int)$row['available_variants'] * 2 < (int)$row['total_variants']) continue;
            if ((int)$row['review_count'] >= 3 && (float)$row['rating'] < 3.5) {
                $qualityChecks[] = $row;
                continue;
            }
            $eligible[] = $row;
            if ((int)$row['units_sold'] > 0 && count($advertising) < 3) $advertising[] = $row;
        }
        usort($eligible, function ($a, $b) {
            return ((int)$a['units_sold'] <=> (int)$b['units_sold']) ?:
                ((int)$b['stock_quantity'] <=> (int)$a['stock_quantity']) ?: ((int)$a['id'] <=> (int)$b['id']);
        });
        $adIds = array_column($advertising, 'id');
        foreach ($eligible as $row) {
            if ((int)$row['stock_quantity'] >= 20 && !in_array($row['id'], $adIds) && count($offers) < 3) $offers[] = $row;
        }
        return ['advertising' => $advertising, 'offers' => $offers,
            'quality_checks' => array_slice($qualityChecks, 0, 3), 'active_products' => count($rows)];
    }

    public function getBusinessContext(array $period, string $question = ''): array {
        $summary = $this->getSummary($period);
        $previousPeriod = self::getPeriod($period['previous_from'], $period['previous_to']);
        $previous = $this->getSummary($previousPeriod);
        $comparison = [];
        foreach (['revenue', 'total_orders', 'eligible_orders', 'average_order_value'] as $metric) {
            $comparison[$metric] = self::compare($summary[$metric], $previous[$metric]);
        }
        $top = $this->getTopSellingProducts($period);
        $ratings = $this->getProductRatings($period);
        $ids = [];
        foreach (array_merge($top, $ratings) as $product) {
            $ids[] = $product['id'];
        }
        return [
            'period' => $period,
            'summary' => $summary,
            'previous_summary' => $previous,
            'comparison' => $comparison,
            'total_revenue' => $summary['revenue'],
            'top_selling_products' => $top,
            'orders_by_status' => $this->getOrdersByStatus($period),
            'revenue_by_category' => $this->getRevenueByCategory($period),
            'lowest_rated_products' => $ratings,
            'daily_revenue' => $this->getDailyRevenue($period),
            'low_stock_products' => $this->getLowStockProducts(),
            'low_stock_count' => $this->getLowStockCount(),
            'total_products' => (int) $this->conn->query('SELECT COUNT(*) FROM products WHERE is_active = 1')->fetchColumn(),
            'total_categories' => (int) $this->conn->query('SELECT COUNT(*) FROM categories')->fetchColumn(),
            'product_stock' => $this->getProductStock($ids, $question),
            'inventory_as_of' => date(DATE_ATOM),
            'marketing_recommendations' => $this->classifyQuestion($question) === 'marketing' ? $this->getMarketingRecommendations($period) : null,
            'revenue_rule' => 'Confirmed, processing, shipped and delivered checkout totals; pending and cancelled excluded. Totals include delivery and discounts.',
            'limitations' => ['Inventory is current, not historical.', 'Profit and causes of sales changes are not available.', 'Product rankings use current cart item quantities; historical line snapshots are not stored.', 'Category revenue uses current catalog prices because historical item-price snapshots are not stored.']
        ];
    }

    private function hasWord(string $message, array $words): bool {
        foreach ($words as $word) {
            if (mb_strpos($message, $word) !== false) {
                return true;
            }
        }
        return false;
    }

    public function classifyQuestion(string $message, array $history = []): string {
        $message = mb_strtolower($message);
        if ($this->hasWord($message, ['weather', 'football', 'politics', 'طقس', 'سياس', 'مباراة', 'برمج', 'programming'])) return 'unsupported';
        if ($this->hasWord($message, ['دعاية', 'دعايه', 'إعلان', 'اعلان', 'إعلانات', 'اعلانات', 'عروض', 'عروظ', 'خصم', 'ترويج', 'تسويق', 'اعمل عرض', 'نعمل عرض', 'تنصحني', 'advertis', 'promot', 'campaign', 'discount', 'recommend a product', 'which product should'])) return 'marketing';
        if ($this->hasWord($message, ['profit', 'أرباح', 'ارباح', 'تكلف', 'cost price'])) return 'unavailable';
        if ($this->hasWord($message, ['stock', 'inventory', 'restock', 'quantity', 'how many left', 'available', 'مخزون', 'خلص', 'باقي', 'كمية', 'كميه', 'متوفر', 'نفد', 'ناقص', 'مقاس', 'اللون'])) return 'inventory';
        if ($this->hasWord($message, ['review', 'rating', 'تقييم', 'تقيم', 'آراء', 'اراء'])) return 'reviews';
        if ($this->hasWord($message, ['best', 'selling', 'sell the most', 'top product', 'أكثر', 'اكثر', 'انباع', 'الأفضل', 'الافضل'])) return 'products';
        if ($this->hasWord($message, ['pending', 'order', 'طلب', 'معلق', 'شحن'])) return 'orders';
        if ($this->hasWord($message, ['revenue', 'sales', 'إيراد', 'ايراد', 'مبيعات', 'دخل', 'متوسط', 'average', 'قارن', 'compare', 'مقارن'])) return 'revenue';
        if ($this->hasWord($message, ['store', 'business', 'متجر', 'المحل', 'الوضع', 'الشغل', 'وضعنا', 'أداء', 'اداء', 'عملاء', 'customers', 'منتج', 'product'])) return 'overview';
        if ($this->hasWord($message, ['why', 'what about', 'and ', 'ليش', 'لماذا', 'وهذا', 'عنه', 'منه', 'طيب', 'هالفترة', 'نفسه', 'نفسها'])) {
            for ($i = count($history) - 1; $i >= 0; $i--) {
                if ($history[$i]['role'] === 'user') {
                    $previousIntent = $this->classifyQuestion($history[$i]['content']);
                    if ($previousIntent !== 'unsupported') return 'followup';
                }
            }
        }
        return 'unsupported';
    }

    public static function cleanHistory($history): array {
        if (!is_array($history) || count($history) > 10) {
            throw new InvalidArgumentException('Send at most 10 previous messages.');
        }
        $clean = [];
        $total = 0;
        foreach ($history as $message) {
            if (!is_array($message) || !isset($message['role'], $message['content']) ||
                !in_array($message['role'], ['user', 'assistant'], true) || !is_string($message['content'])) {
                throw new InvalidArgumentException('Conversation history is invalid.');
            }
            $content = trim($message['content']);
            $total += mb_strlen($content);
            if (mb_strlen($content) > 4000 || $total > 16000) {
                throw new InvalidArgumentException('Conversation history is too long. Clear the conversation and retry.');
            }
            if ($content !== '') $clean[] = ['role' => $message['role'], 'content' => $content];
        }
        return $clean;
    }

    public function getCards(string $intent, array $data): array {
        if ($intent === 'inventory') return ['type' => 'inventory', 'items' => $data['low_stock_products']];
        if ($intent === 'products') return ['type' => 'products', 'items' => $data['top_selling_products']];
        if ($intent === 'reviews') return ['type' => 'reviews', 'items' => $data['lowest_rated_products']];
        if ($intent === 'orders') return ['type' => 'orders', 'items' => $data['orders_by_status']];
        return ['type' => 'summary', 'items' => []];
    }

    public function getCalculatedAnswer(string $intent, array $data, bool $arabic): string {
        $summary = $data['summary'];
        $period = $data['period']['from'] . ' — ' . $data['period']['to'];
        $revenue = number_format($summary['revenue'], 2, '.', ',') . ' JOD';
        if ($intent === 'marketing') {
            $recommendations = $data['marketing_recommendations'] ?? null;
            if (!$recommendations || $recommendations['active_products'] === 0) {
                return $arabic ? 'بقدر أساعدك تختار منتج للدعاية أو العروض، لكن حالياً ما في منتجات نشطة ببيانات المتجر حتى أرشّح اسماً حقيقياً. أضف المنتجات والمقاسات وكميات المخزون، وسجّل المبيعات حتى تكون المقارنة مفيدة.' : 'I can suggest products for ads and offers, but there are no active products in the store data yet. Add products, variants and inventory; recorded sales will make the recommendations more useful.';
            }
            $lines = [$arabic ? "اقتراحات للفترة المختارة: $period. المخزون حسب المتوفر حالياً." : "Suggestions for the selected period: $period. Stock is current."];
            foreach ($recommendations['advertising'] as $row) {
                $units = (int)$row['units_sold']; $stock = (int)$row['stock_quantity'];
                $coverage = (int)$row['available_variants'] . '/' . (int)$row['total_variants'];
                $lines[] = $arabic ? "للدعاية: {$row['name']} — باع $units قطعة ضمن الفترة، والمتوفر $stock قطعة، مع توفر $coverage من المقاسات/الألوان. جرّب إعلاناً بميزانية صغيرة وراقب النتائج." : "For ads: {$row['name']} — $units units sold in the period, $stock units currently in stock and $coverage variants available. Test a small campaign and measure results.";
            }
            foreach ($recommendations['offers'] as $row) {
                $units = (int)$row['units_sold']; $stock = (int)$row['stock_quantity'];
                $lines[] = $arabic ? "لعرض تجريبي: {$row['name']} — المتوفر $stock قطعة والمبيعات $units قطعة ضمن الفترة. اختبر عرضاً محدوداً؛ انخفاض المبيعات وحده لا يثبت ضعف الطلب." : "For an offer test: {$row['name']} — $stock units in stock and $units units sold in the period. Try a limited offer; low sales alone do not establish weak demand.";
            }
            if (!$recommendations['advertising']) $lines[] = $arabic ? 'ما في منتج يجمع مبيعات مسجلة مع مخزون وتوفر مقاسات كافيين لترشيحه للدعاية حالياً.' : 'No product currently combines recorded sales with enough stock and variant availability for an ad recommendation.';
            if (!$recommendations['offers']) $lines[] = $arabic ? 'ما في منتج إضافي بمخزون كافٍ لترشيحه لعرض منفصل حالياً.' : 'No additional product has enough stock for a separate offer recommendation.';
            foreach ($recommendations['quality_checks'] as $row) {
                $rating = number_format($row['rating'], 2, '.', ',');
                $lines[] = $arabic ? "راجع ملاحظات العملاء على {$row['name']} قبل ترويجه: تقييمه $rating/5 من {$row['review_count']} تقييمات معتمدة ضمن الفترة." : "Review customer feedback before promoting {$row['name']}: $rating/5 from {$row['review_count']} approved reviews in the period.";
            }
            $lines[] = $arabic ? 'هذه ترشيحات بقواعد بسيطة من بيانات المتجر، وليست توقعاً لنجاح الإعلان. لا أقدر أحدد نسبة خصم مربحة بدون تكلفة المنتج وهامش الربح؛ ولا أملك بيانات عمر المخزون أو نتائج حملات سابقة.' : 'These are rule-based suggestions, not predictions of ad success. A profitable discount needs product costs and margins; stock age and campaign history are unavailable.';
            return implode("\n\n", $lines);
        }
        if ($intent === 'revenue') {
            $average = number_format($summary['average_order_value'], 2, '.', ',') . ' JOD';
            $orders = (int) $summary['eligible_orders'];
            if ($arabic) {
                $lines = [
                    "إجمالي المبيعات المحتسبة خلال الفترة المختارة ($period): $revenue (دينار أردني).",
                    "عدد الطلبات المحتسبة: $orders. متوسط قيمة الطلب: $average."
                ];
            } else {
                $lines = ["Eligible sales for the selected period ($period): $revenue.",
                    "Eligible orders: $orders. Average order value: $average."];
            }
            $comparison = $data['comparison']['revenue'] ?? null;
            if ($comparison) {
                $previous = number_format($comparison['previous'], 2, '.', ',') . ' JOD';
                if ($arabic) $lines[] = "مبيعات الفترة السابقة المساوية بالمدة: $previous.";
                else $lines[] = "Sales in the preceding equal-length period: $previous.";
                if ($comparison['percent'] === null) {
                    $lines[] = $arabic ? 'لا يمكن حساب نسبة التغير لأن مبيعات الفترة السابقة كانت صفراً.' : 'Percentage change is unavailable because previous sales were zero.';
                } else {
                    $change = number_format(abs($comparison['percent']), 2, '.', ',') . '%';
                    if ($comparison['difference'] == 0) $lines[] = $arabic ? 'لم تتغير المبيعات عن الفترة السابقة.' : 'Sales are unchanged from the previous period.';
                    elseif ($arabic) $lines[] = $comparison['difference'] > 0 ? "ارتفعت المبيعات بنسبة $change عن الفترة السابقة." : "انخفضت المبيعات بنسبة $change عن الفترة السابقة.";
                    else $lines[] = ($comparison['difference'] > 0 ? 'Sales increased by ' : 'Sales decreased by ') . $change . ' from the previous period.';
                }
            }
            return implode("\n", $lines);
        }
        if ($intent === 'unavailable') {
            if ($arabic) return 'بيانات تكلفة المنتجات والأرباح غير متوفرة، لذلك لا يمكن حساب الربح من الإيرادات وحدها.';
            return 'Product costs are unavailable, so profit cannot be calculated from revenue alone.';
        }
        if ($intent === 'inventory') {
            if ($arabic) return 'المخزون الحالي: ' . $data['low_stock_count'] . ' مقاس/لون بكميّة 5 أو أقل. التفاصيل ظاهرة أسفل الإجابة. المخزون لقطة حالية ولا يتغير حسب فترة المبيعات.';
            return 'Current inventory: ' . $data['low_stock_count'] . ' variants have 5 or fewer units. See the returned details below. Inventory is a current snapshot.';
        }
        if (in_array($intent, ['products', 'reviews', 'orders'], true)) {
            $rows = $data['top_selling_products'];
            if ($intent === 'reviews') $rows = $data['lowest_rated_products'];
            if ($intent === 'orders') $rows = $data['orders_by_status'];
            $lines = [$period];
            foreach ($rows as $row) {
                if ($intent === 'products') $lines[] = $row['name'] . ': ' . (int) $row['units_sold'] . ' units';
                if ($intent === 'reviews') $lines[] = $row['name'] . ': ' . number_format((float) $row['average_rating'], 2) . '/5 (' . (int) $row['total_reviews'] . ' reviews)';
                if ($intent === 'orders') $lines[] = $row['status'] . ': ' . (int) $row['total'];
            }
            if (count($rows) === 0) {
                if ($arabic) $lines[] = 'ما في سجلات مطابقة ضمن الفترة المختارة.';
                else $lines[] = 'No matching records were returned for this period.';
            }
            return implode("\n", $lines);
        }
        if ($arabic) return "الفترة: $period\nالإيرادات المؤهلة: $revenue\nعدد الطلبات: " . $summary['total_orders'] . "\nالطلبات المعلقة: " . $summary['pending_orders'] . "\nمتوسط الطلب المؤهل: " . number_format($summary['average_order_value'], 2) . ' JOD. التفاصيل محسوبة مباشرة من بيانات المتجر.';
        return "Period: $period\nEligible revenue: $revenue\nOrders: " . $summary['total_orders'] . "\nPending orders: " . $summary['pending_orders'] . "\nEligible average order value: " . number_format($summary['average_order_value'], 2) . ' JOD. Figures are calculated directly from store records.';
    }
}
