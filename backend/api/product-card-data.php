<?php
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');
try{
    if(($_SERVER['REQUEST_METHOD']??'')!=='GET'){http_response_code(405);header('Allow: GET');echo json_encode(['success'=>false]);exit;}
    require_once __DIR__.'/../config/db.php';$db=(new Database())->connect();
    $data=$db->query("SELECT p.id,AVG(r.rating) AS average_rating,COUNT(r.id) AS review_count FROM products p JOIN reviews r ON r.product_id=p.id AND r.status='approved' WHERE p.is_active=1 GROUP BY p.id")->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success'=>true,'data'=>$data]);
}catch(Throwable $error){http_response_code(503);echo json_encode(['success'=>false,'message'=>'Product ratings are unavailable.']);}
