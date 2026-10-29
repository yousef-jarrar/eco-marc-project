<?php
require_once __DIR__ . '/env.php';

class Database {
    private PDO $conn;

    public function __construct() {
        $host = requiredEnv('DB_HOST');
        $port = appEnv('DB_PORT', '3306');
        $dbname = requiredEnv('DB_NAME');
        $username = requiredEnv('DB_USER');
        $password = requiredEnv('DB_PASSWORD', true);
        if (!ctype_digit($port) || (int)$port < 1 || (int)$port > 65535 ||
            preg_match('/[;\x00-\x1F]/', $host . $dbname)) throw new RuntimeException('Invalid database configuration.');
        try {
            $this->conn = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $username, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $error) {
            error_log('Eco Marc: database connection failed.');
            throw new RuntimeException('Database connection is unavailable.');
        }
    }

    public function connect(): PDO { return $this->conn; }
}
