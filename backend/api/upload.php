<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

function generate_uuid() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Method not allowed. Use POST."]);
    exit;
}

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "No file uploaded. Please upload a ZIP file."]);
    exit;
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "File upload error code: " . $file['error']]);
    exit;
}

$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
if (strtolower($ext) !== 'zip') {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Only ZIP files are supported."]);
    exit;
}

$projectName = isset($_POST['projectName']) ? trim($_POST['projectName']) : 'Unnamed Project';
$projectId = generate_uuid();

$uploadDir = __DIR__ . '/../uploads/' . $projectId . '/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$zipPath = $uploadDir . 'project.zip';
if (!move_uploaded_file($file['tmp_name'], $zipPath)) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to save uploaded file."]);
    exit;
}

// Include unzip helper to unpack the archive
require_once __DIR__ . '/../scanner/unzip.php';
$extractDir = $uploadDir . 'source/';

if (!unzip_project($zipPath, $extractDir)) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Failed to extract ZIP archive."]);
    exit;
}

// Save project metadata to a file for scanner reference
$projectMeta = [
    "projectId" => $projectId,
    "name" => $projectName,
    "uploadedAt" => date('Y-m-d H:i:s'),
    "zipPath" => $zipPath,
    "extractDir" => $extractDir
];
file_put_contents($uploadDir . 'metadata.json', json_encode($projectMeta, JSON_PRETTY_PRINT));

echo json_encode([
    "status" => "success",
    "projectId" => $projectId,
    "projectName" => $projectName,
    "message" => "File uploaded and extracted successfully."
]);
