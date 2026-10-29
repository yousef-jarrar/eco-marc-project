<?php
require_once __DIR__ . '/../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class GoogleIdentity {
    private string $clientId;
    public function __construct(string $clientId) { $this->clientId = $clientId; }

    public function verify(string $token, string $nonce, ?array $certificates = null): array {
        if ($this->clientId === '') throw new RuntimeException('Google sign-in has not been configured.', 503);
        if (strlen($token) > 16000 || $nonce === '') throw new RuntimeException('Invalid Google credential.', 401);
        $certificates = $certificates ?? $this->certificates();
        $keys = [];
        foreach ($certificates as $kid => $certificate) $keys[$kid] = new Key($certificate, 'RS256');
        try {
            $claims = (array) JWT::decode($token, $keys);
            if (!in_array($claims['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true) ||
                ($claims['aud'] ?? '') !== $this->clientId ||
                (isset($claims['azp']) && $claims['azp'] !== $this->clientId) ||
                !is_int($claims['exp'] ?? null) || $claims['exp'] <= time() ||
                !is_int($claims['iat'] ?? null) || $claims['iat'] > time() + 30 ||
                !is_string($claims['sub'] ?? null) || $claims['sub'] === '' || strlen($claims['sub']) > 255 ||
                !is_string($claims['nonce'] ?? null) || !hash_equals($nonce, $claims['nonce']) ||
                ($claims['email_verified'] ?? false) !== true ||
                !is_string($claims['email'] ?? null) || strlen($claims['email']) > 255 || !filter_var($claims['email'], FILTER_VALIDATE_EMAIL)) {
                throw new UnexpectedValueException('Invalid claims');
            }
            return $claims;
        } catch (Throwable $error) {
            throw new RuntimeException('Google credential could not be verified. Please try again.', 401);
        }
    }

    private function certificates(): array {
        $cache = sys_get_temp_dir() . '/eco-marc-google-certs.json';
        if (is_file($cache)) {
            $saved = json_decode(file_get_contents($cache), true);
            if (is_array($saved) && ($saved['expires'] ?? 0) > time() && is_array($saved['keys'] ?? null)) return $saved['keys'];
        }
        $maxAge = 300;
        $curl = curl_init('https://www.googleapis.com/oauth2/v1/certs');
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_HEADERFUNCTION => function ($curl, $header) use (&$maxAge) {
                if (preg_match('/^cache-control:.*max-age=(\d+)/i', $header, $match)) $maxAge = min((int)$match[1], 86400);
                return strlen($header);
            },
        ]);
        $body = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        $keys = is_string($body) ? json_decode($body, true) : null;
        if ($status !== 200 || !is_array($keys) || !$keys) throw new RuntimeException('Cannot contact Google verification service. Please try again.', 503);
        file_put_contents($cache, json_encode(['expires' => time() + $maxAge, 'keys' => $keys]), LOCK_EX);
        return $keys;
    }
}
