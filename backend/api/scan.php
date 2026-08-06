<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed. Use POST."]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);
$projectId = isset($input['projectId']) ? trim($input['projectId']) : '';

if (empty($projectId) || !preg_match('/^[a-f0-9\-]{36}$/i', $projectId)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid or missing projectId."]);
    exit;
}

$projectDir = __DIR__ . '/../uploads/' . $projectId . '/';
$metaFile = $projectDir . 'metadata.json';

if (!file_exists($metaFile)) {
    http_response_code(404);
    echo json_encode(["status" => "error", "message" => "Project not found or not uploaded."]);
    exit;
}

$meta = json_decode(file_get_contents($metaFile), true);
$extractDir = $meta['extractDir'];

if (!is_dir($extractDir)) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Project source directory does not exist."]);
    exit;
}

require_once __DIR__ . '/../scanner/detector.php';
require_once __DIR__ . '/../scanner/version_detector.php';

// Traverse files and gather metrics
$totalFiles = 0;
$phpFiles = 0;
$fileList = [];

$dirIterator = new RecursiveDirectoryIterator($extractDir, RecursiveDirectoryIterator::SKIP_DOTS);
$iterator = new RecursiveIteratorIterator($dirIterator, RecursiveIteratorIterator::SELF_FIRST);

foreach ($iterator as $file) {
    if ($file->isFile()) {
        $totalFiles++;
        $ext = strtolower($file->getExtension());
        if ($ext === 'php') {
            $phpFiles++;
            // Save relative paths
            $fileList[] = substr($file->getRealPath(), strlen($extractDir));
        }
    }
}

$detectedFramework = detect_framework($extractDir);
$detectedVersion = detect_php_version($extractDir);

// Simple target version logic: if we are below 7.0, target 7.4. If we are on 7.x, target 8.2.
$targetVersion = (floatval($detectedVersion) < 7.0) ? '7.4' : '8.2';

// Count how many compatibility warnings/issues we can find (mock scan heuristic for rules)
// Let's do a quick regex search for mysql_connect, each, split, ereg, etc.
$warningsCount = 0;
$scanFindings = [];

foreach ($fileList as $relPath) {
    $absPath = $extractDir . $relPath;
    $content = file_get_contents($absPath);
    
    // Check for mysql_connect
    if (strpos($content, 'mysql_connect') !== false) {
        $warningsCount++;
        $scanFindings[] = [
            "file" => $relPath,
            "type" => "deprecation",
            "message" => "Use of deprecated mysql_connect() function.",
            "ruleId" => "PHP5_DEP_MYSQL_CONNECT"
        ];
    }
    
    // Check for each() function
    if (preg_match('/\beach\s*\(/i', $content)) {
        $warningsCount++;
        $scanFindings[] = [
            "file" => $relPath,
            "type" => "deprecation",
            "message" => "Use of deprecated each() function.",
            "ruleId" => "PHP7_DEP_EACH"
        ];
    }

    // Check for split() function
    if (preg_match('/\bsplit\s*\(/i', $content)) {
        $warningsCount++;
        $scanFindings[] = [
            "file" => $relPath,
            "type" => "deprecation",
            "message" => "Use of deprecated split() function.",
            "ruleId" => "PHP7_DEP_SPLIT"
        ];
    }
}

$scanResults = [
    "projectId" => $projectId,
    "projectName" => $meta['name'],
    "detectedLanguage" => "PHP",
    "detectedVersion" => $detectedVersion,
    "detectedFramework" => $detectedFramework,
    "targetVersion" => $targetVersion,
    "totalFiles" => $totalFiles,
    "phpFiles" => $phpFiles,
    "warningsCount" => $warningsCount,
    "findings" => $scanFindings
];

// Save scan results for migration phase
file_put_contents($projectDir . 'scan_results.json', json_encode($scanResults, JSON_PRETTY_PRINT));

echo json_encode([
    "status" => "success",
    "projectId" => $projectId,
    "projectName" => $meta['name'],
    "detectedLanguage" => "PHP",
    "detectedVersion" => $detectedVersion,
    "detectedFramework" => $detectedFramework,
    "targetVersion" => $targetVersion,
    "totalFiles" => $totalFiles,
    "phpFiles" => $phpFiles,
    "warningsCount" => $warningsCount
]);
