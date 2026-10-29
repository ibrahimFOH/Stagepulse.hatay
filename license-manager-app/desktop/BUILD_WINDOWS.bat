@echo off
setlocal
cd /d "%~dp0"
py -3.11 -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements-build.txt
pyinstaller --noconfirm --clean --onefile --windowed --name StagepulseLisansYonetimi --add-data "..\assets;assets" main.py
echo EXE: dist\StagepulseLisansYonetimi.exe
pause
