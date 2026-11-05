"""Build the static teaching-lab download. Never start the lab from the site build."""
from hashlib import sha256
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "content/labs/hunting-idor"
OUTPUT = ROOT / "public/assets/documents/hunting-idor-lab.zip"
FILES = ("README.md", "lab/app.py", "lab/verify.py", "lab/assets/app.css", "lab/assets/app.js", "lab/assets/northline-mark.svg")

with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED) as archive:
    for name in FILES:
        info = ZipInfo(name)  # ZIP's fixed default date makes repackaging reproducible.
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, (SOURCE / name).read_bytes())

with ZipFile(OUTPUT) as archive:
    assert archive.namelist() == list(FILES)
    assert archive.testzip() is None
    for name in FILES:
        assert archive.read(name) == (SOURCE / name).read_bytes()

print(f"{OUTPUT.name}: {OUTPUT.stat().st_size} bytes; SHA-256 {sha256(OUTPUT.read_bytes()).hexdigest()}")
