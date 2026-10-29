<?php
require_once __DIR__ . '/env.php';
$scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
$projectPath = dirname(dirname(dirname($scriptPath)));
if ($projectPath === '.' || $projectPath === '/') {
    $projectPath = '';
}
return [
    'google_client_id' => appEnv('GOOGLE_CLIENT_ID', ''),
    'idle_timeout' => max(60, (int)appEnv('SESSION_IDLE_TIMEOUT', '1800')),
    'absolute_timeout' => max(60, (int)appEnv('SESSION_ABSOLUTE_TIMEOUT', '28800')),
    'cookie_path' => appEnv('SESSION_COOKIE_PATH', rtrim($projectPath, '/') . '/'),
];