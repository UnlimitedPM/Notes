Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\public\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-MasterBitmap {
  $bmp = New-Object System.Drawing.Bitmap 1024, 1024
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)

  # Fond jaune arrondi
  $bg = New-RoundedPath 0 0 1024 1024 232
  $yellow = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#FFB300'))
  $g.FillPath($yellow, $bg)

  # Page blanche
  $page = New-RoundedPath 252 200 520 624 60
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $g.FillPath($white, $page)

  # Ligne de titre
  $title = New-RoundedPath 352 352 320 40 20
  $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#E09B00'))
  $g.FillPath($accent, $title)

  # Lignes de texte
  $gray = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#E4E4EA'))
  $g.FillPath($gray, (New-RoundedPath 352 464 320 32 16))
  $g.FillPath($gray, (New-RoundedPath 352 564 320 32 16))
  $g.FillPath($gray, (New-RoundedPath 352 664 208 32 16))

  $g.Dispose()
  return $bmp
}

function Save-Resized($master, [int]$size, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($master, 0, 0, $size, $size)
  $g.Dispose()
  $target = Join-Path $outDir $name
  $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "OK $target"
}

$master = New-MasterBitmap
Save-Resized $master 192 'icon-192.png'
Save-Resized $master 512 'icon-512.png'
Save-Resized $master 512 'maskable-512.png'
Save-Resized $master 180 'apple-touch-icon.png'
$master.Dispose()
