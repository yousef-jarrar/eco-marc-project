<?php

class CloudinaryImages {
    private ?object $client;

    public function __construct(?object $client = null) { $this->client = $client; }

    private function client(): object {
        if ($this->client === null) {
            try {
                $this->client = require __DIR__ . '/../config/cloudinary.php';
                $this->client->configuration->api->connectionTimeout = 5;
                $this->client->configuration->api->timeout = 15;
                $this->client->configuration->api->uploadTimeout = 15;
            } catch (Throwable $error) {
                // لا نرجع رسائل SDK أو .env للمتصفح لأنها قد تحتوي معلومات حساسة.
                throw new RuntimeException('Image storage is not configured correctly. Please check the server configuration.', 503);
            }
        }
        return $this->client;
    }

    public function upload(string $file, string $folder = 'products'): array {
        if (!in_array($folder, ['products', 'categories'], true)) throw new InvalidArgumentException('Invalid image folder');
        $publicId = 'eco-marc/' . $folder . '/' . bin2hex(random_bytes(16));
        try {
            $result = $this->client()->uploadApi()->upload($file, [
                'public_id' => $publicId, 'resource_type' => 'image',
                'overwrite' => false, 'use_filename' => false,
                'allowed_formats' => ['jpg', 'jpeg', 'png', 'webp', 'gif'],
            ]);
            $url = $result['secure_url'] ?? '';
            if (($result['public_id'] ?? '') !== $publicId || !is_string($url) ||
                parse_url($url, PHP_URL_SCHEME) !== 'https' || parse_url($url, PHP_URL_HOST) !== 'res.cloudinary.com') {
                throw new RuntimeException('Invalid image storage response');
            }
            return ['image_url' => $url, 'public_id' => $publicId];
        } catch (Throwable $error) {
            // نسجل المعرّف فقط ليتم تنظيف أي رفع نجح قبل انقطاع الرد.
            $failure = new CloudinaryUploadException('Could not upload the product image. Please try again.', 502);
            $failure->publicId = $publicId;
            throw $failure;
        }
    }

    public function destroy(string $publicId): void {
        if ($publicId === '' || strlen($publicId) > 255) throw new RuntimeException('Invalid stored image identifier');
        try {
            $result = $this->client()->uploadApi()->destroy($publicId, ['resource_type' => 'image', 'invalidate' => true]);
            if (!in_array($result['result'] ?? '', ['ok', 'not found'], true)) throw new RuntimeException('Delete incomplete');
        } catch (Throwable $error) {
            throw new RuntimeException('Image cleanup could not finish. It will be retried.', 502);
        }
    }

    // محاولة حذف مباشرة بعد الحفظ؛ لا يوجد جدول أو إعادة محاولة تلقائية.
    public function cleanup(Product $products, array $publicIds = []): void {
        foreach (array_unique($publicIds) as $publicId) {
            try {
                if (!$products->imageUsesPublicId($publicId)) $this->destroy($publicId);
            } catch (Throwable $error) {
                error_log('Eco Marc: Cloudinary image could not be deleted. Manual cleanup may be needed.');
            }
        }
    }

}

class CloudinaryUploadException extends RuntimeException {
    public string $publicId = '';
}
