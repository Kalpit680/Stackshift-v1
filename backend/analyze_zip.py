import zipfile
import sys
import os
import json
import re


def analyze_zip(zip_path):
    res = _analyze_zip_internal(zip_path)  # type: ignore
    total_files = 0
    total_lines = 0
    language_distribution = {}
    if os.path.exists(zip_path):
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                namelist = zip_ref.namelist()
                files = [f for f in namelist if not f.endswith('/')]
                total_files = len(files)

                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    lang = "Other"
                    if ext in ['.php', '.phtml']:
                        lang = "PHP"
                    elif ext in ['.js', '.jsx', '.mjs', '.cjs']:
                        lang = "JavaScript"
                    elif ext in ['.ts', '.tsx']:
                        lang = "TypeScript"
                    elif ext in ['.py']:
                        lang = "Python"
                    elif ext in ['.html', '.htm']:
                        lang = "HTML"
                    elif ext in ['.css']:
                        lang = "CSS"
                    elif ext in ['.json']:
                        lang = "JSON"
                    elif ext in ['.java']:
                        lang = "Java"
                    elif ext in ['.cs']:
                        lang = "C#"
                    elif ext in ['.vb']:
                        lang = "VB.NET"
                    elif ext in ['.cpp', '.cc', '.c', '.h']:
                        lang = "C/C++"

                    language_distribution[lang] = language_distribution.get(lang, 0) + 1

                    try:
                        with zip_ref.open(f) as zf:
                            cnt = zf.read().decode('utf-8', errors='ignore')
                            total_lines += len(cnt.splitlines())
                    except Exception:
                        pass
        except Exception:
            pass

    res["total_files"] = total_files  # type: ignore
    res["total_lines"] = total_lines  # type: ignore
    res["languages"] = language_distribution  # type: ignore
    return res


