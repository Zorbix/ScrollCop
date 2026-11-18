"""Build the public download from an explicit list of extension files."""
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    'manifest.json', 'background.js', 'sites.js', 'ui.js',
    'popup.html', 'options.html', 'styles.css', 'badge.svg',
    'blocked.html', 'blocked.css', 'blocked.js',
    'icons/badge-16.png', 'icons/badge-32.png',
    'icons/badge-48.png', 'icons/badge-128.png',
]
if (ROOT / 'LICENSE').is_file():
    FILES.append('LICENSE')

output = ROOT / 'docs' / 'downloads' / 'scrollcop.zip'
output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
    for filename in FILES:
        entry = ZipInfo(filename, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, (ROOT / filename).read_bytes())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    manifest = json.loads(archive.read('manifest.json'))
print(f'Packaged ScrollCop {manifest["version"]}: {output}')
