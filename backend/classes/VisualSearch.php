<?php
require_once __DIR__ . '/../config/env.php';

class VisualSearch {
    private PDO $db;
    private string $service;
    private const MODEL = 'sentence-transformers/clip-ViT-B-32';
    private const MAX_SIZE = 5242880;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->service = rtrim(appEnv('VISUAL_SEARCH_URL', 'http://127.0.0.1:8001'), '/');
        if (!preg_match('#^http://127\.0\.0\.1:[0-9]{1,5}$#', $this->service)) {
            throw new RuntimeException('VISUAL_SEARCH_URL must use the local Python service.');
        }
    }

    public function indexImages(?int $imageId = null): array {
        $sql = 'SELECT i.id, i.image_url FROM product_images i JOIN products p ON p.id = i.product_id WHERE p.is_active = 1';
        $statement = $this->db->prepare($sql . ($imageId !== null ? ' AND i.id = ?' : '') . ' ORDER BY i.id');
        $statement->execute($imageId !== null ? [$imageId] : []);
        $images = $statement->fetchAll(PDO::FETCH_ASSOC);
        $results = [];
        foreach ($images as $image) {
            try {
                $embedding = $this->embedProductImage($image['image_url']);
                $this->saveEmbedding($image, $embedding);
                $results[] = ['image_id' => (int)$image['id'], 'status' => 'saved'];
            } catch (Throwable $error) {
                $results[] = ['image_id' => (int)$image['id'], 'status' => 'failed', 'message' => $error->getMessage()];
            }
        }
        return $results;
    }

    private function embedProductImage(string $url): array {
        $file = tmpfile();
        if ($file === false) throw new RuntimeException('Could not create a temporary image.');
        try {
            if (preg_match('#^https?://#i', $url)) {
                $parts = parse_url($url);
                if (($parts['scheme'] ?? '') !== 'https' || strtolower($parts['host'] ?? '') !== 'res.cloudinary.com' ||
                    isset($parts['user']) || isset($parts['pass']) || (isset($parts['port']) && $parts['port'] !== 443)) {
                    throw new RuntimeException('Only HTTPS Cloudinary image URLs are supported.');
                }
                $size = 0;
                $curl = curl_init($url);
                curl_setopt_array($curl, [
                    CURLOPT_FOLLOWLOCATION => false,
                    CURLOPT_CONNECTTIMEOUT => 10,
                    CURLOPT_TIMEOUT => 30,
                    CURLOPT_WRITEFUNCTION => function ($handle, string $data) use ($file, &$size): int {
                        $size += strlen($data);
                        if ($size > self::MAX_SIZE) return 0;
                        return fwrite($file, $data);
                    }
                ]);
                $ok = curl_exec($curl);
                $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
                curl_close($curl);
                if ($size > self::MAX_SIZE) throw new RuntimeException('Product image exceeds 5 MB.');
                if ($ok === false || $status !== 200) throw new RuntimeException('Could not download the Cloudinary image.');
            } else {
                $root = realpath(__DIR__ . '/../..');
                $path = realpath($root . '/' . ltrim($url, '/'));
                $allowed = [$root . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR,
                    $root . DIRECTORY_SEPARATOR . 'frontend' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR,
                    $root . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR];
                $safe = false;
                foreach ($allowed as $folder) {
                    if ($path !== false && strncasecmp($path, $folder, strlen($folder)) === 0) $safe = true;
                }
                if (!$safe || !is_file($path)) throw new RuntimeException('Local product image was not found in an allowed folder.');
                if (filesize($path) > self::MAX_SIZE) throw new RuntimeException('Product image exceeds 5 MB.');
                $input = fopen($path, 'rb');
                if ($input === false) throw new RuntimeException('Could not read product image.');
                try { stream_copy_to_stream($input, $file, self::MAX_SIZE + 1); }
                finally { fclose($input); }
                if (ftell($file) > self::MAX_SIZE) throw new RuntimeException('Product image exceeds 5 MB.');
            }

            $path = stream_get_meta_data($file)['uri'];
            return $this->embedFile($path);
        } finally {
            fclose($file);
        }
    }


    public function embedFile(string $path): array {
        if (!is_file($path) || filesize($path) > self::MAX_SIZE) {
            throw new InvalidArgumentException('Upload an image of 5 MB or smaller.');
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new RuntimeException('Product image must be JPG, PNG or WebP.');
        }
        $curl = curl_init($this->service . '/embed');
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => ['image' => new CURLFile($path, $mime, 'product-image')],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_PROXY => '',
        ]);
        $response = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if ($response === false) throw new RuntimeException('Python service unavailable. Start it on port 8001.');
        if ($status !== 200) throw new RuntimeException('Python could not process the image (HTTP ' . $status . ').');
        $data = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
        if (($data['model'] ?? '') !== self::MODEL || ($data['dimensions'] ?? 0) !== 512 ||
            !is_array($data['embedding'] ?? null) || count($data['embedding']) !== 512) {
            throw new RuntimeException('Python returned an unexpected embedding.');
        }
        $length = 0.0;
        foreach ($data['embedding'] as $value) {
            if ((!is_int($value) && !is_float($value)) || !is_finite((float)$value)) {
                throw new RuntimeException('Python returned invalid vector values.');
            }
            $length += $value * $value;
        }
        if (abs(sqrt($length) - 1.0) > 0.001) throw new RuntimeException('Python vector is not normalized.');
        return $data['embedding'];
    }

    public function search(string $path): array {
        $queryVector = $this->embedFile($path);
        $statement = $this->db->prepare('SELECT p.id, p.name, p.price, p.category_id, i.id AS image_id, i.image_url, e.embedding FROM product_embeddings e JOIN product_images i ON i.id = e.product_image_id JOIN products p ON p.id = i.product_id WHERE p.is_active = 1 AND e.model_name = ?');
        $statement->execute([self::MODEL]);
        $products = [];
        while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
            $vector = json_decode($row['embedding'], true);
            if (!is_array($vector) || count($vector) !== 512 || array_keys($vector) !== range(0, 511)) continue;
            $score = 0.0;
            $length = 0.0;
            foreach ($vector as $index => $value) {
                if ((!is_int($value) && !is_float($value)) || !is_finite((float)$value)) continue 2;
                $score += $queryVector[$index] * $value;
                $length += $value * $value;
            }
            if (abs(sqrt($length) - 1.0) > 0.001) continue;
            $score = max(-1.0, min(1.0, $score));
            $id = (int)$row['id'];
            if (isset($products[$id]) && $products[$id]['similarity'] >= $score) continue;
            $products[$id] = [
                'id' => $id,
                'name' => $row['name'],
                'price' => (float)$row['price'],
                'category_id' => (int)$row['category_id'],
                'image_id' => (int)$row['image_id'],
                'image_url' => $row['image_url'],
                'similarity' => $score,
            ];
        }
        $products = array_values($products);
        usort($products, function (array $a, array $b): int {
            return ($b['similarity'] <=> $a['similarity']) ?: ($a['id'] <=> $b['id']);
        });
        if (!$products) return [];
        $categoryId = $products[0]['category_id'];
        $products = array_values(array_filter($products, function (array $product) use ($categoryId): bool {
            return $product['category_id'] === $categoryId;
        }));
        return array_slice($products, 0, 5);
    }

    private function saveEmbedding(array $image, array $embedding): void {
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare('SELECT image_url FROM product_images WHERE id = ? FOR UPDATE');
            $statement->execute([$image['id']]);
            if ($statement->fetchColumn() !== $image['image_url']) {
                throw new RuntimeException('Image changed during indexing; run the command again.');
            }
            $statement = $this->db->prepare('INSERT INTO product_embeddings (product_image_id, embedding, model_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE embedding = VALUES(embedding), model_name = VALUES(model_name), created_at = CURRENT_TIMESTAMP');
            $statement->execute([$image['id'], json_encode($embedding, JSON_THROW_ON_ERROR), self::MODEL]);
            $this->db->commit();
        } catch (Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }
}
