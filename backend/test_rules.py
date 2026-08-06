import unittest
import tree_sitter
import tree_sitter_php

# Import components from upgrade_code
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import upgrade_code

class TestMigrationRules(unittest.TestCase):
    def setUp(self):
        self.parser = upgrade_code.Parser()

    def run_engine(self, php_code):
        tree = self.parser.parse_php(php_code)
        diagnostics = upgrade_code.Diagnostics()
        rule_engine = upgrade_code.RuleEngine(diagnostics)
        transformer = upgrade_code.Transformer()
        
        content = php_code
        iteration = 0
        while iteration < 5:
            edits = rule_engine.find_matches(tree, content)
            if not edits:
                break
            content, changed = transformer.transform(content, edits)
            if not changed:
                break
            tree = self.parser.parse_php(content)
            iteration += 1
            
        return content.decode('utf-8'), diagnostics

    def test_mysql_query_simple(self):
        code = b"<?php mysql_query($sql); ?>"
        expected = "<?php mysqli_query($conn, $sql); ?>"
        out, diag = self.run_engine(code)
        self.assertEqual(out, expected)

    def test_mysql_result_semantic(self):
        code = b"<?php $name = mysql_result($res, 0, 'name'); ?>"
        expected = "<?php $name = ((mysqli_data_seek($res, 0) && (($___row = mysqli_fetch_array($res)))) ? $___row['name'] : null); ?>"
        out, diag = self.run_engine(code)
        self.assertEqual(out, expected)

    def test_mysql_list_tables_semantic(self):
        code = b"<?php $res = mysql_list_tables($db, $my_link); ?>"
        expected = "<?php $res = mysqli_query($my_link, \"SHOW TABLES FROM \" . $db); ?>"
        out, diag = self.run_engine(code)
        self.assertEqual(out, expected)

if __name__ == '__main__':
    unittest.main(verbosity=2)
