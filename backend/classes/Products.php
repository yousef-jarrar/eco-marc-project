
<?php

require_once __DIR__ . "/../config/db.php";

class Product
{
    private $connect;

    public function __construct()
    {
        $db = new Database();
        $this->connect = $db->connect();
    }

    public function getProducts()
    {
        $sql = "SELECT * FROM products";

        return $this->connect
                    ->query($sql)
                    ->fetchAll();
    }
    public function getProduct($id)
    {
        $sql = "SELECT * FROM products WHERE id = ?";

        $stmt = $this->connect->prepare($sql);
        $stmt->execute([$id]);

        return $stmt->fetch();
    }


   
}
?>
