# Icône de l'application Android (v0.87) à partir d'une image carrée (android/icon-source/).
#   ic_launcher / ic_launcher_round : anciennes icônes (image entière ; ronde : découpée en disque).
#   ic_launcher_foreground : icône adaptative (Android 8+), image réduite à 80 % de la zone de
#   108 dp pour que le masque du téléphone (cercle, carré arrondi…) ne coupe pas le dessin.
# Usage : powershell -File tools\android\make-icons.ps1 [-Source chemin.png]
param([string]$Source = "$PSScriptRoot\..\..\android\icon-source\android_vignette.png")
Add-Type -AssemblyName System.Drawing
$res = "$PSScriptRoot\..\..\android\app\src\main\res"
$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
$background = [System.Drawing.ColorTranslator]::FromHtml('#09090A')
$densities = @{ 'mdpi' = 1; 'hdpi' = 1.5; 'xhdpi' = 2; 'xxhdpi' = 3; 'xxxhdpi' = 4 }

function Save-Icon([int]$size, [string]$path, [double]$scale = 1, [switch]$Round) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  if ($Round) {
    $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
    $clip.AddEllipse(0, 0, $size, $size)
    $g.SetClip($clip)
  }
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $background), 0, 0, $size, $size)
  $w = [int][Math]::Round($size * $scale)
  $o = [int][Math]::Round(($size - $w) / 2)
  $g.DrawImage($src, $o, $o, $w, $w)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

foreach ($d in $densities.Keys) {
  $f = $densities[$d]
  $dir = "$res\mipmap-$d"
  Save-Icon ([int](48 * $f)) "$dir\ic_launcher.png"
  Save-Icon ([int](48 * $f)) "$dir\ic_launcher_round.png" -Round
  Save-Icon ([int](108 * $f)) "$dir\ic_launcher_foreground.png" 0.8
}
$src.Dispose()
# Fond de l'icône adaptative : le noir de l'image.
Set-Content -Encoding utf8 "$res\values\ic_launcher_background.xml" @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#09090A</color>
</resources>
'@
"icônes Android générées"

