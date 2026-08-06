<?php
header("Access-Control-Allow-Origin: *");

$projectId = isset($_GET['projectId']) ? trim($_GET['projectId']) : '';

if (empty($projectId) || !preg_match('/^[a-f0-9\-]{36}$/i', $projectId)) {
    http_response_code(400);
    echo "Invalid projectId.";
    exit;
}

$outputBase = __DIR__ . '/../output/' . $projectId . '/';
$sourceDir = $outputBase . 'source/';
$zipFile = $outputBase . 'migrated_project.zip';

if (!is_dir($sourceDir)) {
    http_response_code(404);
    echo "Migrated project directory not found.";
    exit;
}

// Zip the folder dynamically
if (!file_exists($zipFile)) {
    if (!class_exists('ZipArchive')) {
        http_response_code(500);
        echo "ZipArchive extension missing in PHP server.";
        exit;
    }

    $zip = new ZipArchive();
    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
        http_response_code(500);
        echo "Failed to create ZIP package.";
        exit;
    }

    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($sourceDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($files as $file) {
        if (!$file->isDir()) {
            $filePath = $file->getRealPath();
            $relativePath = substr($filePath, strlen($sourceDir));
            $zip->addFile($filePath, $relativePath);
        }
    }
    $zip->close();
}

// Serve the zip file for download
if (file_exists($zipFile)) {
    header('Content-Description: File Transfer');
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="migrated_project_' . $projectId . '.zip"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    header('Content-Length: ' . filesize($zipFile));
    readfile($zipFile);
    exit;
} else {
    http_response_code(500);
    echo "Failed to locate generated ZIP package.";
    exit;
}
