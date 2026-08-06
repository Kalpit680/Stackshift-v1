<?php

echo "=== CodeLift Pipeline Test Runner ===\n\n";

// 1. Create a mock legacy project structure
$testDir = __DIR__ . '/test_project_source/';
if (!is_dir($testDir)) {
    mkdir($testDir, 0777, true);
}

$dbCode = '<?php
$conn = mysql_connect("localhost", "root", "password");
mysql_select_db("users", $conn);
';

$loopCode = '<?php
$arr = ["a" => 1, "b" => 2];
while (list($key, $val) = each($arr)) {
    echo $key . " -> " . $val . "\n";
}
';

$utilsCode = '<?php
$parts = split(",", "one,two,three");
print_r($parts);
';

file_put_contents($testDir . 'db.php', $dbCode);
file_put_contents($testDir . 'loop.php', $loopCode);
file_put_contents($testDir . 'utils.php', $utilsCode);

echo "Created legacy project source files in: " . $testDir . "\n";

// 2. Package into a ZIP file
$zipFile = __DIR__ . '/test_legacy.zip';
if (file_exists($zipFile)) {
    unlink($zipFile);
}

$zip = new ZipArchive();
if ($zip->open($zipFile, ZipArchive::CREATE) !== TRUE) {
    die("Failed to create test ZIP file.\n");
}

$zip->addFile($testDir . 'db.php', 'db.php');
$zip->addFile($testDir . 'loop.php', 'loop.php');
$zip->addFile($testDir . 'utils.php', 'utils.php');
$zip->close();

echo "Packaged mock legacy project into ZIP: " . $zipFile . "\n";

// 3. Simulate upload.php
$_FILES['file'] = [
    'name' => 'test_legacy.zip',
    'type' => 'application/zip',
    'tmp_name' => $zipFile,
    'error' => UPLOAD_ERR_OK,
    'size' => filesize($zipFile)
];
$_POST['projectName'] = 'TestLegacyProject';
$_SERVER['REQUEST_METHOD'] = 'POST';

ob_start();
require __DIR__ . '/../api/upload.php';
$uploadOutput = ob_get_clean();

$uploadRes = json_decode($uploadOutput, true);
if (!$uploadRes || $uploadRes['status'] !== 'success') {
    die("Upload simulation failed: " . $uploadOutput . "\n");
}

$projectId = $uploadRes['projectId'];
echo "Upload Simulation Success! Project ID: " . $projectId . "\n";

// Reset global variables for next request
unset($_FILES);
unset($_POST);

// 4. Simulate scan.php
$_SERVER['REQUEST_METHOD'] = 'POST';
$scanInput = json_encode(["projectId" => $projectId]);

// Mock php://input content using stream wrapper or mock variables
// Since we are running in CLI, we can simulate php://input behavior by using a global helper, 
// or since api/scan.php reads php://input, let's write a small wrapper script or mock it.
// Wait! Let's temporarily rewrite scan.php to allow reading from a variable if php://input is empty,
// or let's create a scratch script that runs it, or let's write to a temporary file and pipe it.
// Actually, in PHP CLI, we can't easily mock php://input without stream_wrapper_register,
// but we can execute the API file in a subprocess using curl or PHP CLI with stdin!
// Let's execute using PHP CLI and stdin: `echo {"projectId": "UUID"} | php scan.php`
// This is extremely simple and elegant!

echo "\nExecuting Scan via CLI Subprocess...\n";
$cmdScan = 'echo ' . escapeshellarg($scanInput) . ' | php ' . escapeshellarg(__DIR__ . '/../api/scan.php');
$scanOutput = shell_exec($cmdScan);
$scanRes = json_decode($scanOutput, true);

if (!$scanRes || $scanRes['status'] !== 'success') {
    die("Scan simulation failed: " . $scanOutput . "\n");
}

echo "Scan Heuristics:\n";
echo "  - Detected PHP Version: " . $scanRes['detectedVersion'] . "\n";
echo "  - Detected Framework: " . $scanRes['detectedFramework'] . "\n";
echo "  - Total Files: " . $scanRes['totalFiles'] . "\n";
echo "  - PHP Files: " . $scanRes['phpFiles'] . "\n";
echo "  - Warnings Count: " . $scanRes['warningsCount'] . "\n";

// 5. Simulate migrate.php
$migrateInput = json_encode([
    "projectId" => $projectId,
    "targetVersion" => "7.4"
]);

echo "\nExecuting Migration via CLI Subprocess...\n";
$cmdMigrate = 'echo ' . escapeshellarg($migrateInput) . ' | php ' . escapeshellarg(__DIR__ . '/../api/migrate.php');
$migrateOutput = shell_exec($cmdMigrate);
$migrateRes = json_decode($migrateOutput, true);

if (!$migrateRes || $migrateRes['status'] !== 'success') {
    die("Migration simulation failed: " . $migrateOutput . "\n");
}

echo "Migration Performance:\n";
echo "  - Rules Applied: " . $migrateRes['rulesApplied'] . "\n";
echo "  - Confidence Score: " . $migrateRes['confidenceScore'] . "%\n";
echo "  - Modified Files Count: " . count($migrateRes['migratedFiles']) . "\n";

// 6. Verify migrated file contents
echo "\nVerifying Migrated Code Outputs:\n";
$outputSourceDir = __DIR__ . '/../../output/' . $projectId . '/source/';

$dbMigrated = file_get_contents($outputSourceDir . 'db.php');
$loopMigrated = file_get_contents($outputSourceDir . 'loop.php');
$utilsMigrated = file_get_contents($outputSourceDir . 'utils.php');

$dbStatus = (strpos($dbMigrated, 'mysqli_connect') !== false) ? "PASS" : "FAIL";
$loopStatus = (strpos($loopMigrated, 'foreach') !== false) ? "PASS" : "FAIL";
$utilsStatus = (strpos($utilsMigrated, 'explode') !== false) ? "PASS" : "FAIL";

echo "  - db.php (mysql_connect -> mysqli_connect): [" . $dbStatus . "]\n";
echo "  - loop.php (each() -> foreach): [" . $loopStatus . "]\n";
echo "  - utils.php (split() -> explode): [" . $utilsStatus . "]\n";

if ($dbStatus === "PASS" && $loopStatus === "PASS" && $utilsStatus === "PASS") {
    echo "\n=== ALL TESTS PASSED SUCCESSFULLY! ===\n";
} else {
    echo "\n=== SOME TESTS FAILED! ===\n";
}

// Clean up mock source folder and temporary ZIP
@unlink($zipFile);
// Helper to recursively remove dir
function delTree($dir) {
   $files = array_diff(scandir($dir), array('.','..'));
   foreach ($files as $file) {
     (is_dir("$dir/$file")) ? delTree("$dir/$file") : unlink("$dir/$file");
   }
   return rmdir($dir);
}
delTree($testDir);
