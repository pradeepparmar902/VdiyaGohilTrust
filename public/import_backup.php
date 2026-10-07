<?php
/**
 * Script to import Firebase JSON backup into Hostinger MySQL Database.
 * RUN ONCE ON HOSTINGER, THEN DELETE THIS FILE.
 */

$db_host = 'localhost';
$db_name = 'u485225710_mycomm_vidya';
$db_user = 'u485225710_comm_vdiya'; // UPDATE THIS IN HOSTINGER
$db_pass = 'Pindia@2026'; // UPDATE THIS IN HOSTINGER

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Database connection failed. Please check credentials.");
}

// Ensure tables exist
$tables = ['config', 'users', 'registrations', 'contacts', 'donations', 'volunteers', 'template_assets'];
foreach ($tables as $table) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `$table` (
        `id` VARCHAR(191) PRIMARY KEY,
        `data` LONGTEXT
    )");
}

$backup_file = 'backup.json';

if (!file_exists($backup_file)) {
    die("Backup file not found. Please upload backup.json to the same folder as this script.");
}

$json_data = file_get_contents($backup_file);
$backup = json_decode($json_data, true);

if (!$backup) {
    die("Invalid JSON format in backup file.");
}

$stats = [];

foreach ($backup as $collection => $documents) {
    if ($collection === 'config') {
        // Wrap the config object in 'data' so api.php returns it correctly for React
        $wrappedConfig = ['data' => json_encode($documents)];
        $stmt = $pdo->prepare("REPLACE INTO `config` (id, data) VALUES (?, ?)");
        $stmt->execute(['main', json_encode($wrappedConfig)]);
        $stats['config'] = 1;
    } elseif ($collection === 'collections') {
        // Handle nested collections
        foreach ($documents as $sub_collection => $sub_documents) {
            if (in_array($sub_collection, $tables)) {
                $count = 0;
                $stmt = $pdo->prepare("REPLACE INTO `$sub_collection` (id, data) VALUES (?, ?)");
                foreach ($sub_documents as $key => $doc) {
                    $id = $doc['id'] ?? $key;
                    // Wrap the document in 'data' property
                    $wrappedDoc = ['data' => json_encode($doc)];
                    if (isset($doc['_submittedAt'])) $wrappedDoc['submittedAt'] = $doc['_submittedAt'];
                    elseif (isset($doc['submittedAt'])) $wrappedDoc['submittedAt'] = $doc['submittedAt'];
                    $stmt->execute([$id, json_encode($wrappedDoc)]);
                    $count++;
                }
                $stats[$sub_collection] = $count;
            }
        }
    } elseif (in_array($collection, $tables)) {
        $count = 0;
        $stmt = $pdo->prepare("REPLACE INTO `$collection` (id, data) VALUES (?, ?)");
        foreach ($documents as $key => $doc) {
            $id = $doc['id'] ?? $key;
            $wrappedDoc = ['data' => json_encode($doc)];
            if (isset($doc['_submittedAt'])) $wrappedDoc['submittedAt'] = $doc['_submittedAt'];
            elseif (isset($doc['submittedAt'])) $wrappedDoc['submittedAt'] = $doc['submittedAt'];
            $stmt->execute([$id, json_encode($wrappedDoc)]);
            $count++;
        }
        $stats[$collection] = $count;
    }
}

echo "<h1>Import Successful</h1><ul>";
foreach ($stats as $collection => $count) {
    echo "<li>Imported $count records into <strong>$collection</strong></li>";
}
echo "</ul><p><b>IMPORTANT:</b> Please delete this file (import_backup.php) and the backup JSON file from your server for security.</p>";
