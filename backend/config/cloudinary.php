<?php
require_once __DIR__ . '/env.php';

$parts = parse_url(requiredEnv('CLOUDINARY_URL'));
if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'cloudinary' ||
    empty($parts['host']) || empty($parts['user']) || empty($parts['pass'])) {
    throw new RuntimeException('Image storage configuration is invalid.');
}

return new Cloudinary\Cloudinary([
    'cloud' => [
        'cloud_name' => $parts['host'],
        'api_key' => rawurldecode($parts['user']),
        'api_secret' => rawurldecode($parts['pass']),
    ],
    'url' => ['secure' => true],
]);
