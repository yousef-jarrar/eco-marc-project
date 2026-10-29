<?php
// ينفذ من الطرفية فقط، ولا يحتوي أي كلمة مرور افتراضية.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../config/db.php';
$email = strtolower(trim(readline('Admin email: ')));
$first = trim(readline('First name: '));
$last = trim(readline('Last name: '));
if (PHP_OS_FAMILY === 'Windows') {
    $command = <<<'COMMAND'
powershell -NoProfile -Command "$p = Read-Host 'Password (12-72 bytes)' -AsSecureString; $v = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($v) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($v) }"
COMMAND;
    $password = shell_exec($command);
    $password = rtrim($password ?? '', "\r\n");
} else {
    system('stty -echo');
    $password = readline('Password (12-72 bytes): ');
    system('stty echo');
    echo PHP_EOL;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $first === '' || $last === '' || strlen($email) > 255 || mb_strlen($first) > 100 || mb_strlen($last) > 100 || strlen($password) < 12 || strlen($password) > 72) {
    fwrite(STDERR, "Invalid name, email or password length. Nothing changed.\n"); exit(1);
}
try {
    $db = (new Database())->connect();
    $query = $db->prepare("INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')");
    $query->execute([$first, $last, $email, password_hash($password, PASSWORD_DEFAULT)]);
    echo "Admin created. Sign in through frontend/account/login.html.\n";
} catch (PDOException $error) {
    fwrite(STDERR, "Could not create admin. If this email exists, manage its role explicitly in MySQL; existing accounts are never overwritten.\n"); exit(1);
} finally { unset($password); }
