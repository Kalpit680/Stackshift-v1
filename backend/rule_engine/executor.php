<?php

/**
 * Copy files from source to destination directory recursively.
 */
function recurse_copy($src, $dst) {
    $dir = opendir($src);
    @mkdir($dst, 0777, true);
    while (false !== ($file = readdir($dir))) {
        if (($file != '.') && ($file != '..')) {
            if (is_dir($src . '/' . $file)) {
                recurse_copy($src . '/' . $file, $dst . '/' . $file);
            } else {
                copy($src . '/' . $file, $dst . '/' . $file);
            }
        }
    }
    closedir($dir);
}

/**
 * Execute transformations on a project.
 *
 * @param string $sourceDir Directory containing extracted original source files.
 * @param string $outputDir Directory where modified files should be saved.
 * @param array $rules List of loaded rules.
 * @return array Stats on migration and file-by-file changes including diffs.
 */
function execute_migration($sourceDir, $outputDir, $rules) {
    $sourceDir = rtrim($sourceDir, '/') . '/';
    $outputDir = rtrim($outputDir, '/') . '/';

    // 1. Copy everything to output dir
    recurse_copy($sourceDir, $outputDir);

    $migratedFiles = [];
    $rulesAppliedCount = 0;
    
    // Find all files in the output directory
    $dirIterator = new RecursiveDirectoryIterator($outputDir, RecursiveDirectoryIterator::SKIP_DOTS);
    $iterator = new RecursiveIteratorIterator($dirIterator, RecursiveIteratorIterator::SELF_FIRST);

    foreach ($iterator as $file) {
        if ($file->isFile() && strtolower($file->getExtension()) === 'php') {
            $realPath = $file->getRealPath();
            $relPath = substr($realPath, strlen($outputDir));
            
            $originalContent = file_get_contents($sourceDir . $relPath);
            $modifiedContent = $originalContent;
            
            $fileRulesApplied = [];
            $diffLines = [];

            foreach ($rules as $rule) {
                $pattern = $rule['pattern'];
                
                // Let's check if the pattern matches before we replace
                if (preg_match($pattern, $modifiedContent)) {
                    $fileRulesApplied[] = $rule['id'];
                    $rulesAppliedCount++;

                    // Simple replacement
                    if ($rule['type'] === 'each_replace') {
                        // Regex replacement for each() loop structures
                        $modifiedContent = preg_replace($pattern, $rule['replacement'], $modifiedContent);
                    } else {
                        // Function name replacement
                        $modifiedContent = preg_replace($pattern, $rule['replacement'], $modifiedContent);
                    }
                }
            }

            if ($modifiedContent !== $originalContent) {
                // Write back modified content
                file_put_contents($realPath, $modifiedContent);

                // Generate simple diff representation
                $origLines = explode("\n", $originalContent);
                $modLines = explode("\n", $modifiedContent);
                
                $diff = "";
                $maxLines = max(count($origLines), count($modLines));
                
                // Construct basic unified-like diff format
                $inDiffContext = false;
                for ($i = 0; $i < $maxLines; $i++) {
                    $orig = isset($origLines[$i]) ? $origLines[$i] : null;
                    $mod = isset($modLines[$i]) ? $modLines[$i] : null;
                    
                    if ($orig !== $mod) {
                        $lineNum = $i + 1;
                        if ($orig !== null) {
                            $diff .= "@@ -{$lineNum} +{$lineNum} @@\n";
                            $diff .= "- " . $orig . "\n";
                        }
                        if ($mod !== null) {
                            if ($orig === null) {
                                $diff .= "@@ -{$lineNum} +{$lineNum} @@\n";
                            }
                            $diff .= "+ " . $mod . "\n";
                        }
                    }
                }

                $migratedFiles[] = [
                    "filePath" => $relPath,
                    "appliedRules" => array_unique($fileRulesApplied),
                    "diff" => $diff
                ];
            }
        }
    }

    return [
        "rulesApplied" => $rulesAppliedCount,
        "migratedFiles" => $migratedFiles
    ];
}