def _analyze_zip_internal(zip_path):
    if not os.path.exists(zip_path):
        return {
            "technology": "PHP",
            "current_version": "PHP 5.6",
            "target_version": "PHP 7.4 (Recommended)",
            "framework": "No framework",
            "framework_options": ["Laravel", "Symfony", "WordPress", "Core PHP", "No framework"],
            "supported_versions": ["PHP 5.6", "PHP 7.0", "PHP 7.1", "PHP 7.2", "PHP 7.3", "PHP 7.4", "PHP 8.0", "PHP 8.1", "PHP 8.2", "PHP 8.3", "PHP 8.4"],
            "migration_candidates": []
        }

    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            namelist = zip_ref.namelist()

            def has_file(name):
                return any(name in f for f in namelist)

            breaking_changes = 0
            migration_candidates = []
            for pf in namelist:
                if pf.endswith('/') or any(exclude in pf for exclude in ['node_modules', '.git', 'vendor']):
                    continue
                ext = os.path.splitext(pf)[1].lower()
                if ext not in ['.php', '.py', '.js', '.jsx', '.ts', '.tsx', '.cs', '.vb']:
                    continue
                try:
                    with zip_ref.open(pf) as f:
                        content = f.read().decode('utf-8', errors='ignore')
                    if ext == '.php':
                        mysql_matches = len(re.findall(r'\bmysql_[a-zA-Z0-9_]+', content))
                        ereg_matches = len(re.findall(r'\b(ereg|eregi|ereg_replace|eregi_replace)\b', content))
                        split_matches = len(re.findall(r'\b(split|spliti)\b', content))
                        each_matches = len(re.findall(r'\beach\s*\(', content))
                        create_function_matches = len(re.findall(r'\bcreate_function\s*\(', content))
                        breaking_changes += mysql_matches + ereg_matches + split_matches + each_matches + create_function_matches
                        if mysql_matches or ereg_matches or split_matches or each_matches or create_function_matches:
                            migration_candidates.append({
                                'path': pf,
                                'reason': 'Contains deprecated PHP syntax that should be modernized',
                                'category': 'PHP compatibility'
                            })
                    elif ext == '.py':
                        print_matches = len(re.findall(r'^\s*print\s+["\'][^"\']+["\']', content, re.MULTILINE))
                        xrange_matches = len(re.findall(r'\bxrange\b', content))
                        raw_input_matches = len(re.findall(r'\braw_input\b', content))
                        breaking_changes += print_matches + xrange_matches + raw_input_matches
                        if print_matches or xrange_matches or raw_input_matches:
                            migration_candidates.append({
                                'path': pf,
                                'reason': 'Contains Python 2-era syntax',
                                'category': 'Python compatibility'
                            })
                    elif ext in ['.js', '.jsx']:
                        var_matches = len(re.findall(r'\bvar\b', content))
                        doc_write_matches = len(re.findall(r'\bdocument\.write\b', content))
                        breaking_changes += (var_matches // 15 + doc_write_matches)
                        if var_matches or doc_write_matches:
                            migration_candidates.append({
                                'path': pf,
                                'reason': 'Contains legacy JS patterns',
                                'category': 'JavaScript compatibility'
                            })
                except Exception:
                    continue

            score = max(34, 100 - (breaking_changes * 8))
            if breaking_changes == 0:
                score = 98
                complexity = 'Low'
                risk = 'Low'
            elif breaking_changes <= 3:
                complexity = 'Medium'
                risk = 'Low' if breaking_changes <= 2 else 'Medium'
            else:
                complexity = 'High'
                risk = 'Medium' if breaking_changes <= 5 else 'High'

            if has_file('composer.json') or has_file('wp-config.php') or has_file('artisan') or any(f.endswith('.php') for f in namelist):
                tech = 'PHP'
                current = 'PHP 5.6'
                target = 'PHP 7.4 (Recommended)'
                framework = 'No framework'

                composer_path = [f for f in namelist if f.endswith('composer.json')]
                if composer_path:
                    try:
                        with zip_ref.open(composer_path[0]) as f:
                            composer_data = json.loads(f.read().decode('utf-8', errors='ignore'))
                        php_req = composer_data.get('require', {}).get('php', '')
                        match = re.search(r'(\d+\.\d+)', php_req)
                        if match:
                            current = f"PHP {match.group(1)}"
                            if float(match.group(1)) >= 7.0:
                                target = 'PHP 8.2 (Recommended)'
                        if 'laravel' in str(composer_data.get('require', {})).lower():
                            framework = 'Laravel'
                        elif 'symfony' in str(composer_data.get('require', {})).lower():
                            framework = 'Symfony'
                    except Exception:
                        pass
                else:
                    php_files = [f for f in namelist if f.endswith('.php')][:10]
                    for pf in php_files:
                        try:
                            with zip_ref.open(pf) as f:
                                content = f.read().decode('utf-8', errors='ignore')
                            if 'mysql_connect' in content:
                                current = 'PHP 5.6'
                                target = 'PHP 7.4 (Recommended)'
                                break
                        except Exception:
                            continue

                if has_file('wp-config.php') or has_file('wp-admin') or has_file('wp-includes'):
                    framework = 'WordPress'
                elif has_file('artisan'):
                    framework = 'Laravel'
                elif has_file('vendor/symfony') or has_file('symfony.lock'):
                    framework = 'Symfony'
                elif any(f.endswith('.php') for f in namelist):
                    framework = 'Core PHP' if framework == 'No framework' else framework

                return {
                    'technology': tech,
                    'current_version': current,
                    'target_version': target,
                    'framework': framework,
                    'framework_options': ['Laravel', 'Symfony', 'WordPress', 'Core PHP', 'No framework'],
                    'supported_versions': ['PHP 5.6', 'PHP 7.0', 'PHP 7.1', 'PHP 7.2', 'PHP 7.3', 'PHP 7.4', 'PHP 8.0', 'PHP 8.1', 'PHP 8.2', 'PHP 8.3', 'PHP 8.4'],
                    'migration_candidates': migration_candidates[:12],
                    'score': score,
                    'complexity': complexity,
                    'risk': risk,
                    'breaking_changes': breaking_changes
                }

            if has_file('package.json'):
                if has_file('angular.json') or any('app.module.ts' in f for f in namelist):
                    return {
                        'technology': 'Angular',
                        'current_version': 'Angular 8',
                        'target_version': 'Angular 18 (Recommended)',
                        'framework': 'Angular CLI',
                        'framework_options': ['Angular CLI', 'Nx Monorepo', 'Vanilla Angular', 'No framework'],
                        'supported_versions': ['Angular 14', 'Angular 16', 'Angular 18'],
                        'migration_candidates': migration_candidates[:12],
                        'score': score,
                        'complexity': complexity,
                        'risk': risk,
                        'breaking_changes': breaking_changes
                    }

                tech = 'Node.js'
                current = 'Node 12'
                target = 'Node 20 (Recommended)'
                try:
                    package_path = [f for f in namelist if f.endswith('package.json')][0]
                    with zip_ref.open(package_path) as f:
                        pkg_data = json.loads(f.read().decode('utf-8', errors='ignore'))
                    node_req = pkg_data.get('engines', {}).get('node', '')
                    match = re.search(r'(\d+)', node_req)
                    if match:
                        current = f'Node {match.group(1)}'
                        if int(match.group(1)) >= 16:
                            target = 'Node 20 (Recommended)'
                except Exception:
                    pass

                return {
                    'technology': tech,
                    'current_version': current,
                    'target_version': target,
                    'framework': 'Express',
                    'framework_options': ['Express', 'NestJS', 'Next.js', 'Vanilla Node', 'No framework'],
                    'supported_versions': ['Node 16', 'Node 18', 'Node 20'],
                    'migration_candidates': migration_candidates[:12],
                    'score': score,
                    'complexity': complexity,
                    'risk': risk,
                    'breaking_changes': breaking_changes
                }

            if any(f.endswith('.py') for f in namelist) or has_file('requirements.txt') or has_file('Pipfile'):
                return {
                    'technology': 'Python',
                    'current_version': 'Python 2.7',
                    'target_version': 'Python 3.10+ (Recommended)',
                    'framework': 'No framework',
                    'framework_options': ['Flask', 'Django', 'FastAPI', 'No framework'],
                    'supported_versions': ['Python 3.8', 'Python 3.10', 'Python 3.12'],
                    'migration_candidates': migration_candidates[:12],
                    'score': score,
                    'complexity': complexity,
                    'risk': risk,
                    'breaking_changes': breaking_changes
                }

            if any(f.endswith('.vb') for f in namelist):
                return {
                    'technology': 'VB.NET',
                    'current_version': 'VB.NET 2010',
                    'target_version': '.NET 8 (VB) (Recommended)',
                    'framework': 'WinForms',
                    'framework_options': ['WinForms', 'WPF', 'ASP.NET WebForms', 'No framework'],
                    'supported_versions': ['.NET 6', '.NET 7', '.NET 8'],
                    'migration_candidates': migration_candidates[:12],
                    'score': score,
                    'complexity': complexity,
                    'risk': risk,
                    'breaking_changes': breaking_changes
                }

            if any(f.endswith('.csproj') or f.endswith('.sln') for f in namelist) or has_file('Web.config'):
                return {
                    'technology': '.NET',
                    'current_version': '.NET Framework 4.5',
                    'target_version': '.NET 8 (Recommended)',
                    'framework': 'ASP.NET MVC',
                    'framework_options': ['ASP.NET MVC', 'ASP.NET Core', 'WPF / WinForms', 'No framework'],
                    'supported_versions': ['.NET 6', '.NET 7', '.NET 8'],
                    'migration_candidates': migration_candidates[:12],
                    'score': score,
                    'complexity': complexity,
                    'risk': risk,
                    'breaking_changes': breaking_changes
                }

    except Exception:
        pass

    return {
        'technology': 'unknown',
        'current_version': 'unknown',
        'target_version': 'unknown',
        'framework': 'No framework',
        'framework_options': ['No framework'],
        'supported_versions': ['Unknown'],
        'migration_candidates': [],
        'score': 100,
        'complexity': 'Low',
        'risk': 'Low',
        'breaking_changes': 0
    }


if __name__ == '__main__':
    if len(sys.argv) > 1:
        zip_path = sys.argv[1]
        res = analyze_zip(zip_path)
        print(json.dumps(res))
    else:
        print(json.dumps({
            'technology': 'unknown',
            'current_version': 'unknown',
            'target_version': 'unknown'
        }))
