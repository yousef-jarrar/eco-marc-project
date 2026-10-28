<?php 

class Settings {
    private PDO $conn;
    public function __construct(PDO $conn) {
        $this->conn = $conn;
    }

     public function getSettings() {
      $sql="SELECT * FROM settings WHERE id = 1";
      $stmt=$this->conn->prepare($sql);
      $stmt->execute();
      return $stmt->fetch(PDO::FETCH_ASSOC);

     }

      public function updateSettings($delivery_fee,$free_delivery_at){
      $sql="UPDATE settings SET delivery_fee= ?, free_delivery_at = ?  WHERE id= 1";
      $stmt=$this->conn->prepare($sql);
      return $stmt->execute([$delivery_fee,$free_delivery_at]);

     }

}
?>