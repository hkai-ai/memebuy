param(
  [string]$SkillName = "meme-template-analyzer",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$GlobalSkillsRoot = (Join-Path $env:USERPROFILE ".codex\skills"),
  [switch]$Clean
)

$ErrorActionPreference = "Stop"

function Fail($Message) {
  Write-Error $Message
  exit 1
}

$repoSkill = Join-Path $RepoRoot "skills\$SkillName"
$globalSkill = Join-Path $GlobalSkillsRoot $SkillName
$manifest = Join-Path $repoSkill "skill-manifest.json"

if (-not (Test-Path -LiteralPath $repoSkill)) {
  Fail "Missing repo skill directory: $repoSkill"
}
if (-not (Test-Path -LiteralPath $manifest)) {
  Fail "Missing repo skill manifest: $manifest"
}

$repoSkillResolved = (Resolve-Path -LiteralPath $repoSkill).Path
$globalRootResolved = if (Test-Path -LiteralPath $GlobalSkillsRoot) {
  (Resolve-Path -LiteralPath $GlobalSkillsRoot).Path
} else {
  New-Item -ItemType Directory -Path $GlobalSkillsRoot -Force | Out-Null
  (Resolve-Path -LiteralPath $GlobalSkillsRoot).Path
}

$globalSkillParent = Split-Path -Parent $globalSkill
if (-not (Test-Path -LiteralPath $globalSkillParent)) {
  New-Item -ItemType Directory -Path $globalSkillParent -Force | Out-Null
}

if ($Clean -and (Test-Path -LiteralPath $globalSkill)) {
  $globalSkillResolved = (Resolve-Path -LiteralPath $globalSkill).Path
  if (-not $globalSkillResolved.StartsWith($globalRootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
    Fail "Refusing to clean outside global skills root: $globalSkillResolved"
  }
  Remove-Item -LiteralPath $globalSkillResolved -Recurse -Force
}

New-Item -ItemType Directory -Path $globalSkill -Force | Out-Null
Get-ChildItem -LiteralPath $repoSkillResolved -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $globalSkill -Recurse -Force
}

Write-Host "Synced skill '$SkillName' from repo to global runtime copy."
Write-Host "Repo:   $repoSkillResolved"
Write-Host "Global: $globalSkill"

& (Join-Path $PSScriptRoot "check-skill-sync.ps1") -SkillName $SkillName -RepoRoot $RepoRoot -GlobalSkillsRoot $GlobalSkillsRoot
