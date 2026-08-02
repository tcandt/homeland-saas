import zipfile
import xml.etree.ElementTree as ET
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

backup_path = r'd:\homeland-new\homeland-saas\tai-lieu\CT01_backup.docx'
current_path = r'd:\homeland-new\homeland-saas\tai-lieu\CT01.docx'

with zipfile.ZipFile(backup_path) as z:
    b_xml = z.read('word/document.xml').decode('utf-8')

with zipfile.ZipFile(current_path) as z:
    c_xml = z.read('word/document.xml').decode('utf-8')

# Print the length of XMLs
print("Backup length:", len(b_xml))
print("Current length:", len(c_xml))

# Let's print the first Table 1 cell in both XMLs
b_root = ET.fromstring(b_xml)
c_root = ET.fromstring(c_xml)

namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
b_cell = b_root.findall('.//w:tbl', namespaces)[0].findall('.//w:tc', namespaces)[1]
c_cell = c_root.findall('.//w:tbl', namespaces)[0].findall('.//w:tc', namespaces)[1]

print("\nBackup cell 1:")
print(ET.tostring(b_cell, encoding='utf-8').decode('utf-8'))
print("\nModified cell 1:")
print(ET.tostring(c_cell, encoding='utf-8').decode('utf-8'))
