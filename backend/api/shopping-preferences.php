<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
http_response_code(410);
echo json_encode(['success'=>false,'message'=>'This feature is no longer available.']);
