<?php
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
try{
    require_once __DIR__.'/../middleware/admin.php';require_once __DIR__.'/../middleware/csrf.php';require_once __DIR__.'/../classes/ShoppingData.php';
    $user=requireUser();$store=new ShoppingData((new Database())->connect());$method=$_SERVER['REQUEST_METHOD'];
    if($method==='GET')$result=$store->preferences((int)$user['id']);
    elseif($method==='PUT'){
        requireCsrf();$raw=file_get_contents('php://input',false,null,0,4001);$data=json_decode($raw,true);
        if(strlen($raw)>4000||!is_array($data))throw new InvalidArgumentException('Invalid preferences.');
        $result=$store->savePreferences((int)$user['id'],$data);
    }elseif($method==='DELETE'){requireCsrf();$store->deletePreferences((int)$user['id']);$result=null;}
    else{http_response_code(405);header('Allow: GET, PUT, DELETE');echo json_encode(['success'=>false,'message'=>'Method not allowed.']);exit;}
    echo json_encode(['success'=>true,'preferences'=>$result]);
}catch(InvalidArgumentException $error){http_response_code(400);echo json_encode(['success'=>false,'message'=>$error->getMessage()]);}
catch(Throwable $error){http_response_code(503);echo json_encode(['success'=>false,'message'=>'Shopping preferences are unavailable.']);}
