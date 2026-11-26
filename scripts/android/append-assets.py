from pathlib import Path
from sys import argv
from zipfile import ZIP_DEFLATED, ZipFile


with ZipFile(argv[1], 'a', compression=ZIP_DEFLATED) as apk:
    apk.write('dex/classes.dex', 'classes.dex')
    for file in sorted(Path('assets').rglob('*')):
        if file.is_file():
            apk.write(file, file.as_posix())
