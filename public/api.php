<?php
/**
 * REST API for MMP-CWC
 * Handles requests from React frontend and interacts with Hostinger MySQL Database.
 * Formats responses to mimic Firestore REST API to avoid modifying the frontend.
 */

// Handle CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json");

// ==========================================
// DATABASE CONFIGURATION (HOSTINGER MYSQL)
// ==========================================
$db_host = 'localhost';
$db_name = 'u485225710_mycomm_vidya';
$db_user = 'u485225710_comm_vdiya'; // UPDATE THIS IN HOSTINGER
$db_pass = 'Pindia@2025'; // UPDATE THIS IN HOSTINGER

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed. Please check credentials."]);
    exit;
}

// Ensure tables exist (using a simple Document Store model: id (VARCHAR) + data (JSON))
$tables = ['config', 'users', 'registrations', 'contacts', 'donations', 'volunteers', 'template_assets'];
foreach ($tables as $table) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `$table` (
        `id` VARCHAR(191) PRIMARY KEY,
        `data` LONGTEXT
    )");
}

// Parse the route
$request_uri = $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($request_uri, PHP_URL_PATH);
// Extract path after api.php/
$prefix = '/api.php/';
$route = '';
if (strpos($path, $prefix) !== false) {
    $route = substr($path, strpos($path, $prefix) + strlen($prefix));
} else {
    // If running via rewrite rules
    $route = ltrim($path, '/');
}

$parts = explode('/', trim($route, '/'));
$collection = $parts[0] ?? '';
$docId = $parts[1] ?? '';

// We map 'content/main' to collection 'config', id 'main'
if ($collection === 'content' && $docId === 'main') {
    $collection = 'config';
    $docId = 'main';
}

if (!$collection || !in_array($collection, $tables)) {
    http_response_code(404);
    echo json_encode(["error" => "Collection not found or invalid."]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

// Helper to convert PHP array to Firestore format
function arrayToFirestoreFields($array) {
    $fields = [];
    foreach ($array as $key => $value) {
        if (is_int($value)) {
            $fields[$key] = ['integerValue' => (string)$value];
        } elseif (is_bool($value)) {
            $fields[$key] = ['booleanValue' => $value];
        } elseif (is_array($value)) {
            // Nested arrays aren't fully mapped to mapValue in this simple mock unless needed,
            // we'll serialize to string for complex objects, or attempt a mapValue
            $fields[$key] = ['stringValue' => json_encode($value)];
        } else {
            $fields[$key] = ['stringValue' => (string)$value];
        }
    }
    return $fields;
}

// Helper to convert Firestore fields to PHP array
function firestoreFieldsToArray($fields) {
    if (!isset($fields['fields'])) return $fields; // Might already be plain
    $array = [];
    foreach ($fields['fields'] as $key => $val) {
        if (isset($val['stringValue'])) $array[$key] = $val['stringValue'];
        elseif (isset($val['integerValue'])) $array[$key] = (int)$val['integerValue'];
        elseif (isset($val['booleanValue'])) $array[$key] = (bool)$val['booleanValue'];
        else $array[$key] = array_values($val)[0] ?? null;
    }
    return $array;
}


if ($method === 'GET') {
    if ($docId) {
        // Fetch single document
        $stmt = $pdo->prepare("SELECT data FROM `$collection` WHERE id = ?");
        $stmt->execute([$docId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $data = json_decode($row['data'], true) ?: [];
            echo json_encode([
                "name" => "projects/mmp-cwc/databases/(default)/documents/$collection/$docId",
                "fields" => arrayToFirestoreFields($data)
            ]);
        } else {
            http_response_code(404);
            echo json_encode(["error" => "NOT_FOUND"]);
        }
    } else {
        // Fetch all documents
        $stmt = $pdo->query("SELECT id, data FROM `$collection`");
        $documents = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $data = json_decode($row['data'], true) ?: [];
            $documents[] = [
                "name" => "projects/mmp-cwc/databases/(default)/documents/$collection/" . $row['id'],
                "fields" => arrayToFirestoreFields($data)
            ];
        }
        echo json_encode(["documents" => $documents]);
    }
} elseif ($method === 'POST') {
    // Create new document (ID is usually generated if not provided, but Firestore REST uses POST for auto-id)
    $newId = $docId ?: uniqid();
    $dataToSave = firestoreFieldsToArray($input);
    
    $stmt = $pdo->prepare("INSERT INTO `$collection` (id, data) VALUES (?, ?)");
    $stmt->execute([$newId, json_encode($dataToSave)]);
    
    echo json_encode([
        "name" => "projects/mmp-cwc/databases/(default)/documents/$collection/$newId",
        "fields" => arrayToFirestoreFields($dataToSave)
    ]);
} elseif ($method === 'PATCH' || $method === 'PUT') {
    // Update existing document
    if (!$docId) {
        http_response_code(400);
        echo json_encode(["error" => "Document ID required for update"]);
        exit;
    }
    
    // Fetch existing
    $stmt = $pdo->prepare("SELECT data FROM `$collection` WHERE id = ?");
    $stmt->execute([$docId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $existingData = $row ? json_decode($row['data'], true) : [];
    $updateData = firestoreFieldsToArray($input);
    
    $mergedData = array_merge($existingData, $updateData);
    
    if ($row) {
        $stmt = $pdo->prepare("UPDATE `$collection` SET data = ? WHERE id = ?");
        $stmt->execute([json_encode($mergedData), $docId]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO `$collection` (id, data) VALUES (?, ?)");
        $stmt->execute([$docId, json_encode($mergedData)]);
    }
    
    echo json_encode([
        "name" => "projects/mmp-cwc/databases/(default)/documents/$collection/$docId",
        "fields" => arrayToFirestoreFields($mergedData)
    ]);
} elseif ($method === 'DELETE') {
    if ($docId) {
        $stmt = $pdo->prepare("DELETE FROM `$collection` WHERE id = ?");
        $stmt->execute([$docId]);
        echo json_encode(["success" => true]);
    } else {
        http_response_code(400);
        echo json_encode(["error" => "Document ID required for delete"]);
    }
}
