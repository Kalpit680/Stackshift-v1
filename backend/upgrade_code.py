import zipfile
import sys
import os
import json
import re
import difflib
import argparse
import tree_sitter
import tree_sitter_php

# ============================================================================
# KNOWLEDGE BASE
# ============================================================================

# Official PHP mysql_* functions and their metadata
DEPRECATED_FUNCTIONS = {

    'mysql_affected_rows': {'replacement': 'mysqli_affected_rows', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_client_encoding': {'replacement': 'mysqli_character_set_name', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_close': {'replacement': 'mysqli_close', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_connect': {'replacement': 'mysqli_connect', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_create_db': {'replacement': 'mysqli_query', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_data_seek': {'replacement': 'mysqli_data_seek', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_db_name': {'replacement': 'mysqli_fetch_object', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_db_query': {'replacement': 'mysqli_query', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_drop_db': {'replacement': 'mysqli_query', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_errno': {'replacement': 'mysqli_errno', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_error': {'replacement': 'mysqli_error', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_escape_string': {'replacement': 'mysqli_real_escape_string', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_fetch_array': {'replacement': 'mysqli_fetch_array', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_fetch_assoc': {'replacement': 'mysqli_fetch_assoc', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_fetch_field': {'replacement': 'mysqli_fetch_field', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_fetch_lengths': {'replacement': 'mysqli_fetch_lengths', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_fetch_object': {'replacement': 'mysqli_fetch_object', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_fetch_row': {'replacement': 'mysqli_fetch_row', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_field_flags': {'replacement': 'mysqli_fetch_field_direct', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_field_len': {'replacement': 'mysqli_fetch_field_direct', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_field_name': {'replacement': 'mysqli_fetch_field_direct', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_field_seek': {'replacement': 'mysqli_field_seek', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_field_table': {'replacement': 'mysqli_fetch_field_direct', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_field_type': {'replacement': 'mysqli_fetch_field_direct', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_free_result': {'replacement': 'mysqli_free_result', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_get_client_info': {'replacement': 'mysqli_get_client_info', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_get_host_info': {'replacement': 'mysqli_get_host_info', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_get_proto_info': {'replacement': 'mysqli_get_proto_info', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_get_server_info': {'replacement': 'mysqli_get_server_info', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_info': {'replacement': 'mysqli_info', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_insert_id': {'replacement': 'mysqli_insert_id', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_list_dbs': {'replacement': 'mysqli_query', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_list_fields': {'replacement': 'mysqli_query', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_list_processes': {'replacement': 'mysqli_thread_id', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_list_tables': {'replacement': 'mysqli_query', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': True, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_num_fields': {'replacement': 'mysqli_num_fields', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_num_rows': {'replacement': 'mysqli_num_rows', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_pconnect': {'replacement': 'mysqli_connect', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_ping': {'replacement': 'mysqli_ping', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_query': {'replacement': 'mysqli_query', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_real_escape_string': {'replacement': 'mysqli_real_escape_string', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_result': {'replacement': 'mysqli_data_seek', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': True, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_select_db': {'replacement': 'mysqli_select_db', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_set_charset': {'replacement': 'mysqli_set_charset', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_stat': {'replacement': 'mysqli_stat', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_tablename': {'replacement': 'mysqli_fetch_array', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_thread_id': {'replacement': 'mysqli_thread_id', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'mysql_unbuffered_query': {'replacement': 'mysqli_query', 'requires_connection': True, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    
    # Other legacy functions
    'split': {'replacement': 'explode', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'spliti': {'replacement': 'explode', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'ereg': {'replacement': 'preg_match', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'eregi': {'replacement': 'preg_match', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'ereg_replace': {'replacement': 'preg_replace', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'session_register': {'replacement': 'session_register_DEPRECATED', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.3', 'target_version_min': '5.4'},
    'session_unregister': {'replacement': 'session_unregister_DEPRECATED', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.3', 'target_version_min': '5.4'},
    'session_is_registered': {'replacement': 'session_is_registered_DEPRECATED', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.3', 'target_version_min': '5.4'},
    'call_user_method': {'replacement': 'call_user_func', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.6', 'target_version_min': '7.0'},
    'set_magic_quotes_runtime': {'replacement': 'set_magic_quotes_runtime_DEPRECATED', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.3', 'target_version_min': '5.4'},
    'magic_quotes': {'replacement': 'magic_quotes_DEPRECATED', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '5.3', 'target_version_min': '5.4'},
    'create_function': {'replacement': 'function_exists', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '7.4', 'target_version_min': '8.0'},
    'each': {'replacement': 'each_DEPRECATED', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '7.4', 'target_version_min': '8.0'},
    'mcrypt_encrypt': {'replacement': 'openssl_encrypt', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '7.1', 'target_version_min': '7.2'},
    'mcrypt_decrypt': {'replacement': 'openssl_decrypt', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '7.1', 'target_version_min': '7.2'},
    'mcrypt_module_open': {'replacement': 'mcrypt_module_open_DEPRECATED', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '7.1', 'target_version_min': '7.2'},
    'mcrypt_get_block_size': {'replacement': 'openssl_cipher_iv_length', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '7.1', 'target_version_min': '7.2'},
    'mcrypt_create_iv': {'replacement': 'random_bytes', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '7.1', 'target_version_min': '7.2'},
    'png2wbmp': {'replacement': 'imagebmp', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '7.4', 'target_version_min': '8.0'},
    'jpeg2wbmp': {'replacement': 'imagebmp', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '7.4', 'target_version_min': '8.0'},
    'mhash': {'replacement': 'hash', 'requires_connection': False, 'validation_rule': 'Check connection injection', 'confidence_score': 100, 'semantic_rewrite': False, 'source_version_max': '7.4', 'target_version_min': '8.0'},
}

def version_le(v1, v2):
    try:
        p1 = tuple(map(int, v1.split('.')))
        p2 = tuple(map(int, v2.split('.')))
        return p1 <= p2
    except Exception:
        return True

def version_ge(v1, v2):
    try:
        p1 = tuple(map(int, v1.split('.')))
        p2 = tuple(map(int, v2.split('.')))
        return p1 >= p2
    except Exception:
        return True

def detect_source_version(zip_file):
    namelist = zip_file.namelist()
    composer_path = [f for f in namelist if f.endswith('composer.json')]
    if composer_path:
        try:
            composer_data = json.loads(zip_file.read(composer_path[0]).decode('utf-8', errors='ignore'))
            php_req = composer_data.get('require', {}).get('php', '')
            match = re.search(r'(\d+\.\d+)', php_req)
            if match:
                return f"{match.group(1)}"
        except Exception:
            pass
    php_files = [f for f in namelist if f.endswith('.php')][:10]
    for pf in php_files:
        try:
            content = zip_file.read(pf).decode('utf-8', errors='ignore')
            if 'mysql_connect' in content:
                return '5.6'
        except Exception:
            continue
    return '5.6'

# ============================================================================
# PIPELINE COMPONENTS
# ============================================================================

class Diagnostics:
    def __init__(self):
        self.rules = {}

    def log(self, func_name, status, reason=None):
        if func_name not in self.rules:
            self.rules[func_name] = {'found': 0, 'migrated': 0, 'skipped': 0, 'reasons': []}
        
        self.rules[func_name]['found'] += 1
        if status == 'migrated':
            self.rules[func_name]['migrated'] += 1
        else:
            self.rules[func_name]['skipped'] += 1
            if reason:
                self.rules[func_name]['reasons'].append(reason)

class Scanner:
    def __init__(self, z_in):
        self.z_in = z_in
        self.files_scanned = 0
        self.php_files = []
        self.js_files = []
        self.py_files = []
        self.other_files = []
        self.skipped_files = []

    def scan(self):
        excluded_dirs = ['.git/', 'node_modules/', '.idea/']
        for item in self.z_in.infolist():
            filename = item.filename
            self.files_scanned += 1
            
            if item.is_dir() or filename.endswith('/'):
                self.other_files.append(item)
                continue
                
            if any(x in filename for x in excluded_dirs):
                self.skipped_files.append((item, "Excluded directory (vendor, lib, etc)"))
                continue
                
            if item.file_size > 2 * 1024 * 1024:
                self.skipped_files.append((item, "File exceeds 2MB limit"))
                continue

            ext = os.path.splitext(filename)[1].lower()
            if ext == '.php':
                self.php_files.append(item)
            elif ext in ['.js', '.jsx', '.ts', '.tsx']:
                self.js_files.append(item)
            elif ext == '.py':
                self.py_files.append(item)
            else:
                self.other_files.append(item)
                
        return self.php_files, self.js_files, self.py_files, self.other_files, self.skipped_files

class Parser:
    def __init__(self):
        self.parser = tree_sitter.Parser(tree_sitter.Language(tree_sitter_php.language_php()))
        self.parser_failures = 0
        self.parsed_successfully = 0

    def parse_php(self, content_bytes):
        try:
            tree = self.parser.parse(content_bytes)
            self.parsed_successfully += 1
            return tree
        except Exception:
            self.parser_failures += 1
            return None

class RuleEngine:
    def __init__(self, diagnostics, source_version="5.6", target_version="8.2"):
        self.diagnostics = diagnostics
        self.source_version = source_version
        self.target_version = target_version
        self.rules_matched_total = 0
        self.deprecated_apis_detected = 0

    def find_matches(self, tree, content_bytes):
        edits = []
        conn_var = b'$conn'
        confidence_penalty = 20
        
        # Pass 1: find connection variable
        def find_conn(node):
            nonlocal conn_var, confidence_penalty
            if node.type == 'assignment_expression':
                left = node.child_by_field_name('left')
                right = node.child_by_field_name('right')
                if left and right and right.type == 'function_call_expression':
                    name_n = right.child_by_field_name('function')
                    if not name_n:
                        for child in right.children:
                            if child.type == 'name':
                                name_n = child
                    if name_n and name_n.text.decode('utf-8').lower() in ['mysql_connect', 'mysql_pconnect']:
                        conn_var = left.text
                        confidence_penalty = 0
            for child in node.children:
                find_conn(child)
        
        find_conn(tree.root_node)
        
        # Pass 2: generate edits
        def traverse(node):
            if node.type == 'function_call_expression':
                name_node = None
                args_node = None
                for child in node.children:
                    if child.type == 'name':
                        name_node = child
                    elif child.type == 'arguments':
                        args_node = child
                
                if name_node and args_node:
                    func_name = name_node.text.decode('utf-8').lower()
                    if func_name in DEPRECATED_FUNCTIONS:
                        rule = DEPRECATED_FUNCTIONS[func_name]
                        
                        # Version-based filtering
                        src_max = rule.get('source_version_max')
                        tgt_min = rule.get('target_version_min')
                        if src_max and not version_le(self.source_version, src_max):
                            return
                        if tgt_min and not version_ge(self.target_version, tgt_min):
                            return
                        
                        args_list = []
                        for c in args_node.children:
                            if c.type not in ['(', ')', ','] and not (c.type == 'comment'):
                                args_list.append(c)
                                
                        is_valid = True
                        reason = ""
                        # Pre-validation logic
                        if rule['requires_connection']:
                            if len(args_list) > 2:
                                is_valid = False
                                reason = f"Too many arguments ({len(args_list)})"
                                
                        if not is_valid:
                            self.diagnostics.log(func_name, 'skipped', reason)
                            return
                            
                        if rule.get('semantic_rewrite', False):
                            if func_name == 'mysql_result':
                                if len(args_list) >= 2:
                                    arg0 = content_bytes[args_list[0].start_byte:args_list[0].end_byte]
                                    arg1 = content_bytes[args_list[1].start_byte:args_list[1].end_byte]
                                    arg2 = content_bytes[args_list[2].start_byte:args_list[2].end_byte] if len(args_list) > 2 else b"0"
                                    
                                    replacement = b"((mysqli_data_seek(" + arg0 + b", " + arg1 + b") && (($___row = mysqli_fetch_array(" + arg0 + b")))) ? $___row[" + arg2 + b"] : null)"
                                    edits.append({
                                        'start': node.start_byte,
                                        'end': node.end_byte,
                                        'replacement': replacement
                                    })
                                else:
                                    self.diagnostics.log(func_name, 'skipped', 'mysql_result requires at least 2 args')
                                    return
                            elif func_name == 'mysql_list_tables':
                                if len(args_list) >= 1:
                                    arg0 = content_bytes[args_list[0].start_byte:args_list[0].end_byte]
                                    my_conn = content_bytes[args_list[1].start_byte:args_list[1].end_byte] if len(args_list) > 1 else conn_var
                                    replacement = b"mysqli_query(" + my_conn + b", \"SHOW TABLES FROM \" . " + arg0 + b")"
                                    edits.append({
                                        'start': node.start_byte,
                                        'end': node.end_byte,
                                        'replacement': replacement
                                    })
                                else:
                                    self.diagnostics.log(func_name, 'skipped', 'mysql_list_tables requires at least 1 arg')
                                    return
                            self.diagnostics.log(func_name, 'migrated')
                            return

                        # Standard rule replacement
                        self.diagnostics.log(func_name, 'migrated')
                        
                        edits.append({
                            'start': name_node.start_byte,
                            'end': name_node.end_byte,
                            'replacement': rule['replacement'].encode('utf-8')
                        })
                        
                        if rule['requires_connection']:
                            if len(args_list) <= 1:
                                inject_pos = args_node.start_byte + 1
                                has_args = (args_node.end_byte - args_node.start_byte) > 2
                                inject_bytes = conn_var + b", " if has_args else conn_var
                                edits.append({
                                    'start': inject_pos,
                                    'end': inject_pos,
                                    'replacement': inject_bytes
                                })
                            elif len(args_list) == 2:
                                # Swap args
                                arg0_start = args_list[0].start_byte
                                arg0_end = args_list[0].end_byte
                                arg1_start = args_list[1].start_byte
                                arg1_end = args_list[1].end_byte
                                
                                arg0_text = content_bytes[arg0_start:arg0_end]
                                arg1_text = content_bytes[arg1_start:arg1_end]
                                
                                new_args = arg1_text + b", " + arg0_text
                                edits.append({
                                    'start': arg0_start,
                                    'end': arg1_end,
                                    'replacement': new_args
                                })
            for child in node.children:
                traverse(child)
                
        traverse(tree.root_node)
        
        return edits

class Transformer:
    def transform(self, content_bytes, edits):
        if not edits:
            return content_bytes, False
            
        edits.sort(key=lambda e: e['start'], reverse=True)
        mutable_content = bytearray(content_bytes)
        for e in edits:
            start = e['start']
            end = e['end']
            replacement = e['replacement']
            mutable_content[start:end] = replacement
            
        return bytes(mutable_content), True

class Executor:
    def __init__(self, z_out):
        self.z_out = z_out
        self.execution_failures = 0
        self.diffs = []

    def write_file(self, item, new_content, original_content, filename):
        try:
            self.z_out.writestr(item, new_content)
            if new_content != original_content:
                try:
                    orig_text = original_content.decode('utf-8', errors='ignore')
                    new_text = new_content.decode('utf-8', errors='ignore')
                    orig_lines = orig_text.splitlines(keepends=True)
                    new_lines = new_text.splitlines(keepends=True)
                    
                    if len(orig_lines) > 2000:
                        diff_text = f"--- a/{filename}\n+++ b/{filename}\n@@ -1,0 +1,0 @@\n  # Diff omitted for large file.\n"
                    else:
                        diff_lines = list(difflib.unified_diff(
                            orig_lines, new_lines,
                            fromfile=f'a/{filename}', tofile=f'b/{filename}'
                        ))
                        diff_text = "".join(diff_lines)
                        
                    self.diffs.append({
                        "file": filename,
                        "diff": diff_text
                    })
                except Exception:
                    pass
            return True
        except Exception as e:
            self.execution_failures += 1
            return False

# ============================================================================
# MAIN FUNCTION
# ============================================================================

def upgrade_codebase(zip_path, upgraded_zip_path, target_version=None, framework=None):
    if not os.path.exists(zip_path):
        return {"status": "error", "message": f"Source zip file not found: {zip_path}"}

    target_version_label = target_version or 'PHP 8.2'
    framework_label = framework or 'Core PHP'

    py_print = re.compile(r'^\s*print\s+["\']([^"\']+)["\']', re.MULTILINE)
    py_xrange = re.compile(r'\bxrange\b')
    py_raw_input = re.compile(r'\braw_input\b')
    js_var = re.compile(r'\bvar\b')
    js_document_write = re.compile(r'\bdocument\.write\b')

    diagnostics = Diagnostics()
    remaining_apis_global = {}
    remaining_apis_details = []
    partial_migrations = 0
    files_requiring_migration = 0
    files_migrated = 0

    try:
        with zipfile.ZipFile(zip_path, 'r') as z_in, zipfile.ZipFile(upgraded_zip_path, 'w', zipfile.ZIP_DEFLATED) as z_out:
            scanner = Scanner(z_in)
            parser = Parser()
            
            detected_source_version = detect_source_version(z_in)
            source_version_clean = detected_source_version.strip()
            target_version_clean = target_version_label.replace('PHP ', '').strip()
            
            rule_engine = RuleEngine(diagnostics, source_version=source_version_clean, target_version=target_version_clean)
            transformer = Transformer()
            executor = Executor(z_out)

            php_files, js_files, py_files, other_files, skipped_files = scanner.scan()
            
            for item in php_files:
                filename = item.filename
                try:
                    original_bytes = z_in.read(filename)
                except Exception:
                    executor.execution_failures += 1
                    continue
                
                content = original_bytes
                tree = parser.parse_php(content)
                changed_this_file = False
                
                if tree:
                    # Iterative Rule Engine
                    iteration = 0
                    while iteration < 5:
                        edits = rule_engine.find_matches(tree, content)
                        if not edits:
                            break
                            
                        if iteration == 0:
                            files_requiring_migration += 1
                            
                        new_content, changed = transformer.transform(content, edits)
                        if not changed:
                            break
                            
                        content = new_content
                        changed_this_file = True
                        tree = parser.parse_php(content)
                        iteration += 1

                    executor.write_file(item, content, original_bytes, filename)
                    if changed_this_file:
                        files_migrated += 1
                        
                    # VALIDATION PHASE
                    validation_tree = parser.parse_php(content)
                    if validation_tree:
                        file_remaining = {}
                        has_mysqli = False
                        def find_remaining(node):
                            nonlocal has_mysqli
                            if node.type == 'function_call_expression':
                                name_n = None
                                for child in node.children:
                                    if child.type == 'name':
                                        name_n = child
                                if name_n:
                                    func_name = name_n.text.decode('utf-8').lower()
                                    if func_name.startswith('mysqli_'):
                                        has_mysqli = True
                                    elif func_name.startswith('mysql_') or func_name in DEPRECATED_FUNCTIONS:
                                        # Only track official deprecated functions matching our upgrade path
                                        if func_name in DEPRECATED_FUNCTIONS:
                                            rule = DEPRECATED_FUNCTIONS[func_name]
                                            src_max = rule.get('source_version_max')
                                            tgt_min = rule.get('target_version_min')
                                            if (not src_max or version_le(source_version_clean, src_max)) and \
                                               (not tgt_min or version_ge(target_version_clean, tgt_min)):
                                                file_remaining[func_name] = file_remaining.get(func_name, 0) + 1
                                                remaining_apis_global[func_name] = remaining_apis_global.get(func_name, 0) + 1
                                                line_num = name_n.start_point[0] + 1
                                                rule_exp = rule['replacement']
                                                reason = "Unresolved dependency / complex arguments"
                                                if func_name in diagnostics.rules and diagnostics.rules[func_name]['reasons']:
                                                    reason = diagnostics.rules[func_name]['reasons'][-1]
                                                remaining_apis_details.append({
                                                    'file': filename,
                                                    'line': line_num,
                                                    'api': func_name,
                                                    'rule_expected': rule_exp,
                                                    'rule_applied': 'None',
                                                    'reason': reason
                                                })
                            for child in node.children:
                                find_remaining(child)
                        
                        find_remaining(validation_tree.root_node)
                        if file_remaining and has_mysqli:
                            partial_migrations += 1
                else:
                    executor.write_file(item, original_bytes, original_bytes, filename)

            for item in js_files:
                filename = item.filename
                original_bytes = z_in.read(filename)
                try:
                    content = original_bytes.decode('utf-8')
                    new_content = js_var.sub('let', content)
                    new_content = js_document_write.sub('console.log', new_content)
                    executor.write_file(item, new_content.encode('utf-8'), original_bytes, filename)
                except:
                    executor.write_file(item, original_bytes, original_bytes, filename)

            for item in py_files:
                filename = item.filename
                original_bytes = z_in.read(filename)
                try:
                    content = original_bytes.decode('utf-8')
                    new_content = py_print.sub(r'print("\1")', content)
                    new_content = py_xrange.sub('range', new_content)
                    new_content = py_raw_input.sub('input', new_content)
                    executor.write_file(item, new_content.encode('utf-8'), original_bytes, filename)
                except:
                    executor.write_file(item, original_bytes, original_bytes, filename)
                    
            for item in other_files:
                try:
                    executor.write_file(item, z_in.read(item.filename), z_in.read(item.filename), item.filename)
                except:
                    pass
            for item, reason in skipped_files:
                try:
                    executor.write_file(item, z_in.read(item.filename), z_in.read(item.filename), item.filename)
                except:
                    pass

        has_php = len(php_files) > 0
        has_python = len(py_files) > 0
        has_js = len(js_files) > 0
        
        if remaining_apis_details:
            import csv
            import io
            csv_out = io.StringIO()
            writer = csv.writer(csv_out)
            writer.writerow(['File', 'Line', 'Deprecated API', 'Rule Expected', 'Rule Applied', 'Reason Not Migrated'])
            for row in remaining_apis_details:
                writer.writerow([row['file'], row['line'], row['api'], row['rule_expected'], row['rule_applied'], row['reason']])
            executor.write_file("remaining_legacy_php.csv", csv_out.getvalue().encode('utf-8'), b"", "remaining_legacy_php.csv")

        tech_upgrades = {}
        if has_php:
            tech_upgrades["PHP"] = {"before": f"PHP {source_version_clean}", "after": target_version_label or "PHP 8.2 / 8.3 (LTS)"}
        if has_python:
            tech_upgrades["Python"] = {"before": "Python 2.7", "after": "Python 3.10+ (Recommended)"}
        if has_js:
            tech_upgrades["JavaScript"] = {"before": "ES5 / Legacy JS", "after": "ES6+ Modern JS"}
        if not tech_upgrades:
            tech_upgrades["General Codebase"] = {"before": "Legacy Stack", "after": "Modernized Target"}

        coverage = 0
        if files_requiring_migration > 0:
            coverage = round((files_migrated / files_requiring_migration) * 100, 1)

        status = "success"
        completed_with_warnings = False
        if len(remaining_apis_global) > 0:
            status = "warning"
            completed_with_warnings = True

        return {
            "status": status,
            "upgraded": True,
            "completed_with_warnings": completed_with_warnings,
            "remaining_apis": remaining_apis_global,
            "remaining_apis_details": remaining_apis_details,
            "rule_diagnostics": diagnostics.rules,
            "partial_migrations": partial_migrations,
            "upgraded_files_count": len(executor.diffs),
            "diffs": executor.diffs,
            "tech_upgrades": tech_upgrades,
            "target_version": target_version_label,
            "framework": framework_label,
            "report_metrics": {
                "files_scanned": scanner.files_scanned,
                "php_files_discovered": len(php_files),
                "php_files_parsed": parser.parsed_successfully,
                "parser_failures": parser.parser_failures,
                "files_skipped": len(skipped_files),
                "files_requiring_migration": files_requiring_migration,
                "files_migrated": files_migrated,
                "migration_coverage": coverage
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            "status": "error",
            "message": str(e)
        }

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('src_zip')
    parser.add_argument('dest_zip')
    parser.add_argument('--target-version', default=None)
    parser.add_argument('--framework', default=None)
    parser.add_argument('--output', default=None)
    args = parser.parse_args()

    if args.output:
        log_dir = os.path.dirname(args.output)
        base_name = os.path.basename(args.output).replace('.json', '.log')
        log_path = os.path.join(log_dir, f"diagnostic-{base_name}")
        sys.stderr = open(log_path, 'w', encoding='utf-8')

    res = upgrade_codebase(args.src_zip, args.dest_zip, target_version=args.target_version, framework=args.framework)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(res, f)
    else:
        print(json.dumps(res))
