# Draws the Roku app's icons and splash screen from the site logo (assets/icon-512.png).
# Run from the repo root on Windows: powershell -File roku/make-images.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$logo = [System.Drawing.Image]::FromFile((Join-Path $root "assets\icon-512.png"))
$bg = [System.Drawing.Color]::FromArgb(33, 24, 16)
$amber = [System.Drawing.Color]::FromArgb(232, 163, 61)
$cream = [System.Drawing.Color]::FromArgb(201, 185, 154)

function Make($w, $h, $logoSize, $title, $sub, $out) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"; $g.InterpolationMode = "HighQualityBicubic"; $g.TextRenderingHint = "AntiAliasGridFit"
  $g.Clear($bg)
  $ly = [int]($h * 0.40 - $logoSize / 2)
  # The logo is a square tile with its own dark background: round its corners and edge it in amber.
  $lx = [int](($w - $logoSize) / 2); $r = [int]($logoSize * 0.18)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($lx, $ly, 2 * $r, 2 * $r, 180, 90); $path.AddArc($lx + $logoSize - 2 * $r, $ly, 2 * $r, 2 * $r, 270, 90)
  $path.AddArc($lx + $logoSize - 2 * $r, $ly + $logoSize - 2 * $r, 2 * $r, 2 * $r, 0, 90); $path.AddArc($lx, $ly + $logoSize - 2 * $r, 2 * $r, 2 * $r, 90, 90)
  $path.CloseFigure()
  $g.SetClip($path); $g.DrawImage($logo, $lx, $ly, $logoSize, $logoSize); $g.ResetClip()
  $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 232, 163, 61)), ([float][math]::Max(2, $logoSize / 120))), $path)
  $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = "Center"
  $font = New-Object System.Drawing.Font "Georgia", ([float]($h * 0.07)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString($title, $font, (New-Object System.Drawing.SolidBrush $amber), (New-Object System.Drawing.RectangleF 0, ($ly + $logoSize + $h * 0.03), $w, ($h * 0.1)), $fmt)
  if ($sub) {
    $font2 = New-Object System.Drawing.Font "Georgia", ([float]($h * 0.032)), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString($sub, $font2, (New-Object System.Drawing.SolidBrush $cream), (New-Object System.Drawing.RectangleF 0, ($ly + $logoSize + $h * 0.115), $w, ($h * 0.06)), $fmt)
  }
  $g.Dispose()
  $bmp.Save((Join-Path $PSScriptRoot "images\$out"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Make 540 405 250 "Rabbit-Ears" $null "icon_fhd.png"
Make 290 218 134 "Rabbit-Ears" $null "icon_hd.png"
Make 1920 1080 420 "Rabbit-Ears.stream" "Forgotten TV, around the clock" "splash_fhd.png"
$logo.Dispose()
Get-ChildItem (Join-Path $PSScriptRoot "images") | Select-Object Name, Length
