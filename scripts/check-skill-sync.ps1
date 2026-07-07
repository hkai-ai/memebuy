param(
  [string]$SkillName = "meme-template-analyzer",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$GlobalSkillsRoot = (Join-Path $env:USERPROFILE ".codex\skills")
)

$ErrorActionPreference = "Stop"

function Fail($Message) {
  Write-Error $Message
  exit 1
}

function Read-Manifest($Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    Fail "Missing manifest: $Path"
  }
  return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
}

function Get-Hash($Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

$repoSkill = Join-Path $RepoRoot "skills\$SkillName"
$globalSkill = Join-Path $GlobalSkillsRoot $SkillName

if (-not (Test-Path -LiteralPath $repoSkill)) {
  Fail "Missing repo skill directory: $repoSkill"
}
if (-not (Test-Path -LiteralPath $globalSkill)) {
  Fail "Missing global skill directory: $globalSkill"
}

$repoManifestPath = Join-Path $repoSkill "skill-manifest.json"
$globalManifestPath = Join-Path $globalSkill "skill-manifest.json"
$repoManifest = Read-Manifest $repoManifestPath
$globalManifest = Read-Manifest $globalManifestPath

$problems = New-Object System.Collections.Generic.List[string]

if ($repoManifest.name -ne $globalManifest.name) {
  $problems.Add("Name mismatch: repo=$($repoManifest.name), global=$($globalManifest.name)")
}
if ($repoManifest.version -ne $globalManifest.version) {
  $problems.Add("Version mismatch: repo=$($repoManifest.version), global=$($globalManifest.version)")
}

$trackedFiles = @($repoManifest.tracked_files)
foreach ($file in $trackedFiles) {
  $repoFile = Join-Path $repoSkill $file
  $globalFile = Join-Path $globalSkill $file

  $repoHash = Get-Hash $repoFile
  $globalHash = Get-Hash $globalFile

  if ($null -eq $repoHash) {
    $problems.Add("Missing repo tracked file: $file")
    continue
  }
  if ($null -eq $globalHash) {
    $problems.Add("Missing global tracked file: $file")
    continue
  }
  if ($repoHash -ne $globalHash) {
    $problems.Add("Hash mismatch: $file")
  }
}

if ($problems.Count -gt 0) {
  Write-Host "Skill sync check failed for '$SkillName'."
  Write-Host "Repo:   $repoSkill"
  Write-Host "Global: $globalSkill"
  $problems | ForEach-Object { Write-Host "- $_" }
  exit 1
}

Write-Host "Skill sync check passed for '$SkillName'."
Write-Host "Version: $($repoManifest.version)"
Write-Host "Repo:    $repoSkill"
Write-Host "Global:  $globalSkill"
