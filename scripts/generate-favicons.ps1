# Run from PowerShell on Windows. Resize the existing emblem; never redraw it.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$publicRoot = Join-Path $projectRoot 'public'
$source = [System.Drawing.Bitmap]::new((Join-Path $publicRoot 'assets/brand/m1000z-logo.png'))
try {
    $pngs = @{}
    foreach ($size in @(16, 32, 48, 96, 180)) {
        $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $stream = [System.IO.MemoryStream]::new()
        try {
            $graphics.Clear([System.Drawing.Color]::Black)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
            try {
                $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
                $scale = [Math]::Min($size / $source.Width, $size / $source.Height)
                $width = [int][Math]::Round($source.Width * $scale)
                $height = [int][Math]::Round($source.Height * $scale)
                $bounds = [System.Drawing.Rectangle]::new([int](($size - $width) / 2), [int](($size - $height) / 2), $width, $height)
                $graphics.DrawImage($source, $bounds, 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
            } finally { $attributes.Dispose() }
            $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
            $pngs[$size] = $stream.ToArray()
        } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    }
    foreach ($size in @(32, 96)) {
        [System.IO.File]::WriteAllBytes((Join-Path $publicRoot "favicon-${size}x${size}.png"), $pngs[$size])
    }
    [System.IO.File]::WriteAllBytes((Join-Path $publicRoot 'apple-touch-icon.png'), $pngs[180])
    # Modern ICO readers support PNG frames. Include both browser and search sizes.
    $icoSizes = @(16, 32, 48, 96)
    $ico = [System.IO.MemoryStream]::new()
    $writer = [System.IO.BinaryWriter]::new($ico)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$icoSizes.Count)
        $offset = 6 + 16 * $icoSizes.Count
        foreach ($size in $icoSizes) {
            $writer.Write([byte]$size); $writer.Write([byte]$size)
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$pngs[$size].Length); $writer.Write([uint32]$offset)
            $offset += $pngs[$size].Length
        }
        foreach ($size in $icoSizes) { $writer.Write([byte[]]$pngs[$size]) }
        $writer.Flush()
        [System.IO.File]::WriteAllBytes((Join-Path $publicRoot 'favicon.ico'), $ico.ToArray())
    } finally { $writer.Dispose(); $ico.Dispose() }
} finally { $source.Dispose() }
Write-Output 'Generated favicon.ico (16, 32, 48, 96), 32px/96px PNGs, and 180px Apple icon from the existing emblem.'
