# =====================================================================
#  UNIVERSITY OF LAKKI MARWAT — CENTRAL CAMPUS LIBRARY MANAGEMENT SYSTEM
#  Standalone 100% Offline Windows Desktop Application Builder (.exe)
#  C# .NET 8 WPF + WebView2 Host Mapped to https://app.local/
# =====================================================================

$ErrorActionPreference = "Stop"

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " UNIVERSITY OF LAKKI MARWAT — CENTRAL CAMPUS LIBRARY (ULM-LMS)" -ForegroundColor Yellow
Write-Host " 100% Offline Windows Desktop (.exe) Builder (C# .NET 8 + WebView2)" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Prerequisites
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm was not found. Please install Node.js LTS (https://nodejs.org)."
    exit 1
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Error ".NET SDK was not found. Please install the .NET 8.0 Desktop SDK."
    exit 1
}

# 2. Install & Build 100% Offline Frontend Bundle (dist/)
if (-not (Test-Path "node_modules")) {
    Write-Host "[STEP 1/4] Installing local npm packages..." -ForegroundColor Green
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed."
        exit 1
    }
}

Write-Host "[STEP 2/4] Compiling 100% Offline React + Vite Production Bundle (dist/)..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend production build (npm run build) failed."
    exit 1
}

# 3. Generate Multi-Resolution Windows Icon (app.ico: 16, 32, 48, 64, 128, 256) from public/image_0.png
$CrestPngPath = if (Test-Path "public/image_0.png") { "public/image_0.png" } elseif (Test-Path "public/ulm-crest.png") { "public/ulm-crest.png" } else { $null }
$IcoOutputPath = "windows-desktop/app.ico"

if ($CrestPngPath) {
    Write-Host "[STEP 3/4] Generating multi-size Windows icon (app.ico) from ULM 2017 Crest ($CrestPngPath)..." -ForegroundColor Green
    try {
        Add-Type -AssemblyName System.Drawing
        $srcBitmap = [System.Drawing.Bitmap]::new((Resolve-Path $CrestPngPath).Path)
        $sizes = @(16, 32, 48, 64, 128, 256)
        $pngStreams = New-Object System.Collections.Generic.List[byte[]]

        foreach ($sz in $sizes) {
            $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.DrawImage($srcBitmap, 0, 0, $sz, $sz)
            $g.Dispose()

            $ms = New-Object System.IO.MemoryStream
            $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $pngStreams.Add($ms.ToArray())
            $ms.Dispose()
            $bmp.Dispose()
        }
        $srcBitmap.Dispose()

        $fs = [System.IO.File]::Create((Join-Path (Get-Location) $IcoOutputPath))
        $bw = New-Object System.IO.BinaryWriter($fs)
        # ICONDIR Header
        $bw.Write([UInt16]0)
        $bw.Write([UInt16]1)
        $bw.Write([UInt16]$sizes.Count)

        $offset = 6 + (16 * $sizes.Count)
        for ($i = 0; $i -lt $sizes.Count; $i++) {
            $sz = $sizes[$i]
            $data = $pngStreams[$i]
            $bw.Write([byte]$(if ($sz -ge 256) { 0 } else { $sz }))
            $bw.Write([byte]$(if ($sz -ge 256) { 0 } else { $sz }))
            $bw.Write([byte]0)
            $bw.Write([byte]0)
            $bw.Write([UInt16]1)
            $bw.Write([UInt16]32)
            $bw.Write([UInt32]$data.Length)
            $bw.Write([UInt32]$offset)
            $offset += $data.Length
        }

        for ($i = 0; $i -lt $sizes.Count; $i++) {
            $bw.Write($pngStreams[$i])
        }
        $bw.Flush()
        $bw.Close()
        $fs.Close()
    } catch {
        Write-Warning "Note: Could not regenerate app.ico via System.Drawing ($_). Continuing with existing icon configuration."
    }
}

# 4. Sync dist/ into windows-desktop/wwwroot and Publish Standalone C# .NET 8 WPF + WebView2 Executable
Write-Host "[STEP 4/4] Publishing C# .NET 8 WPF + WebView2 Desktop Application..." -ForegroundColor Green
$WwwRoot = "windows-desktop/wwwroot"
if (Test-Path $WwwRoot) {
    Remove-Item -Recurse -Force $WwwRoot
}
Copy-Item -Recurse -Force "dist" $WwwRoot

dotnet restore windows-desktop/UniversityOfLakkiMarwatLMS.Desktop.csproj
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to restore .NET packages."
    exit 1
}

dotnet publish windows-desktop/UniversityOfLakkiMarwatLMS.Desktop.csproj `
    -c Release `
    -r win-x64 `
    --self-contained false `
    /p:PublishSingleFile=true `
    -o dist-desktop

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to publish Windows executable."
    exit 1
}

# Ensure dist-desktop/wwwroot has the offline frontend bundle right beside the .exe
$PublishedWwwRoot = "dist-desktop/wwwroot"
if (Test-Path $PublishedWwwRoot) {
    Remove-Item -Recurse -Force $PublishedWwwRoot
}
Copy-Item -Recurse -Force "dist" $PublishedWwwRoot

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host " [SUCCESS] Standalone Offline Windows Desktop (.exe) Built!" -ForegroundColor Yellow
Write-Host " Executable : dist-desktop\UniversityOfLakkiMarwatLMS.exe" -ForegroundColor White
Write-Host " Offline Web: dist-desktop\wwwroot (Mapped to https://app.local/)" -ForegroundColor White
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""
