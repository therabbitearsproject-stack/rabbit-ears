# Zips the Roku app for sideloading (Roku Developer Mode) or uploading to the Roku Channel Store.
# Run from anywhere on Windows: powershell -File roku/package.ps1
# Writes roku/out/rabbit-ears-roku.zip. Entries use forward slashes, which Roku requires
# (PowerShell's Compress-Archive writes backslashes, which Roku rejects).
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$src = $PSScriptRoot
$outDir = Join-Path $src "out"
New-Item -ItemType Directory -Force $outDir | Out-Null
$zipPath = Join-Path $outDir "rabbit-ears-roku.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Confirm:$false }
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, "Create")
foreach ($part in @("manifest", "source", "components", "images")) {
  Get-ChildItem (Join-Path $src $part) -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $name = $_.FullName.Substring($src.Length + 1).Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $name) | Out-Null
  }
}
$zip.Dispose()
Write-Output "Made $zipPath ($([math]::Round((Get-Item $zipPath).Length / 1KB)) KB)"
