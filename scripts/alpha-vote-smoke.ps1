[CmdletBinding()]
param(
  [int] $Port = 3103,
  [int] $MaxSteps = 320,
  [switch] $Build,
  [switch] $SkipBuild,
  [switch] $KeepServer
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$BuildIdPath = Join-Path $RootDir ".next\BUILD_ID"

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

function Find-AvailablePort {
  param([int] $PreferredPort)

  $Listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
  $UsedPorts = @{}
  foreach ($Listener in $Listeners) {
    $UsedPorts[$Listener.Port] = $true
  }

  for ($Candidate = $PreferredPort; $Candidate -lt ($PreferredPort + 50); $Candidate += 1) {
    if (-not $UsedPorts.ContainsKey($Candidate)) {
      return $Candidate
    }
  }

  throw "No available local port found near $PreferredPort."
}

function Get-ProjectNextDevProcesses {
  return @(
    Get-CimInstance Win32_Process |
      Where-Object {
        $_.CommandLine -and
        $_.CommandLine -like "*$RootDir*" -and
        $_.CommandLine -like "*next*" -and
        $_.CommandLine -like "*dev*"
      }
  )
}

function Stop-ProcessTree {
  param([int] $ProcessId)

  $Children = @(Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $ProcessId })
  foreach ($Child in $Children) {
    Stop-ProcessTree -ProcessId $Child.ProcessId
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Wait-ForHealth {
  param([string] $BaseUrl)

  for ($Attempt = 0; $Attempt -lt 90; $Attempt += 1) {
    try {
      $Response = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/health" -UseBasicParsing -TimeoutSec 2
      if ($Response.StatusCode -eq 200) {
        return
      }
    } catch {
    }
    Start-Sleep -Seconds 1
  }

  throw "Temporary mock alpha server did not become ready at $BaseUrl."
}

function Show-LogTail {
  param([string] $Path, [string] $Label)

  if (Test-Path -LiteralPath $Path) {
    Write-Host ""
    Write-Host "${Label}:" -ForegroundColor Yellow
    Get-Content -LiteralPath $Path -Tail 80
  }
}

try {
  $script:NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $script:NpmCommand) {
    $script:NpmCommand = Get-Command npm -ErrorAction SilentlyContinue
  }
  if (-not $script:NpmCommand) {
    throw "npm was not found."
  }

  $DevProcesses = Get-ProjectNextDevProcesses
  $ShouldBuild = $Build -or (-not $SkipBuild -and $DevProcesses.Count -eq 0)

  if ($ShouldBuild) {
    Write-Step "Building production bundle"
    Invoke-Npm @("run", "build")
  } elseif (Test-Path -LiteralPath $BuildIdPath) {
    if ($DevProcesses.Count -gt 0) {
      Write-Note "Detected an active next dev server for this project; reusing the existing production build to avoid touching it."
    } else {
      Write-Note "Skipping build and reusing existing production build."
    }
  } else {
    throw "No production build found. Stop the dev server and rerun this command, or run npm run build first."
  }

  $SelectedPort = Find-AvailablePort $Port
  $BaseUrl = "http://127.0.0.1:$SelectedPort"
  $RunStamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $StorePath = Join-Path $RootDir ".local\rooms-alpha-vote-smoke-$RunStamp-$SelectedPort.json"
  $StdoutPath = Join-Path $env:TEMP "ai-werewolf-alpha-vote-$SelectedPort.out.log"
  $StderrPath = Join-Path $env:TEMP "ai-werewolf-alpha-vote-$SelectedPort.err.log"

  $ServerCommand = @"
`$env:AI_SPEECH_PROVIDER='mock'
`$env:AI_ACTION_PROVIDER='mock'
`$env:AI_DECISION_PROVIDER=''
`$env:AI_LLM_PROVIDER='mock'
`$env:AI_PROVIDER=''
`$env:AI_SPEECH_STRICTNESS='guided'
`$env:AI_WEREWOLF_ROOM_STORE_PATH='$StorePath'
npm run start -- --port $SelectedPort
"@

  Write-Step "Starting temporary mock alpha server"
  Write-Note $BaseUrl
  $ServerProcess = Start-Process `
    -FilePath "powershell" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $ServerCommand) `
    -WorkingDirectory $RootDir `
    -RedirectStandardOutput $StdoutPath `
    -RedirectStandardError $StderrPath `
    -WindowStyle Hidden `
    -PassThru

  try {
    Wait-ForHealth $BaseUrl

    Write-Step "Running vote-chain alpha smoke"
    $env:ROOM_SMOKE_BASE_URL = $BaseUrl
    $env:ROOM_ACTION_SMOKE_MAX_STEPS = [string] $MaxSteps
    Invoke-Npm @("run", "smoke:alpha:vote")
  } finally {
    Remove-Item Env:\ROOM_SMOKE_BASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:\ROOM_ACTION_SMOKE_MAX_STEPS -ErrorAction SilentlyContinue

    if ($KeepServer) {
      Write-Note "Keeping temporary server running at $BaseUrl"
    } elseif ($ServerProcess -and -not $ServerProcess.HasExited) {
      Stop-ProcessTree -ProcessId $ServerProcess.Id
    }
  }
} catch {
  Show-LogTail $StdoutPath "temporary server stdout"
  Show-LogTail $StderrPath "temporary server stderr"
  Write-Host ""
  Write-Host "Alpha vote smoke failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
