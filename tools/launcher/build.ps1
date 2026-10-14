# Fabrique dist\Behourd.exe : le jeu complet + un petit serveur local (behourd_launcher.py).
# Usage (depuis la racine du projet) :  powershell -ExecutionPolicy Bypass -File tools\launcher\build.ps1
# Necessite Python (py). PyInstaller est installe dans un environnement isole (build\venv).

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$build = Join-Path $root 'build'
$venv = Join-Path $build 'venv'
$stage = Join-Path $build 'stage\game'
$dist = Join-Path $root 'dist'

if (-not (Test-Path (Join-Path $venv 'Scripts\python.exe'))) {
  Write-Host 'Creation de l environnement de fabrication (build\venv)...'
  py -m venv $venv
  & (Join-Path $venv 'Scripts\python.exe') -m pip install --quiet --upgrade pip pyinstaller
}
$python = Join-Path $venv 'Scripts\python.exe'

# Fichiers du jeu seulement (pas les tests ni les outils).
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item (Join-Path $root 'index.html') $stage
foreach ($dir in 'assets', 'css', 'data', 'src') { Copy-Item (Join-Path $root $dir) (Join-Path $stage $dir) -Recurse }

& $python -m PyInstaller --noconfirm --clean --onefile --console --name Behourd `
  --distpath $dist --workpath (Join-Path $build 'pyinstaller') --specpath $build `
  --add-data "$stage;game" `
  (Join-Path $PSScriptRoot 'behourd_launcher.py')

# Paquet a envoyer aux testeurs : Behourd.exe + LISEZ-MOI.txt, nomme d'apres la version du jeu.
$config = Get-Content (Join-Path $root 'src\config\gameConfig.js') -Raw
$version = if ($config -match "version:\s*'([^']+)'") { $Matches[1] } else { 'test' }
$package = Join-Path $build 'package\Behourd'
if (Test-Path (Join-Path $build 'package')) { Remove-Item (Join-Path $build 'package') -Recurse -Force }
New-Item -ItemType Directory -Force $package | Out-Null
Copy-Item (Join-Path $dist 'Behourd.exe') $package
Copy-Item (Join-Path $PSScriptRoot 'LISEZ-MOI.txt') $package
$zip = Join-Path $dist "Behourd-v$version-test.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $package -DestinationPath $zip

Write-Host ''
Write-Host "Executable : $(Join-Path $dist 'Behourd.exe')"
Write-Host "A envoyer  : $zip"
