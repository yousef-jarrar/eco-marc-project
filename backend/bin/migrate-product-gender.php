<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../config/db.php';
$db=(new Database())->connect();
$columns=$db->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_COLUMN);
if(!in_array('gender',$columns,true)){
    $db->exec("ALTER TABLE products ADD COLUMN gender ENUM('men','women','unisex') NULL DEFAULT NULL AFTER category_id");
    echo "Product gender column added. Existing products remain unclassified.\n";
}else echo "Product gender column is already available.\n";
