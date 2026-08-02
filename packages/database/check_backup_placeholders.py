import zipfile
import xml.etree.ElementTree as ET
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

backup_path = r'd:\homeland-new\homeland-saas\tai-lieu\CT01_backup.docx'
with zipfile.ZipFile(backup_path) as z:
    xml_content = z.read('word/document.xml')

root = ET.fromstring(xml_content)
namespaces = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
}

tables = root.findall('.//w:tbl', namespaces)
for t_idx, tbl in enumerate(tables[:2]):
    print(f"\nTable {t_idx+1} cell raw texts in backup:")
    for idx, cell in enumerate(tbl.findall('.//w:tc', namespaces)):
        texts = [t.text for t in cell.findall('.//w:t', namespaces) if t.text]
        print(f"  Cell {idx}: {texts}")
