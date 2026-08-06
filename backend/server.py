import http.server
import socketserver
import os
import json
import uuid
import zipfile
import re
import urllib.parse
from datetime import datetime

PORT = 8000
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
UPLOADS_DIR = os.path.join(BASE_DIR, 'backend', 'uploads')
OUTPUT_DIR = os.path.join(BASE_DIR, 'backend', 'output')
KB_DIR = os.path.join(BASE_DIR, 'backend', 'knowledge_base')

os.makedirs(UPLOADS_DIR, exist_ok=True)
import shutil

def safe_extract_zip(zip_ref, target_dir):
    for member in zip_ref.infolist():
        filename = member.filename
        clean_path = os.path.normpath(filename)
        if clean_path.startswith('..') or os.path.isabs(clean_path):
            continue

        target_path = os.path.join(target_dir, clean_path)

        if member.is_dir() or filename.endswith('/'):
            os.makedirs(target_path, exist_ok=True)
            continue

        parent_dir = os.path.dirname(target_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)

        if os.path.exists(target_path) and os.path.isdir(target_path):
            target_path = target_path + "_file"

        try:
            with zip_ref.open(member) as source, open(target_path, "wb") as target:
                shutil.copyfileobj(source, target)
        except Exception as e:
            pass

class CodeLiftRequestHandler(http.server.BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        # Override to log cleanly to console
        print(f"[{self.log_date_time_string()}] {format%args}")

    def do_OPTIONS(self):
        # CORS Headers
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        # Parse query params
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

        # 1. Handle Download API
        if path == '/backend/api/download.php' or path == '/api/download':
            self.handle_download(query)
            return

        # 2. Serve Frontend Static Files
        # If accessing the root, redirect or serve index.html
        if path == '/' or path == '/frontend' or path == '/frontend/':
            self.send_response(301)
            self.send_header('Location', '/frontend/index.html')
            self.end_headers()
            return

        # Resolve path within frontend folder
        if path.startswith('/frontend/'):
            rel_path = path[10:] # strip /frontend/
            file_path = os.path.join(FRONTEND_DIR, rel_path)
        else:
            # Fallback to direct path resolve inside frontend
            file_path = os.path.join(FRONTEND_DIR, path.lstrip('/'))

        if os.path.exists(file_path) and os.path.isfile(file_path):
            self.serve_static_file(file_path)
        else:
            self.send_error(404, f"File Not Found: {self.path}")

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # 1. Handle Upload API
        if path == '/backend/api/upload.php' or path == '/api/upload':
            self.handle_upload()
            return

        # 2. Handle Scan API
        elif path == '/backend/api/scan.php' or path == '/api/scan':
            self.handle_scan()
            return

        # 3. Handle Migrate API
        elif path == '/backend/api/migrate.php' or path == '/api/migrate':
            self.handle_migrate()
            return

        else:
            self.send_error(404, f"API endpoint not found: {self.path}")

    def serve_static_file(self, file_path):
        # Determine content type
        _, ext = os.path.splitext(file_path)
        content_types = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        }
        content_type = content_types.get(ext.lower(), 'application/octet-stream')

        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {e}")

    def handle_upload(self):
        # Custom Multipart Form-Data Parser for Python 3.14 without cgi
        content_type = self.headers.get('Content-Type', '')
        if not content_type.startswith('multipart/form-data'):
            self.send_json({"status": "error", "message": "Content-Type must be multipart/form-data"}, 400)
            return

        # Get boundary
        match = re.search(r'boundary=([^;\s]+)', content_type)
        if not match:
            self.send_json({"status": "error", "message": "Multipart boundary not found"}, 400)
            return
        
        boundary = b'--' + match.group(1).encode('utf-8')
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        # Parse multipart sections
        parts = body.split(boundary)
        project_name = 'Unnamed Project'
        file_bytes = b''
        file_name = 'project.zip'

        for part in parts:
            if not part or part == b'--\r\n' or part == b'--':
                continue
            
            # Split headers and content
            subparts = part.split(b'\r\n\r\n', 1)
            if len(subparts) < 2:
                continue
            headers_bytes, content = subparts
            # Remove trailing \r\n from content
            if content.endswith(b'\r\n'):
                content = content[:-2]
            
            headers_text = headers_bytes.decode('utf-8', errors='ignore')
            
            # Check disposition
            disp_match = re.search(r'Content-Disposition:\s*form-data;\s*name="([^"]+)"', headers_text)
            if disp_match:
                name = disp_match.group(1)
                if name == 'projectName':
                    project_name = content.decode('utf-8', errors='ignore').strip()
                elif name == 'file':
                    file_bytes = content
                    fn_match = re.search(r'filename="([^"]+)"', headers_text)
                    if fn_match:
                        file_name = fn_match.group(1)

        if not file_bytes:
            self.send_json({"status": "error", "message": "No file uploaded or file is empty"}, 400)
            return

        # Setup paths
        project_id = str(uuid.uuid4())
        upload_path = os.path.join(UPLOADS_DIR, project_id)
        os.makedirs(upload_path, exist_ok=True)

        zip_path = os.path.join(upload_path, 'project.zip')
        with open(zip_path, 'wb') as f:
            f.write(file_bytes)

        # Unzip
        extract_dir = os.path.join(upload_path, 'source')
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                safe_extract_zip(zip_ref, extract_dir)
        except Exception as e:
            self.send_json({"status": "error", "message": f"Failed to extract ZIP: {e}"}, 500)
            return

        # Save metadata
        meta = {
            "projectId": project_id,
            "name": project_name,
            "uploadedAt": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "zipPath": zip_path,
            "extractDir": extract_dir
        }
        with open(os.path.join(upload_path, 'metadata.json'), 'w') as f:
            json.dump(meta, f, indent=4)

        self.send_json({
            "status": "success",
            "projectId": project_id,
            "projectName": project_name,
            "message": "File uploaded and extracted successfully."
        })

    def handle_scan(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        try:
            params = json.loads(post_data)
        except:
            self.send_json({"status": "error", "message": "Invalid JSON"}, 400)
            return

        project_id = params.get('projectId', '')
        if not project_id:
            self.send_json({"status": "error", "message": "Missing projectId"}, 400)
            return

        project_path = os.path.join(UPLOADS_DIR, project_id)
        meta_file = os.path.join(project_path, 'metadata.json')

        if not os.path.exists(meta_file):
            self.send_json({"status": "error", "message": "Project not found"}, 404)
            return

        with open(meta_file, 'r') as f:
            meta = json.load(f)

        extract_dir = meta['extractDir']
        
        # Traverse files to count and scan
        total_files = 0
        php_files = 0
        php_file_paths = []

        for root, _, files in os.walk(extract_dir):
            for file in files:
                total_files += 1
                if file.lower().endswith('.php'):
                    php_files += 1
                    rel_path = os.path.relpath(os.path.join(root, file), extract_dir)
                    php_file_paths.append(rel_path)

        # Detect framework & version heuristics
        detected_framework = "Vanilla PHP"
        detected_version = "5.6"

        # Look for artisan providers / wp-config
        if os.path.exists(os.path.join(extract_dir, 'artisan')) or os.path.exists(os.path.join(extract_dir, 'app', 'Providers')):
            detected_framework = "Laravel"
        elif os.path.exists(os.path.join(extract_dir, 'wp-config.php')):
            detected_framework = "WordPress"
        elif os.path.exists(os.path.join(extract_dir, 'system', 'core', 'CodeIgniter.php')) or os.path.exists(os.path.join(extract_dir, 'application', 'config')):
            detected_framework = "CodeIgniter"

        # Check composer.json for PHP requirement
        composer_file = os.path.join(extract_dir, 'composer.json')
        if os.path.exists(composer_file):
            try:
                with open(composer_file, 'r') as f:
                    composer = json.load(f)
                php_req = composer.get('require', {}).get('php', '')
                match = re.search(r'(\d+\.\d+(\.\d+)?)', php_req)
                if match:
                    detected_version = match.group(1)
            except:
                pass

        # Scan for deprecations in PHP files (mock scan search)
        warnings_count = 0
        scan_findings = []

        for rel_path in php_file_paths[:100]: # limit scanner heuristics to first 100 php files
            abs_path = os.path.join(extract_dir, rel_path)
            try:
                with open(abs_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                if 'mysql_connect' in content:
                    warnings_count += 1
                    scan_findings.append({
                        "file": rel_path,
                        "type": "deprecation",
                        "message": "Use of deprecated mysql_connect() function.",
                        "ruleId": "PHP5_DEP_MYSQL_CONNECT"
                    })
                
                if re.search(r'\beach\s*\(', content):
                    warnings_count += 1
                    scan_findings.append({
                        "file": rel_path,
                        "type": "deprecation",
                        "message": "Use of deprecated each() function.",
                        "ruleId": "PHP7_DEP_EACH"
                    })

                if re.search(r'\bsplit\s*\(', content):
                    warnings_count += 1
                    scan_findings.append({
                        "file": rel_path,
                        "type": "deprecation",
                        "message": "Use of deprecated split() function.",
                        "ruleId": "PHP7_DEP_SPLIT"
                    })
            except Exception as e:
                pass

        target_version = '7.4' if float(detected_version.split('.')[0]) < 7 else '8.2'

        scan_results = {
            "projectId": project_id,
            "projectName": meta['name'],
            "detectedLanguage": "PHP",
            "detectedVersion": detected_version,
            "detectedFramework": detected_framework,
            "targetVersion": target_version,
            "totalFiles": total_files,
            "phpFiles": php_files,
            "warningsCount": warnings_count,
            "findings": scan_findings
        }

        # Cache results
        with open(os.path.join(project_path, 'scan_results.json'), 'w') as f:
            json.dump(scan_results, f, indent=4)

        self.send_json({
            "status": "success",
            "projectId": project_id,
            "projectName": meta['name'],
            "detectedLanguage": "PHP",
            "detectedVersion": detected_version,
            "detectedFramework": detected_framework,
            "targetVersion": target_version,
            "totalFiles": total_files,
            "phpFiles": php_files,
            "warningsCount": warnings_count
        })

    def handle_migrate(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        try:
            params = json.loads(post_data)
        except:
            self.send_json({"status": "error", "message": "Invalid JSON"}, 400)
            return

        project_id = params.get('projectId', '')
        target_version = params.get('targetVersion', '7.4')

        if not project_id:
            self.send_json({"status": "error", "message": "Missing projectId"}, 400)
            return

        project_path = os.path.join(UPLOADS_DIR, project_id)
        meta_file = os.path.join(project_path, 'metadata.json')
        scan_file = os.path.join(project_path, 'scan_results.json')

        if not os.path.exists(meta_file) or not os.path.exists(scan_file):
            self.send_json({"status": "error", "message": "Perform a scan first"}, 404)
            return

        with open(meta_file, 'r') as f:
            meta = json.load(f)
        with open(scan_file, 'r') as f:
            scan = json.load(f)

        source_dir = meta['extractDir']
        output_dir = os.path.join(OUTPUT_DIR, project_id, 'source')
        os.makedirs(output_dir, exist_ok=True)

        # Load rules from KB
        rules = []
        kb_path = os.path.join(KB_DIR, 'php', f"rules_5.6_to_7.4.json")
        if os.path.exists(kb_path):
            with open(kb_path, 'r') as f:
                rules = json.load(f)
        else:
            # Fallback default hardcoded rules in memory
            rules = [
                {
                    "id": "PHP5_DEP_MYSQL_CONNECT",
                    "pattern": r"\bmysql_connect\s*\(",
                    "replacement": "mysqli_connect(",
                    "type": "function_replace"
                },
                {
                    "id": "PHP7_DEP_EACH",
                    "pattern": r"while\s*\(\s*list\s*\(\s*(\$[^,]+)\s*,\s*(\$[^)]+)\s*\)\s*=\s*each\s*\(\s*(\$[^)]+)\s*\)\s*\)",
                    "replacement": r"foreach (\3 as \1 => \2)",
                    "type": "each_replace"
                },
                {
                    "id": "PHP7_DEP_SPLIT",
                    "pattern": r"\bsplit\s*\(",
                    "replacement": "explode(",
                    "type": "function_replace"
                }
            ]

        # Execute migration: copy files and execute replacements
        migrated_files = []
        rules_applied_count = 0

        for root, _, files in os.walk(source_dir):
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), source_dir)
                src_file = os.path.join(source_dir, rel_path)
                dst_file = os.path.join(output_dir, rel_path)
                
                os.makedirs(os.path.dirname(dst_file), exist_ok=True)

                if file.lower().endswith('.php'):
                    try:
                        with open(src_file, 'r', encoding='utf-8', errors='ignore') as f:
                            original_content = f.read()
                        
                        modified_content = original_content
                        file_rules = []

                        for rule in rules:
                            pat = rule['pattern']
                            rep = rule['replacement']
                            
                            if re.search(pat, modified_content, re.IGNORECASE):
                                file_rules.append(rule['id'])
                                rules_applied_count += 1
                                modified_content = re.sub(pat, rep, modified_content, flags=re.IGNORECASE)

                        if modified_content != original_content:
                            with open(dst_file, 'w', encoding='utf-8') as f:
                                f.write(modified_content)
                            
                            # Generate simple unified diff
                            diff = ""
                            orig_lines = original_content.splitlines()
                            mod_lines = modified_content.splitlines()
                            for i, (orig, mod) in enumerate(zip(orig_lines, mod_lines)):
                                if orig != mod:
                                    diff += f"@@ -{i+1} +{i+1} @@\n- {orig}\n+ {mod}\n"
                            
                            migrated_files.append({
                                "filePath": rel_path,
                                "appliedRules": file_rules,
                                "diff": diff
                            })
                        else:
                            # Just copy without modifications
                            with open(dst_file, 'w', encoding='utf-8') as f:
                                f.write(original_content)
                    except Exception as e:
                        # Fallback simple copy
                        with open(dst_file, 'wb') as f_out:
                            with open(src_file, 'rb') as f_in:
                                f_out.write(f_in.read())
                else:
                    # Non PHP copy
                    with open(dst_file, 'wb') as f_out:
                        with open(src_file, 'rb') as f_in:
                            f_out.write(f_in.read())

        confidence = 95.5 if len(migrated_files) > 0 else 100.0

        migration_report = {
            "projectId": project_id,
            "projectName": meta['name'],
            "sourceVersion": scan['detectedVersion'],
            "targetVersion": target_version,
            "rulesApplied": rules_applied_count,
            "confidenceScore": confidence,
            "downloadUrl": f"/backend/api/download.php?projectId={project_id}",
            "migratedFiles": migrated_files
        }

        with open(os.path.join(project_path, 'migration_report.json'), 'w') as f:
            json.dump(migration_report, f, indent=4)

        self.send_json(array_merge({"status": "success"}, migration_report))

    def handle_download(self, query):
        project_id_list = query.get('projectId', [''])
        project_id = project_id_list[0] if project_id_list else ''

        if not project_id or not re.match(r'^[a-f0-9\-]{36}$', project_id, re.IGNORECASE):
            self.send_error(400, "Invalid projectId")
            return

        output_base = os.path.join(OUTPUT_DIR, project_id)
        source_dir = os.path.join(output_base, 'source')
        zip_file = os.path.join(output_base, 'migrated_project.zip')

        if not os.path.exists(source_dir) or not os.path.isdir(source_dir):
            self.send_error(404, "Migrated project source folder not found")
            return

        # Compress dynamic zip file
        if not os.path.exists(zip_file):
            try:
                with zipfile.ZipFile(zip_file, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
                    for root, _, files in os.walk(source_dir):
                        for file in files:
                            abs_path = os.path.join(root, file)
                            rel_path = os.path.relpath(abs_path, source_dir)
                            zip_ref.write(abs_path, rel_path)
            except Exception as e:
                self.send_error(500, f"Error building download ZIP: {e}")
                return

        # Send file headers
        try:
            with open(zip_file, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/zip')
            self.send_header('Content-Disposition', f'attachment; filename="migrated_{project_id}.zip"')
            self.send_header('Content-Length', len(content))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error serving download file: {e}")

    def send_json(self, data, status_code=200):
        try:
            content = json.dumps(data, indent=4).encode('utf-8')
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', len(content))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"JSON Encoding Error: {e}")

def array_merge(dict1, dict2):
    res = dict1.copy()
    res.update(dict2)
    return res

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    pass

if __name__ == '__main__':
    server_address = ('', PORT)
    with ThreadedHTTPServer(server_address, CodeLiftRequestHandler) as httpd:
        print(f"===========================================================")
        print(f"CodeLift Python Development Server running on Port {PORT}")
        print(f"Access CodeLift Web App: http://localhost:{PORT}/frontend/index.html")
        print(f"===========================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down CodeLift Server...")
