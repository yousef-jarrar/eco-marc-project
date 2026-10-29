<?php 

class Category {
    private PDO $conn;
    public function __construct(PDO $conn) {
        $this->conn = $conn;
    }

     public function getAllCategories() {
      $sql="SELECT * FROM categories ";
      $stmt=$this->conn->prepare($sql);
      $stmt->execute();
      return $stmt->fetchAll(PDO::FETCH_ASSOC);

     }

     public function getCategoriesById($id){
      $sql="SELECT * FROM categories WHERE id=? ";
      $stmt=$this->conn->prepare($sql);
      $stmt->execute([$id]);
      return $stmt->fetch(PDO::FETCH_ASSOC);

     } 
     public function creatCategories($name,$image_url,$status){
      $sql="INSERT INTO categories (name ,image_url,status) VALUES (?,?,?)";
      $stmt=$this->conn->prepare($sql);
      return $stmt->execute([$name,$image_url,$status]);
     
     }
     public function updateCategories($id,$name,$image_url,$status){
      $sql="UPDATE categories SET name= ?, image_url = ?, status = ? WHERE id= ?";
      $stmt=$this->conn->prepare($sql);
      return $stmt->execute([$name,$image_url,$status,$id]);

     }
     public function deleteCategories($id){
        $sql="DELETE FROM categories WHERE id=?";
        $stmt=$this->conn->prepare($sql);
        return $stmt->execute([$id]);
     }
     public function allcategoriesProducts($id){
      $sql="SELECT * FROM products WHERE category_id=?";
      $stmt=$this->conn->prepare($sql);
      $stmt->execute([$id]);
      return $stmt->fetchAll(PDO::FETCH_ASSOC);
     }
}
