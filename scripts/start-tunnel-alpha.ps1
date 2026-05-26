[CmdletBinding()]
param(
  [int] $Port = 3004,
  [ValidateSet("production", "dev", "reuse")]
  [string] $AppMode = "production",
  [string] $TunnelCommand = "cloudflared",
  [ValidateSet("auto", "http2", "quic")]
  [string] $TunnelProtocol = "http2",
  [ValidateSet("auto", "4", "6")]
  [string] $TunnelEdgeIpVersion = "4",
  [switch] $SkipInstall,
  [switch] $SkipSmoke,
  [switch] $NoOpen
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$EnvPath = Join-Path $RootDir ".env"
$EnvExamplePath = Join-Path $RootDir ".env.example"
$TmpDir = Join-Path $RootDir "tmp"

$AppProcess = $null
$TunnelProcess = $null
$StartedAppServer = $false

Set-Location -LiteralPath $RootDir

function Write-Step {
  param([string] $Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Note {
  param([string] $Message)
  Write-Host "    $Message" -ForegroundColor DarkGray
}

function Invoke-Npm {
  param([string[]] $Arguments)
  & $script:NpmCommand @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Resolve-TunnelCommand {
  param([string] $Command)

  $Resolved = Get-Command $Command -ErrorAction SilentlyContinue
  if ($Resolved) {
    return $Resolved
  }

  if ($Command -ne "cloudflared") {
    return $null
  }

  $CandidatePatterns = @()
  if ($env:LOCALAPPDATA) {
    $CandidatePatterns += Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_*\cloudflared.exe"
  }
  if ($env:ProgramFiles) {
    $CandidatePatterns += Join-Path $env:ProgramFiles "cloudflared\cloudflared.exe"
  }
  if (${env:ProgramFiles(x86)}) {
    $CandidatePatterns += Join-Path ${env:ProgramFiles(x86)} "cloudflared\cloudflared.exe"
  }

  foreach ($Pattern in $CandidatePatterns) {
    $Candidate = Get-ChildItem -Path $Pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($Candidate) {
      return Get-Command $Candidate.FullName -ErrorAction SilentlyContinue
    }
  }

  return $null
}

function Test-HttpOk {
  param([string] $Url)
  try {
    $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $Response.StatusCode -ge 200 -and $Response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-HttpOk {
  param(
    [string] $Url,
    [int] $TimeoutSeconds = 90
  )

  $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $Deadline) {
    if (Test-HttpOk $Url) {
      return
    }
    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for $Url."
}

function Wait-TunnelOrigin {
  param(
    [string[]] $LogPaths,
    [int] $TimeoutSeconds = 90
  )

  $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $Deadline) {
    foreach ($Path in $LogPaths) {
      if (-not (Test-Path -LiteralPath $Path)) {
        continue
      }

      $Text = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path -ErrorAction SilentlyContinue
      $Match = [regex]::Match($Text, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
      if ($Match.Success) {
        return $Match.Value.TrimEnd("/")
      }
    }

    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for cloudflared to print a trycloudflare.com URL. Check the tunnel log files in $TmpDir."
}

try {
  Write-Host "AI Werewolf temporary public tunnel launcher" -ForegroundColor Green
  Write-Note "Project: $RootDir"

  Write-Step "Checking local tools"
  $NodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $NodeCommand) {
    throw "Node.js was not found. Install Node.js 20 or newer from https://nodejs.org/."
  }

  $script:NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $script:NpmCommand) {
    $script:NpmCommand = Get-Command npm -ErrorAction SilentlyContinue
  }
  if (-not $script:NpmCommand) {
    throw "npm was not found. Reinstall Node.js 20 or newer."
  }

  $Cloudflared = Resolve-TunnelCommand $TunnelCommand
  if (-not $Cloudflared) {
    throw "cloudflared was not found. Install it with: winget install Cloudflare.cloudflared"
  }

  $NodeVersion = (& node -p "process.versions.node").Trim()
  $NodeMajor = [int] ($NodeVersion.Split(".")[0])
  if ($NodeMajor -lt 20) {
    throw "Node.js $NodeVersion is installed, but this project expects Node.js 20 or newer."
  }
  Write-Note "Node.js $NodeVersion"
  Write-Note "Tunnel command: $($Cloudflared.Source)"
  Write-Note "App mode: $AppMode"
  Write-Note "Tunnel protocol: $TunnelProtocol"
  Write-Note "Tunnel edge IP version: $TunnelEdgeIpVersion"

  if (-not (Test-Path -LiteralPath $TmpDir)) {
    New-Item -ItemType Directory -Path $TmpDir | Out-Null
  }

  Write-Step "Preparing local app"
  if (-not (Test-Path -LiteralPath $EnvPath)) {
    if (-not (Test-Path -LiteralPath $EnvExamplePath)) {
      throw ".env.example was not found."
    }
    Copy-Item -LiteralPath $EnvExamplePath -Destination $EnvPath
    Write-Note "Created .env from .env.example"
  }

  if (-not $SkipInstall) {
    Invoke-Npm @("install")
  } else {
    Write-Note "Skipped npm install"
  }
  Invoke-Npm @("run", "prisma:generate")
  Invoke-Npm @("run", "db:push")

  $LocalOrigin = "http://127.0.0.1:$Port"
  $HealthUrl = "$LocalOrigin/api/rooms/health"
  if (Test-HttpOk $HealthUrl) {
    Write-Note "Reusing existing app at $LocalOrigin"
  } elseif ($AppMode -eq "reuse") {
    throw "No app is responding at $LocalOrigin. Start the app first or omit -AppMode reuse."
  } else {
    Write-Step "Starting local app"
    $env:AI_WEREWOLF_ROOM_DEPLOYMENT = "single-node"
    $env:AI_WEREWOLF_PUBLIC_ORIGIN = ""
    $env:AI_WEREWOLF_ROOM_PERSISTENCE = "1"

    $AppOutLog = Join-Path $TmpDir "tunnel-alpha-app.out.log"
    $AppErrLog = Join-Path $TmpDir "tunnel-alpha-app.err.log"
    Remove-Item -LiteralPath $AppOutLog, $AppErrLog -ErrorAction SilentlyContinue

    if ($AppMode -eq "production") {
      Write-Note "Building production app before opening the public tunnel"
      Invoke-Npm @("run", "build")
      $AppArgs = @("run", "start", "--", "--hostname", "0.0.0.0", "--port", "$Port")
    } else {
      $AppArgs = @("run", "dev", "--", "--hostname", "0.0.0.0", "--port", "$Port")
    }

    $AppProcess = Start-Process `
      -FilePath $script:NpmCommand.Source `
      -ArgumentList $AppArgs `
      -WorkingDirectory $RootDir `
      -RedirectStandardOutput $AppOutLog `
      -RedirectStandardError $AppErrLog `
      -WindowStyle Hidden `
      -PassThru
    $StartedAppServer = $true
    Write-Note "App log: $AppOutLog"
    Wait-HttpOk $HealthUrl 120
  }

  Write-Step "Starting temporary HTTPS tunnel"
  $TunnelOutLog = Join-Path $TmpDir "tunnel-alpha-cloudflared.out.log"
  $TunnelErrLog = Join-Path $TmpDir "tunnel-alpha-cloudflared.err.log"
  Remove-Item -LiteralPath $TunnelOutLog, $TunnelErrLog -ErrorAction SilentlyContinue
  $TunnelArgs = @("tunnel", "--url", $LocalOrigin, "--no-autoupdate")
  if ($TunnelProtocol -ne "auto") {
    $TunnelArgs += @("--protocol", $TunnelProtocol)
  }
  if ($TunnelEdgeIpVersion -ne "auto") {
    $TunnelArgs += @("--edge-ip-version", $TunnelEdgeIpVersion)
  }

  $TunnelProcess = Start-Process `
    -FilePath $Cloudflared.Source `
    -ArgumentList $TunnelArgs `
    -WorkingDirectory $RootDir `
    -RedirectStandardOutput $TunnelOutLog `
    -RedirectStandardError $TunnelErrLog `
    -WindowStyle Hidden `
    -PassThru

  $TunnelOrigin = Wait-TunnelOrigin @($TunnelOutLog, $TunnelErrLog) 90
  $RoomsUrl = "$TunnelOrigin/rooms"
  $MainUrl = $TunnelOrigin
  Write-Host ""
  Write-Host "Public main URL:" -ForegroundColor Green
  Write-Host $MainUrl -ForegroundColor Yellow
  Write-Note "Room lobby URL: $RoomsUrl"
  Write-Note "Tunnel log: $TunnelErrLog"

  if (-not $SkipSmoke) {
    Write-Step "Running public tunnel smoke"
    $PreviousSmokeBaseUrl = $env:ROOM_SMOKE_BASE_URL
    try {
      $env:ROOM_SMOKE_BASE_URL = $TunnelOrigin
      Invoke-Npm @("run", "smoke:tunnel")
    } finally {
      if ($null -eq $PreviousSmokeBaseUrl) {
        Remove-Item Env:\ROOM_SMOKE_BASE_URL -ErrorAction SilentlyContinue
      } else {
        $env:ROOM_SMOKE_BASE_URL = $PreviousSmokeBaseUrl
      }
    }
  } else {
    Write-Note "Skipped smoke:tunnel"
  }

  if (-not $NoOpen) {
    Start-Process $MainUrl
  }

  Write-Host ""
  Write-Host "Share this URL with friends while this window stays open:" -ForegroundColor Green
  Write-Host $MainUrl -ForegroundColor Yellow
  Write-Host "Press Ctrl+C to stop the tunnel." -ForegroundColor DarkGray

  while (-not $TunnelProcess.HasExited) {
    if ($StartedAppServer -and $AppProcess.HasExited) {
      throw "The local app stopped. Check $AppErrLog."
    }
    Start-Sleep -Seconds 2
  }
} catch {
  Write-Host ""
  Write-Host "Tunnel setup failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
} finally {
  if ($TunnelProcess -and -not $TunnelProcess.HasExited) {
    Stop-Process -Id $TunnelProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($StartedAppServer -and $AppProcess -and -not $AppProcess.HasExited) {
    Stop-Process -Id $AppProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
