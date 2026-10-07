<?php
// migrate_storage.php
// RUN THIS ON YOUR HOSTINGER SERVER
header('Content-Type: text/html; charset=utf-8');

$db_host = 'localhost';
$db_name = 'u485225710_mycomm_vidya';
$db_user = 'u485225710_comm_vdiya'; // UPDATE THIS IN HOSTINGER
$db_pass = 'Pindia@2026'; // UPDATE THIS IN HOSTINGER


function getDb() {
    global $db_host, $db_name, $db_user, $db_pass;
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $pdo;
}

try {
    $pdo = getDb();
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

$tables = ['config', 'users', 'registrations', 'contacts', 'donations', 'volunteers', 'template_assets'];
$upload_dir = __DIR__ . '/uploads/firebase_migrated/';
if (!file_exists($upload_dir)) {
    mkdir($upload_dir, 0755, true);
}
$base_url = "https://vdiyagohilcharitabletrust.com/uploads/firebase_migrated/";

echo "<div style='font-family: sans-serif; padding: 20px;'>";
echo "<h2>Migrating Storage...</h2>";
echo "<p>Please do not close this tab. It will automatically refresh to avoid timeouts.</p>";
echo "<pre style='background:#f4f4f4; padding:10px; border:1px solid #ccc;'>";

function processNode($node, &$changed) {
    global $upload_dir, $base_url;
    if (is_array($node)) {
        foreach ($node as $key => &$value) {
            $value = processNode($value, $changed);
        }
        return $node;
    } else if (is_string($node)) {
        $trimmed = trim($node);
        if ((strpos($trimmed, '{') === 0 || strpos($trimmed, '[') === 0)) {
            $decoded = json_decode($node, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $innerChanged = false;
                $processed = processNode($decoded, $innerChanged);
                if ($innerChanged) {
                    $changed = true;
                    return json_encode($processed, JSON_UNESCAPED_SLASHES); 
                }
                return $node;
            }
        }
        if (strpos($node, 'firebasestorage.googleapis.com') !== false) {
            $node = preg_replace_callback('/https:\/\/firebasestorage\.googleapis\.com[^\s"\'\\\\]+/', function($matches) use (&$changed, $upload_dir, $base_url) {
                $url = $matches[0];
                echo "Downloading: " . basename($url) . "...\n";
                $hash = md5($url);
                $ext = '.bin';
                if (stripos($url, '.jpg') !== false || stripos($url, '%2Ejpg') !== false) $ext = '.jpg';
                elseif (stripos($url, '.png') !== false || stripos($url, '%2Epng') !== false) $ext = '.png';
                elseif (stripos($url, '.pdf') !== false || stripos($url, '%2Epdf') !== false) $ext = '.pdf';
                elseif (stripos($url, '.jpeg') !== false || stripos($url, '%2Ejpeg') !== false) $ext = '.jpeg';
                
                $filename = $hash . $ext;
                $localPath = $upload_dir . $filename;
                $newUrl = $base_url . $filename;
                
                if (!file_exists($localPath)) {
                    $fileContent = @file_get_contents($url);
                    if ($fileContent) {
                        file_put_contents($localPath, $fileContent);
                        $changed = true;
                        return $newUrl;
                    } else {
                        echo "FAILED to download\n";
                        $changed = true;
                        return $newUrl;
                    }
                } else {
                    $changed = true;
                    return $newUrl;
                }
            }, $node);
        }
        return $node;
    }
    return $node;
}

$recordsProcessedThisBatch = 0;
$maxPerBatch = 5; // Process 5 records at a time to prevent 504 Timeout
$hasMore = false;

foreach ($tables as $table) {
    if ($recordsProcessedThisBatch >= $maxPerBatch) {
        $hasMore = true;
        break;
    }
    
    try {
        // Find rows that still have Firebase URLs
        $stmt = $pdo->prepare("SELECT id, data FROM `$table` WHERE data LIKE '%firebasestorage.googleapis.com%' LIMIT " . ($maxPerBatch - $recordsProcessedThisBatch));
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($rows as $row) {
            $id = $row['id'];
            $rawData = $row['data'];
            echo "Processing $table ID: $id\n";
            
            $decoded = json_decode($rawData, true);
            $changed = false;
            $newRawData = null;

            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $processed = processNode($decoded, $changed);
                if ($changed) {
                    $newRawData = json_encode($processed, JSON_UNESCAPED_SLASHES);
                }
            } else {
                if (strpos($rawData, 'firebasestorage.googleapis.com') !== false) {
                     $processed = processNode($rawData, $changed);
                     if ($changed) {
                         $newRawData = $processed;
                     }
                }
            }

            if ($changed && $newRawData !== null) {
                $updateStmt = $pdo->prepare("UPDATE `$table` SET data = ? WHERE id = ?");
                $updateStmt->execute([$newRawData, $id]);
                echo "Saved $table ID: $id to database.\n\n";
            }
            $recordsProcessedThisBatch++;
        }
        
        // If we found rows in this table but haven't hit the limit, there might be more in other tables
        // But if we hit the limit, we know there's more.
    } catch (Exception $e) {
        echo "Error in table $table: " . $e->getMessage() . "\n";
    }
}

echo "</pre>";

// Check if any tables still have remaining records
$remainingCount = 0;
foreach ($tables as $table) {
    $stmt = $pdo->query("SELECT COUNT(*) FROM `$table` WHERE data LIKE '%firebasestorage.googleapis.com%'");
    $remainingCount += $stmt->fetchColumn();
}

if ($remainingCount > 0) {
    echo "<h3>$remainingCount records remaining to process. Reloading page automatically...</h3>";
    echo "<script>setTimeout(function() { window.location.reload(); }, 2000);</script>";
} else {
    echo "<h3 style='color:green;'>Migration complete! 100% disconnected from Firebase Storage.</h3>";
    echo "<p>You can now delete this script.</p>";
}
echo "</div>";
?>

