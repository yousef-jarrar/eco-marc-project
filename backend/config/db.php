
<?php

class Database
{
    private PDO $conn;

    public function __construct()
    {
        $host = "localhost";
<<<<<<< HEAD
        $dbname = "ecomarc";
=======

        $dbname = "ecommerce";

>>>>>>> 31bfc45ad30a82aadf5627361be8e1eb0ced1e9d
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
