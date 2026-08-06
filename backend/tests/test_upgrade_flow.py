import os
import shutil
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from upgrade_code import upgrade_codebase
from analyze_zip import analyze_zip


def create_sample_zip(path):
    with zipfile.ZipFile(path, 'w') as zf:
        zf.writestr('index.php', "<?php\nmysql_connect('localhost');\n")
        zf.writestr('config.php', "<?php\neach($arr);\n")
        zf.writestr('composer.json', '{"require": {"php": "^5.6"}}')


def test_analyze_zip_detects_php_and_upgrade_outputs_zip(tmp_path):
    sample_zip = tmp_path / 'sample.zip'
    create_sample_zip(sample_zip)

    result = analyze_zip(str(sample_zip))
    assert result['technology'] == 'PHP'
    assert result['current_version'] == 'PHP 5.6'

    upgraded_zip = tmp_path / 'upgraded.zip'
    upgrade_result = upgrade_codebase(str(sample_zip), str(upgraded_zip))
    assert upgrade_result['status'] == 'success'
    assert upgraded_zip.exists()
    assert upgrade_result['upgraded_files_count'] >= 1
