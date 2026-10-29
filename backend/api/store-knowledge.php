<?php
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
try{
    require_once __DIR__.'/../middleware/admin.php';require_once __DIR__.'/../middleware/csrf.php';require_once __DIR__.'/../classes/ShoppingData.php';
    requireAdmin();$db=(new Database())->connect();$store=new ShoppingData($db);$method=$_SERVER['REQUEST_METHOD'];
    $productId=null;
    if(isset($_GET['product_id'])){
        $productId=filter_var($_GET['product_id'],FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
        if(!$productId)throw new InvalidArgumentException('Invalid product.');
    }
    if($method==='GET'){
        $result=$productId===null?$store->knowledge():$store->productDetails($productId);
        $result['products']=$db->query('SELECT id,name FROM products WHERE is_active=1 ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);
    }elseif($method==='PUT'){
        requireCsrf();$raw=file_get_contents('php://input',false,null,0,50001);$data=json_decode($raw,true);
        if(strlen($raw)>50000||!is_array($data))throw new InvalidArgumentException('Use valid knowledge data.');
        $store->saveKnowledge($data,$productId);$result=['message'=>'Knowledge saved. Only reviewed facts are used by the assistant.'];
    }else{http_response_code(405);header('Allow: GET, PUT');echo json_encode(['success'=>false,'message'=>'Method not allowed.']);exit;}
    echo json_encode(['success'=>true]+$result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(InvalidArgumentException $error){http_response_code(400);echo json_encode(['success'=>false,'message'=>$error->getMessage()]);}
catch(Throwable $error){http_response_code(503);echo json_encode(['success'=>false,'message'=>'Store knowledge is unavailable.']);}
