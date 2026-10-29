<?php
require_once __DIR__ . '/../vendor/autoload.php';

try {
    Dotenv\Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
} catch (Throwable $error) {
    throw new RuntimeException('Server configuration could not be loaded.');
}

function appEnv(string $name, ?string $default = null): ?string {
    $value = getenv($name);
    if ($value === false) $value = $_ENV[$name] ?? $_SERVER[$name] ?? $default;
    return $value === null ? null : (string)$value;
}

function requiredEnv(string $name, bool $allowEmpty = false): string {
    $value = appEnv($name);
    if ($value === null || (!$allowEmpty && $value === '')) throw new RuntimeException('Required server configuration is missing.');
    return $value;
}
