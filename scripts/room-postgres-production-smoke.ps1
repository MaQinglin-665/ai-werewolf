[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $DatabaseUrl,
  [string] $BaseUrl,
  [int] $Port = 3010,
  [switch] $KeepServer,
  [switch] $RunActionSmoke,
  [switch] $SkipBuild,
  [switch] $SkipPrismaGenerate,
  [switch] $SkipInstall,
  [switch] $SkipRoomSmoke
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$TmpDir = Join-Path $RootDir "tmp"
$AppProcess = $null
$PreviousEnv = $null
$StartedApp = $false
$ExitCode = 0

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

function Wait-HttpOk {
  param(
    [string] $Url,
    [int] $TimeoutSeconds = 90
  )

  $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $Deadline) {
    try {
      $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 500) {
        return
      }
    } catch {
    }
    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for $Url."
}

function Set-TemporaryEnv {
  param([hashtable] $Values)

  $Previous = @{}
  foreach ($Key in $Values.Keys) {
    $Previous[$Key] = [Environment]::GetEnvironmentVariable($Key, "Process")
    [Environment]::SetEnvironmentVariable($Key, [string] $Values[$Key], "Process")
  }
  return $Previous
}

function Restore-TemporaryEnv {
  param([hashtable] $Previous)

  foreach ($Key in $Previous.Keys) {
    [Environment]::SetEnvironmentVariable($Key, $Previous[$Key], "Process")
  }
}

function Stop-AppServer {
  param(
    [System.Diagnostics.Process] $Process,
    [int] $ListenPort
  )

  if ($Process -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }

  $Listeners = Get-NetTCPConnection -LocalPort $ListenPort -State Listen -ErrorAction SilentlyContinue
  foreach ($Listener in $Listeners) {
    Stop-Process -Id $Listener.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

try {
  Write-Host "AI Werewolf PostgreSQL production smoke" -ForegroundColor Green
  Write-Note "Project: $RootDir"

  $script:NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $script:NpmCommand) {
    $script:NpmCommand = Get-Command npm -ErrorAction SilentlyContinue
  }
  if (-not $script:NpmCommand) {
    throw "npm was not found."
  }

  $NodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $NodeCommand) {
    throw "node was not found."
  }

  $NodeVersion = (& node -p "process.versions.node").Trim()
  $NodeMajor = [int] ($NodeVersion.Split(".")[0])
  if ($NodeMajor -lt 20) {
    throw "Node.js $NodeVersion is installed, but this project expects Node.js 20 or newer."
  }

  if (-not $BaseUrl) {
    $BaseUrl = "http://127.0.0.1:$Port"
  }
  $BaseUrl = $BaseUrl.TrimEnd("/")
  $HealthUrl = "$BaseUrl/api/rooms/health"

  if (-not (Test-Path -LiteralPath $TmpDir)) {
    New-Item -ItemType Directory -Path $TmpDir | Out-Null
  }

  $PreviousEnv = Set-TemporaryEnv @{
    AI_WEREWOLF_PUBLIC_ORIGIN = $BaseUrl
    AI_WEREWOLF_ROOM_DATABASE_URL = $DatabaseUrl
    AI_WEREWOLF_ROOM_DEPLOYMENT = "single-node-online"
    AI_WEREWOLF_ROOM_PRESENCE_ADAPTER = "postgres"
    AI_WEREWOLF_ROOM_PRESENCE_DATABASE_URL = $DatabaseUrl
    AI_WEREWOLF_ROOM_RATE_LIMIT = "1"
    AI_WEREWOLF_ROOM_RATE_LIMIT_ADAPTER = "postgres"
    AI_WEREWOLF_ROOM_RATE_LIMIT_DATABASE_URL = $DatabaseUrl
    AI_WEREWOLF_ROOM_REALTIME_ADAPTER = "postgres"
    AI_WEREWOLF_ROOM_STORE_ADAPTER = "postgres"
    ROOM_SMOKE_BASE_URL = $BaseUrl
  }

  Write-Step "Preparing app"
  if ($SkipInstall) {
    Write-Note "Skipped npm install"
  } else {
    Invoke-Npm @("install")
  }
  if ($SkipPrismaGenerate) {
    Write-Note "Skipped prisma:generate"
  } else {
    Invoke-Npm @("run", "prisma:generate")
  }
  if (-not $SkipBuild) {
    Invoke-Npm @("run", "build")
  } else {
    Write-Note "Skipped npm run build"
  }

  Write-Step "Starting production server"
  $ExistingListeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($ExistingListeners) {
    throw "Port $Port is already in use. Stop the existing server or pass a different -Port."
  }

  $AppOutLog = Join-Path $TmpDir "room-postgres-production-smoke-app.out.log"
  $AppErrLog = Join-Path $TmpDir "room-postgres-production-smoke-app.err.log"
  Remove-Item -LiteralPath $AppOutLog, $AppErrLog -ErrorAction SilentlyContinue

  $AppProcess = Start-Process `
    -FilePath $script:NpmCommand.Source `
    -ArgumentList @("run", "start", "--", "--hostname", "0.0.0.0", "--port", "$Port") `
    -WorkingDirectory $RootDir `
    -RedirectStandardOutput $AppOutLog `
    -RedirectStandardError $AppErrLog `
    -WindowStyle Hidden `
    -PassThru
  $StartedApp = $true

  Write-Note "App log: $AppOutLog"
  Wait-HttpOk $HealthUrl 120

  Write-Step "Running production preflight"
  Invoke-Npm @("run", "preflight:production", "--", "--base-url=$BaseUrl")

  if (-not $SkipRoomSmoke) {
    Write-Step "Running room SSE smoke"
    Invoke-Npm @("run", "smoke:room-sse")

    if ($RunActionSmoke) {
      Write-Step "Running room action smoke"
      Invoke-Npm @("run", "smoke:room-action")
    }
  } else {
    Write-Note "Skipped room smoke"
  }

  Write-Host ""
  Write-Host "PostgreSQL production smoke passed." -ForegroundColor Green
  Write-Host $BaseUrl -ForegroundColor Yellow
} catch {
  Write-Host ""
  Write-Host "PostgreSQL production smoke failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  $ExitCode = 1
} finally {
  if ($PreviousEnv) {
    Restore-TemporaryEnv $PreviousEnv
  }
  if (-not $KeepServer -and $StartedApp) {
    Stop-AppServer -Process $AppProcess -ListenPort $Port
  }
}

if ($ExitCode -ne 0) {
  exit $ExitCode
}
