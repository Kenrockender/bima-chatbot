# BIMA — deploy backend/ to the Hugging Face Space via git subtree.
# backend/ is the single source of truth; this pushes its contents as the
# Space repo's root. Only git-tracked files go up, so gitignored secrets
# (.env, *firebase-adminsdk*.json, data/, .venv/) never leave your machine.
#
# One-time setup — register the Space remote (replace <your-hf-user>):
#   git remote add hf-space https://huggingface.co/spaces/<your-hf-user>/bima-backend
#
# Usage:  .\scripts\deploy-backend.ps1            (push to branch "main")
#         .\scripts\deploy-backend.ps1 master     (push to a different branch)
#
# You'll be prompted for an HF access token (write scope) as the password.

param([string]$Branch = "main")

$ErrorActionPreference = "Stop"

# Run from the repo root regardless of where the script is invoked.
$repoRoot = git rev-parse --show-toplevel
Set-Location $repoRoot

if (-not (git remote | Select-String -SimpleMatch "hf-space")) {
    Write-Host "Remote 'hf-space' is not set. Add it once with:" -ForegroundColor Yellow
    Write-Host "  git remote add hf-space https://huggingface.co/spaces/<your-hf-user>/bima-backend" -ForegroundColor Yellow
    exit 1
}

# Refuse to deploy a dirty backend/ — commit first so the Space matches the repo.
if (git status --porcelain -- backend) {
    Write-Host "backend/ has uncommitted changes. Commit them before deploying." -ForegroundColor Yellow
    git status --short -- backend
    exit 1
}

# Split backend/ into a synthetic commit, then force-push it as the Space root.
# The Space repo's history is a throwaway deploy artifact and is unrelated to this
# subtree, so a plain `git subtree push` would be rejected — force-push is correct.
Write-Host "Splitting backend/ subtree ..." -ForegroundColor Cyan
$sha = (git subtree split --prefix=backend HEAD).Trim()

Write-Host "Force-pushing $sha to hf-space/$Branch ..." -ForegroundColor Cyan
git push hf-space "${sha}:refs/heads/$Branch" --force
Write-Host "Done. The Space rebuilds automatically." -ForegroundColor Green
