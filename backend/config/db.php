
<?php

class Database
{
    private PDO $conn;

    public function __construct()
    {
        $host = "localhost";
        $dbname = "ecomarc";
        $username = "root";
        $password = "";

        try {
            $this->conn = new PDO(
                "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
                $username,
                $password
            );

            $this->conn->setAttribute(
                PDO::ATTR_ERRMODE,
                PDO::ERRMODE_EXCEPTION
            );

            $this->conn->setAttribute(
                PDO::ATTR_DEFAULT_FETCH_MODE,
                PDO::FETCH_ASSOC
            );

            $this->conn->setAttribute(
                PDO::ATTR_EMULATE_PREPARES,
                false
            );

        } catch (PDOException $e) {
            error_log($e->getMessage());
            throw new RuntimeException("Database connection failed.");
        }
    }

    public function connect(): PDO
    {
        return $this->conn;
    }
}
