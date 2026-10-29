<?php
header("Content-Type: application/json; charset=utf-8");
require_once __DIR__ . "/../config/db.php";
require_once __DIR__ . "/../classes/Category.php";

try{
    $db=new Database();
    $category=new Category($db->connect());

    switch($_SERVER["REQUEST_METHOD"]){

    case "GET":

    if (isset($_GET["id"]) && isset($_GET["action"]) && $_GET["action"] == "products") {

        $id = $_GET["id"];

        $result = $category->allcategoriesProducts($id);

    } elseif (isset($_GET["id"])) {

        $id = $_GET["id"];

        $result = $category->getCategoriesById($id);

    } else {

        $result = $category->getAllCategories();

    }

    echo json_encode($result);

    break;
    case "POST":
        $data=json_decode(file_get_contents("php://input"),true);
        $name=$data["name"];
        $image_url=$data["image_url"] ?? null;
         
        $result=$category->creatCategories($name,$image_url);

       
        echo json_encode([
         "seccses"=>$result,
         "massage"=>"Category created successfully"
        ]);

        break;

    case "PUT":
        $data=json_decode(file_get_contents("php://input"),true);
        $id=$data["id"];
        $name=$data["name"];
        $image_url=$data["image_url"];

        $result = $category->updateCategories($id, $name, $image_url);
      
        
        
        echo json_encode([
         "seccses"=>$result,
         "massage"=>"Category update successfully"
        ]);

        break;

    case "DELETE":
       $data=json_decode(file_get_contents("php://input"),true);
       $id=$data["id"];
       
        $result = $category->deleteCategories($id);
        http_response_code(201);
        echo json_encode([
         "seccses"=>$result,
         "massage"=>"Category delete successfully"
        ]);

        break;
    default :
        http_response_code(405);
        echo json_encode([ 
        "seccess"=>false,
        "massage"=>" Method not allowed"
    ]);
    
    }
} catch(Throwable $e){
    http_response_code(500);
    echo json_encode([ 
    "seccess"=>false,
    "massage"=>" internal server error"
    ]);
}
?>