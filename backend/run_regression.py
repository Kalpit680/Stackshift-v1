import json
import sys
import argparse

def main():
    parser = argparse.ArgumentParser(description="Regression test for StackShift migration coverage")
    parser.add_argument('--baseline', required=True, help="Path to the previous successful report JSON")
    parser.add_argument('--current', required=True, help="Path to the current report JSON")
    
    args = parser.parse_args()
    
    try:
        with open(args.baseline, 'r') as f:
            baseline = json.load(f)
        with open(args.current, 'r') as f:
            current = json.load(f)
    except Exception as e:
        print(f"Error reading JSON files: {e}")
        sys.exit(1)
        
    baseline_remaining = sum(baseline.get('remaining_apis', {}).values())
    current_remaining = sum(current.get('remaining_apis', {}).values())
    
    baseline_migrated = baseline.get('files_migrated', 0)
    current_migrated = current.get('files_migrated', 0)
    
    print(f"Baseline: Remaining APIs = {baseline_remaining}, Files Migrated = {baseline_migrated}")
    print(f"Current:  Remaining APIs = {current_remaining}, Files Migrated = {current_migrated}")
    
    if current_remaining > baseline_remaining:
        print("REGRESSION DETECTED: More legacy APIs remain than in the baseline.")
        sys.exit(1)
        
    if current_migrated < baseline_migrated:
        print("REGRESSION DETECTED: Fewer files were migrated than in the baseline.")
        sys.exit(1)
        
    print("Regression check passed. Coverage has not decreased.")
    sys.exit(0)

if __name__ == '__main__':
    main()
