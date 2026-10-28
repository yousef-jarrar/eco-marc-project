<?php
header("Content-Type: application/json; charset=utf-8");
require_once __DIR__ . "/../config/db.php";
require_once __DIR__ . "/../classes/Settings.php";

try{
    $db=new Database();
    $settings=new Settings($db->connect());

    switch($_SERVER["REQUEST_METHOD"]){

    case "GET":
        $result=$settings->getSettings();
        echo json_encode($result);
        break;

    case "PUT":
        $data=json_decode(file_get_contents("php://input"),true);
        $delivery_fee=$data["delivery_fee"];
        $free_delivery_at=$data["free_delivery_at"];

        $result = $settings->updateSettings( $delivery_fee, $free_delivery_at);
      
        
        
        echo json_encode([
         "seccses"=>$result,
         "massage"=>"Settings update successfully"
        ]);

        break;
        
         default :
        http_response_code(405);
        echo json_encode([ 
        "seccess"=>false,
        "massage"=>" Method not allowed"
    ]);
        break;
    }

    } catch(Throwable $e){
      
    http_response_code(500);
      
      echo json_encode([ 
      
      "seccess"=>false,
      
      "massage"=>" internal server error"
      
      ]);
}