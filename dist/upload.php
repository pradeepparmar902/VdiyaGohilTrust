<?php
/**
 * File Upload Handler for Hostinger
 * Receives raw binary file in the request body (as sent by the React app's fetch).
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get the requested file name from the query string
// The frontend passes ?name=logos/logo_123.png
$name = $_GET['name'] ?? null;
if (!$name) {
    http_response_code(400);
    echo json_encode(["error" => "No file name provided"]);
    exit;
}

// Security: Prevent directory traversal
$name = str_replace(['..', '\\'], '', $name);

// Define upload directory
$upload_dir = __DIR__ . '/uploads/';
$target_file = $upload_dir . ltrim($name, '/');

// Ensure the directory exists
$dir = dirname($target_file);
if (!file_exists($dir)) {
    mkdir($dir, 0755, true);
}

// Read raw data from request body
$input = fopen('php://input', 'r');
$fp = fopen($target_file, 'w');

if (!$input || !$fp) {
    http_response_code(500);
    echo json_encode(["error" => "Unable to write file"]);
    exit;
}

// Stream data to file
while ($data = fread($input, 1024)) {
    fwrite($fp, $data);
}

fclose($input);
fclose($fp);

// Get the base URL (e.g. https://www.mmp-cwc.com)
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
$domainName = $_SERVER['HTTP_HOST'];
$base_url = $protocol . $domainName;

// Return the downloadToken (mocked) to mimic Firebase format, although we won't need it.
echo json_encode([
    "name" => $name,
    "downloadTokens" => "mock-token-" . time()
]);
