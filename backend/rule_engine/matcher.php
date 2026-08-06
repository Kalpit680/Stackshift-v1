<?php

/**
 * Scan file content against loaded rules and return matches.
 *
 * @param string $content Code content of the file.
 * @param array $rules List of loaded rules.
 * @return array Matched violations in the file.
 */
function match_rules($content, $rules) {
    $matches = [];
    
    foreach ($rules as $rule) {
        $pattern = $rule['pattern'];
        
        // Find matching lines
        $lines = explode("\n", $content);
        foreach ($lines as $index => $line) {
            if (preg_match($pattern, $line)) {
                $lineNumber = $index + 1;
                $matches[] = [
                    "ruleId" => $rule['id'],
                    "ruleName" => $rule['name'],
                    "lineNumber" => $lineNumber,
                    "originalCode" => trim($line),
                    "confidence" => $rule['confidence'],
                    "description" => $rule['description'],
                    "rule" => $rule
                ];
            }
        }
    }
    
    return $matches;
}
