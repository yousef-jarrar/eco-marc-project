<?php
session_start();

$_SESSION["user_id"] = 1;
$_SESSION["role"] = "admin";
$_SESSION["csrf_token"] = bin2hex(random_bytes(32));

header("Content-Type: application/json");

echo json_encode([
    "success" => true,
    "csrf_token" => $_SESSION["csrf_token"]
]);