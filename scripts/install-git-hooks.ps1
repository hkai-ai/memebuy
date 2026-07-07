param(
  [string]$HooksPath = ".githooks",
  [switch]$Verify
)

$ErrorActionPreference = "Stop"

function Fail($Message) {
  Write-Error $Message
  exit 1
}

$repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) {
  Fail "Not inside a Git repository."
}

$hookDir = Join-Path $repoRoot $HooksPath
$preCommitHook = Join-Path $hookDir "pre-commit"

if (-not (Test-Path -LiteralPath $preCommitHook)) {
  Fail "Missing pre-commit hook: $preCommitHook"
}

& git -C $repoRoot config core.hooksPath $HooksPath

Write-Host "Installed Git hooks for this repository."
Write-Host "Repo:      $repoRoot"
Write-Host "HooksPath: $HooksPath"

if ($Verify) {
  Write-Host "Running pre-commit hook once for verification..."
  & git -C $repoRoot hook run pre-commit
}
