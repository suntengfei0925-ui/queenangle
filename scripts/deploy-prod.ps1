param(
  [string]$ServerHost = "47.100.52.163",
  [string]$ServerUser = "admin",
  [string]$SshKey = ".temp\queenangle_deploy_ed25519",
  [string]$RemoteBase = "/opt/queenangle",
  [string]$EnvFile = "/etc/queenangle.env",
  [string]$HealthUrl = "http://47.100.52.163/api/health",
  [string]$ReleaseName = "",
  [switch]$SkipLocalChecks,
  [switch]$RequireCleanGit,
  [switch]$AllowMissingDatabase,
  [switch]$KeepPackage
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message"
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Run-External {
  param(
    [string]$Label,
    [string]$FilePath,
    [string[]]$Arguments
  )

  Write-Step $Label
  & $FilePath @Arguments
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    throw "$Label failed with exit code $code"
  }
}

function Invoke-Remote {
  param(
    [string]$Label,
    [string]$Command
  )

  Run-External $Label "ssh" ($script:SshArgs + @($script:Target, $Command))
}

function Upload-File {
  param(
    [string]$Label,
    [string]$LocalPath,
    [string]$RemotePath
  )

  Run-External $Label "scp" ($script:SshArgs + @($LocalPath, "$($script:Target):$RemotePath"))
}

function Test-Health {
  param(
    [string]$Url,
    [int]$Retries = 12,
    [int]$DelaySeconds = 3
  )

  Write-Step "Checking public health endpoint"
  for ($i = 1; $i -le $Retries; $i += 1) {
    try {
      if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        $body = & curl.exe -fsS --max-time 15 $Url
        if ($LASTEXITCODE -eq 0 -and ($body -join "`n") -match '"ok"\s*:\s*true') {
          Write-Host ($body -join "`n")
          return
        }
      } else {
        $resp = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 15
        if ($resp.ok -eq $true) {
          $resp | ConvertTo-Json -Compress
          return
        }
      }
    } catch {
      Write-Host "Health check attempt $i failed: $($_.Exception.Message)"
    }

    if ($i -lt $Retries) {
      Start-Sleep -Seconds $DelaySeconds
    }
  }

  throw "Health check failed: $Url"
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

if ([string]::IsNullOrWhiteSpace($ReleaseName)) {
  $ReleaseName = Get-Date -Format "yyyyMMdd-HHmmss"
}

if ($ReleaseName -notmatch "^[0-9A-Za-z._-]+$") {
  throw "ReleaseName may only contain letters, digits, dot, underscore, and hyphen."
}

$KeyPath = Resolve-Path (Join-Path $ProjectRoot $SshKey)
$TempDir = Join-Path $ProjectRoot ".temp"
$DeployTempDir = Join-Path $TempDir "deploy"
New-Item -ItemType Directory -Force -Path $DeployTempDir | Out-Null

$PackageName = "queenangle-web-$ReleaseName.tgz"
$PackagePath = Join-Path $DeployTempDir $PackageName
$RemotePackagePath = "/home/$ServerUser/$PackageName"
$ReleasePath = "$RemoteBase/releases/$ReleaseName"
$script:Target = "$ServerUser@$ServerHost"
$script:SshArgs = @(
  "-i", $KeyPath,
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=15",
  "-o", "ServerAliveInterval=30",
  "-o", "StrictHostKeyChecking=accept-new"
)

Require-Command "ssh"
Require-Command "scp"
Require-Command "tar"

Write-Step "Deployment summary"
Write-Host "Project root: $ProjectRoot"
Write-Host "Release: $ReleaseName"
Write-Host "Target: $script:Target"
Write-Host "Remote release: $ReleasePath"
Write-Host "Health URL: $HealthUrl"

if (Get-Command git -ErrorAction SilentlyContinue) {
  Write-Step "Inspecting git status"
  $gitStatus = & git -C $ProjectRoot status --short
  if ($LASTEXITCODE -ne 0) {
    throw "git status failed"
  }
  if ($gitStatus) {
    Write-Warning "Local tree has changes:"
    $gitStatus | ForEach-Object { Write-Host $_ }
    if ($RequireCleanGit) {
      throw "Local tree is dirty and -RequireCleanGit was supplied."
    }
  } else {
    Write-Host "Git tree is clean."
  }
}

if (-not $SkipLocalChecks) {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    Run-External "Checking server entrypoint syntax" "node" @("--check", "server/index.js")
    Run-External "Checking runtime syntax" "node" @("--check", "server/runtime.js")
    Run-External "Checking business module syntax" "node" @("--check", "server/business/index.js")
  } else {
    Write-Warning "node was not found locally; skipping node --check."
  }

  if (Get-Command docker -ErrorAction SilentlyContinue) {
    Run-External "Checking local Docker Compose config" "docker" @("compose", "config")
  } else {
    Write-Warning "docker was not found locally; skipping docker compose config."
  }
}

Invoke-Remote "Checking SSH login" "whoami"
Invoke-Remote "Checking production env file" "sudo test -f $EnvFile"
Invoke-Remote "Checking Docker Engine" "sudo docker version --format '{{.Server.Version}}'"
Invoke-Remote "Checking Docker Compose" "sudo docker compose version"
Invoke-Remote "Ensuring production directories exist" "sudo mkdir -p $RemoteBase/releases /var/lib/queenangle/db /var/lib/queenangle/uploads"

if (-not $AllowMissingDatabase) {
  Invoke-Remote "Checking production database exists" "sudo test -f /var/lib/queenangle/db/queenangle.sqlite"
}

if (Test-Path $PackagePath) {
  Remove-Item -Force $PackagePath
}

Run-External "Creating release package" "tar" @(
  "-czf", $PackagePath,
  "--exclude=.git",
  "--exclude=.temp",
  "--exclude=node_modules",
  "--exclude=web/node_modules",
  "--exclude=server/node_modules",
  "--exclude=data",
  "--exclude=uploads",
  "--exclude=.env",
  "--exclude=.env.*",
  "-C", $ProjectRoot,
  "."
)

$packageItem = Get-Item $PackagePath
Write-Host "Package: $($packageItem.FullName)"
Write-Host "Package bytes: $($packageItem.Length)"

Upload-File "Uploading release package" $PackagePath $RemotePackagePath
Invoke-Remote "Creating remote release directory" "sudo mkdir -p $ReleasePath"
Invoke-Remote "Extracting release package" "sudo tar -xzf $RemotePackagePath -C $ReleasePath"
Invoke-Remote "Activating release" "sudo ln -sfn $ReleasePath $RemoteBase/current"
Invoke-Remote "Building and starting Docker services" "sudo docker compose --env-file $EnvFile -f $RemoteBase/current/docker-compose.prod.yml --project-directory $RemoteBase/current up -d --build"
Invoke-Remote "Checking Docker service status" "sudo docker compose --env-file $EnvFile -f $RemoteBase/current/docker-compose.prod.yml --project-directory $RemoteBase/current ps"
Test-Health -Url $HealthUrl
Invoke-Remote "Removing uploaded package from server" "rm -f $RemotePackagePath"

if (-not $KeepPackage) {
  Remove-Item -Force $PackagePath
}

Write-Step "Deployment complete"
Write-Host "Release: $ReleaseName"
Write-Host "URL: $($HealthUrl -replace '/api/health$', '/')"
Write-Host "Production data was not copied or overwritten."
