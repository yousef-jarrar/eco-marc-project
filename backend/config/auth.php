<?php
require_once __DIR__ . '/env.php';
$scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
$projectPath = dirname($scriptPath, 3);
if ($projectPath === '.' || $projectPath === '/') $projectPath = '';
$cookiePath = appEnv('SESSION_COOKIE_PATH', '');
if ($cookiePath === '' || strncmp($scriptPath, $cookiePath, strlen($cookiePath)) !== 0) $cookiePath = rtrim($projectPath, '/') . '/';
return [
    'google_client_id' => appEnv('GOOGLE_CLIENT_ID', ''),
    'idle_timeout' => max(60, (int)appEnv('SESSION_IDLE_TIMEOUT', '1800')),
    'absolute_timeout' => max(60, (int)appEnv('SESSION_ABSOLUTE_TIMEOUT', '28800')),
    'cookie_path' => $cookiePath,
];