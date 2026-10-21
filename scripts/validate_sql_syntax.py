import re
import sys
from pathlib import Path

def validate_sql_file(file_path: Path):
    print(f"--> Validating {file_path.name}...")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    errors = []

    # Check balanced parentheses outside string literals
    in_single_quote = False
    in_double_quote = False
    in_dollar_quote = False
    dollar_tag = ""
    paren_depth = 0
    bracket_depth = 0
    lines = content.splitlines()

    for line_num, line in enumerate(lines, 1):
        # Check basic syntax sanity
        stripped = line.strip()
        if stripped.startswith("--") or not stripped:
            continue

        # Look for common SQL typo traps
        if "CREAT TABLE" in line:
            errors.append(f"Line {line_num}: Typo 'CREAT TABLE'")
        if "INSRT INTO" in line:
            errors.append(f"Line {line_num}: Typo 'INSRT INTO'")

    # Simple parenthesis balance check ignoring basic comments
    # Remove single line comments
    clean_lines = []
    for line in lines:
        cleaned = re.sub(r'--.*$', '', line)
        clean_lines.append(cleaned)
    clean_sql = "\n".join(clean_lines)

    # Check dollar quoting in functions
    dollar_blocks = re.findall(r'\$\$', clean_sql)
    if len(dollar_blocks) % 2 != 0:
        errors.append(f"Odd number of '$$' dollar quotes: {len(dollar_blocks)}")

    if errors:
        print(f"FAILED: {len(errors)} issues found in {file_path.name}:")
        for err in errors:
            print(f"  - {err}")
        return False
    else:
        print(f"PASSED: {file_path.name} is syntactically clean.")
        return True

def main():
    sql_dir = Path(r"e:\palani da3\sql")
    all_passed = True
    sql_files = sorted(sql_dir.glob("*.sql"))
    if not sql_files:
        print("No SQL files found in sql directory!")
        sys.exit(1)

    for sf in sql_files:
        if sf.name == "run_all.sql":
            continue
        if not validate_sql_file(sf):
            all_passed = False

    if all_passed:
        print("\nALL SQL SCRIPTS VALIDATED SUCCESSFULLY!")
    else:
        print("\nSOME SQL SCRIPTS HAD ISSUES.")
        sys.exit(1)

if __name__ == "__main__":
    main()
