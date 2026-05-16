[CmdletBinding()]
param(
  [ValidateSet("app", "real", "mock", "keep")]
  [string] $Mode,
  [string] $BaseUrl,
  [string] $ApiKey,
  [string] $Model,
  [string] $DeepSeekModel,
  [string] $ClaudeModel,
  [string] $GptModel,
  [string] $DoubaoModel,
  [string] $MimoModel,
  [string] $GeminiModel,
  [string] $GlmModel,
  [string] $KimiModel,
  [int] $Port = 3000,
  [switch] $SkipInstall,
  [switch] $NoOpen
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$EnvPath = Join-Path $RootDir ".env"
$EnvExamplePath = Join-Path $RootDir ".env.example"
$InitialPath = "/"

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

function Read-EnvFile {
  param([string] $Path)
  $Values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $Values
  }

  foreach ($Line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    if ($Line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $Key = $Matches[1]
      $Value = $Matches[2].Trim()
      if (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or ($Value.StartsWith("'") -and $Value.EndsWith("'"))) {
        $Value = $Value.Substring(1, $Value.Length - 2)
      }
      $Values[$Key] = $Value
    }
  }
  return $Values
}

function Format-EnvValue {
  param([string] $Value)
  return '"' + ($Value -replace '"', '\"') + '"'
}

function Set-EnvValues {
  param(
    [string] $Path,
    [hashtable] $Values
  )

  $Lines = @()
  if (Test-Path -LiteralPath $Path) {
    $Lines = @(Get-Content -LiteralPath $Path -Encoding UTF8)
  }

  $Seen = @{}
  for ($Index = 0; $Index -lt $Lines.Count; $Index += 1) {
    $Line = $Lines[$Index]
    if ($Line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
      $Key = $Matches[1]
      if ($Values.ContainsKey($Key)) {
        $Lines[$Index] = "$Key=$(Format-EnvValue ([string] $Values[$Key]))"
        $Seen[$Key] = $true
      }
    }
  }

  foreach ($Key in $Values.Keys) {
    if (-not $Seen.ContainsKey($Key)) {
      $Lines += "$Key=$(Format-EnvValue ([string] $Values[$Key]))"
    }
  }

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Read-SecretText {
  param([string] $Prompt)
  $Secure = Read-Host $Prompt -AsSecureString
  $Ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Ptr)
  } finally {
    if ($Ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Ptr)
    }
  }
}

function Read-WithDefault {
  param(
    [string] $Prompt,
    [string] $DefaultValue
  )

  if ($DefaultValue) {
    $Value = Read-Host "$Prompt [$DefaultValue]"
    if ([string]::IsNullOrWhiteSpace($Value)) {
      return $DefaultValue
    }
    return $Value.Trim()
  }

  return (Read-Host $Prompt).Trim()
}

function Get-ModelRoutes {
  return @(
    @{ Env = "AI_MODEL_DEEPSEEK"; Label = "DeepSeek"; Value = $DeepSeekModel },
    @{ Env = "AI_MODEL_CLAUDE"; Label = "Claude"; Value = $ClaudeModel },
    @{ Env = "AI_MODEL_GPT"; Label = "GPT"; Value = $GptModel },
    @{ Env = "AI_MODEL_DOUBAO"; Label = "Doubao"; Value = $DoubaoModel },
    @{ Env = "AI_MODEL_MIMO"; Label = "Mimo"; Value = $MimoModel },
    @{ Env = "AI_MODEL_GEMINI"; Label = "Gemini"; Value = $GeminiModel },
    @{ Env = "AI_MODEL_GLM"; Label = "GLM"; Value = $GlmModel },
    @{ Env = "AI_MODEL_KIMI"; Label = "Kimi"; Value = $KimiModel }
  )
}

function Read-ModelRouteValues {
  param(
    [hashtable] $CurrentEnv,
    [string] $FallbackModel
  )

  $RouteValues = @{}
  foreach ($Route in Get-ModelRoutes) {
    $ExistingValue = [string] $Route.Value
    if ([string]::IsNullOrWhiteSpace($ExistingValue)) {
      $ExistingValue = [string] $CurrentEnv[$Route.Env]
    }
    if ([string]::IsNullOrWhiteSpace($ExistingValue)) {
      $ExistingValue = $FallbackModel
    }

    $RouteValues[$Route.Env] = Read-WithDefault "$($Route.Label) model name" $ExistingValue
    if ([string]::IsNullOrWhiteSpace($RouteValues[$Route.Env])) {
      throw "$($Route.Label) model name is required."
    }
  }
  return $RouteValues
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

function Start-BrowserWhenReady {
  param([string] $Url)

  if ($NoOpen) {
    return
  }

  Start-Job -ScriptBlock {
    param([string] $TargetUrl)
    for ($Attempt = 0; $Attempt -lt 90; $Attempt += 1) {
      try {
        $Response = Invoke-WebRequest -Uri $TargetUrl -UseBasicParsing -TimeoutSec 2
        if ($Response.StatusCode -ge 200) {
          Start-Process $TargetUrl
          return
        }
      } catch {
      }
      Start-Sleep -Seconds 1
    }
  } -ArgumentList $Url | Out-Null
}

try {
  Write-Host "AI Werewolf Alpha first-run launcher" -ForegroundColor Green
  Write-Note "Project: $RootDir"

  Write-Step "Checking Node.js"
  $NodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $NodeCommand) {
    throw "Node.js was not found. Install Node.js 20 or newer from https://nodejs.org/ and run this launcher again."
  }

  $script:NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $script:NpmCommand) {
    $script:NpmCommand = Get-Command npm -ErrorAction SilentlyContinue
  }
  if (-not $script:NpmCommand) {
    throw "npm was not found. Reinstall Node.js 20 or newer from https://nodejs.org/."
  }

  $NodeVersion = (& node -p "process.versions.node").Trim()
  $NodeMajor = [int] ($NodeVersion.Split(".")[0])
  if ($NodeMajor -lt 20) {
    throw "Node.js $NodeVersion is installed, but this project expects Node.js 20 or newer."
  }
  Write-Note "Node.js $NodeVersion"

  Write-Step "Preparing .env"
  if (-not (Test-Path -LiteralPath $EnvPath)) {
    if (-not (Test-Path -LiteralPath $EnvExamplePath)) {
      throw ".env.example was not found."
    }
    Copy-Item -LiteralPath $EnvExamplePath -Destination $EnvPath
    Write-Note "Created .env from .env.example"
  } else {
    Write-Note "Using existing .env"
  }

  $CurrentEnv = Read-EnvFile $EnvPath

  if (-not $Mode) {
    Write-Host ""
    Write-Host "Choose startup mode:"
    Write-Host "  1. Open AI Pool and configure model keys in the app (recommended)"
    Write-Host "  2. Local mock mode (fast, no API key)"
    Write-Host "  3. Keep current .env"
    Write-Host "  4. Legacy terminal real-model setup"
    $Choice = Read-Host "Enter 1/2/3/4 (default 1)"
    switch ($Choice) {
      "2" { $Mode = "mock" }
      "3" { $Mode = "keep" }
      "4" { $Mode = "real" }
      default { $Mode = "app" }
    }
  }

  if ($Mode -eq "app") {
    Set-EnvValues $EnvPath @{
      AI_SPEECH_PROVIDER = "mock"
      AI_ACTION_PROVIDER = "mock"
      AI_DECISION_PROVIDER = ""
      AI_LLM_PROVIDER = "mock"
      AI_PROVIDER = ""
      AI_SPEECH_STRICTNESS = "guided"
    }
    $InitialPath = "/ai-pool"
    Write-Note "Configured local startup mode. Add real model keys in the AI Pool page."
  } elseif ($Mode -eq "real") {
    $DefaultBaseUrl = if ($CurrentEnv["AI_LLM_BASE_URL"]) { $CurrentEnv["AI_LLM_BASE_URL"] } else { "https://api.openai.com/v1" }
    $DefaultModel = if ($CurrentEnv["AI_MODEL_GPT"]) { $CurrentEnv["AI_MODEL_GPT"] } elseif ($CurrentEnv["OPENAI_MODEL"]) { $CurrentEnv["OPENAI_MODEL"] } else { "gpt-4.1-mini" }

    if (-not $BaseUrl) {
      $BaseUrl = Read-WithDefault "OpenAI-compatible base URL" $DefaultBaseUrl
    }
    if (-not $ApiKey) {
      $ApiKey = Read-SecretText "API key"
    }

    if ([string]::IsNullOrWhiteSpace($BaseUrl) -or [string]::IsNullOrWhiteSpace($ApiKey)) {
      throw "Real model mode requires a base URL and API key."
    }

    $UseExistingRoutes = $false
    $ModelRoutes = @{}
    if ($Model) {
      foreach ($Route in Get-ModelRoutes) {
        $ModelRoutes[$Route.Env] = $Model.Trim()
      }
    } else {
      Write-Host ""
      Write-Host "Choose model routing:"
      Write-Host "  1. Configure 8 model names (best for showing the project feature)"
      Write-Host "  2. Use one model for every AI seat"
      Write-Host "  3. Keep current AI_MODEL_* values"
      $RouteChoice = Read-Host "Enter 1/2/3 (default 1)"
      switch ($RouteChoice) {
        "2" {
          $OneModel = Read-WithDefault "Model name for all AI seats" $DefaultModel
          if ([string]::IsNullOrWhiteSpace($OneModel)) {
            throw "Model name is required."
          }
          foreach ($Route in Get-ModelRoutes) {
            $ModelRoutes[$Route.Env] = $OneModel.Trim()
          }
        }
        "3" {
          $UseExistingRoutes = $true
        }
        default {
          $ModelRoutes = Read-ModelRouteValues $CurrentEnv $DefaultModel
        }
      }
    }

    if ($UseExistingRoutes) {
      foreach ($Route in Get-ModelRoutes) {
        $ExistingRouteValue = [string] $CurrentEnv[$Route.Env]
        if ([string]::IsNullOrWhiteSpace($ExistingRouteValue)) {
          $ExistingRouteValue = $DefaultModel
        }
        $ModelRoutes[$Route.Env] = $ExistingRouteValue.Trim()
      }
    }

    $EnvUpdates = @{
      AI_SPEECH_PROVIDER = "models"
      AI_ACTION_PROVIDER = "models"
      AI_DECISION_PROVIDER = ""
      AI_LLM_PROVIDER = "models"
      AI_PROVIDER = ""
      AI_SPEECH_STRICTNESS = "guided"
      AI_LLM_BASE_URL = $BaseUrl.Trim().TrimEnd("/")
      OPENAI_BASE_URL = ""
      AI_LLM_API_KEY = $ApiKey.Trim()
      OPENAI_API_KEY = ""
      OPENAI_MODEL = $ModelRoutes["AI_MODEL_GPT"]
      GPT_FALLBACK_MODELS = $ModelRoutes["AI_MODEL_GPT"]
      GEMINI_FALLBACK_MODELS = $ModelRoutes["AI_MODEL_GEMINI"]
    }
    foreach ($Key in $ModelRoutes.Keys) {
      $EnvUpdates[$Key] = $ModelRoutes[$Key]
    }
    Set-EnvValues $EnvPath $EnvUpdates
    Write-Note "Configured real model mode in .env"
  } elseif ($Mode -eq "mock") {
    Set-EnvValues $EnvPath @{
      AI_SPEECH_PROVIDER = "mock"
      AI_ACTION_PROVIDER = "mock"
      AI_DECISION_PROVIDER = ""
      AI_LLM_PROVIDER = "mock"
      AI_PROVIDER = ""
      AI_SPEECH_STRICTNESS = "guided"
    }
    Write-Note "Configured local mock mode in .env"
  } else {
    Write-Note "Kept current .env without changes"
  }

  Write-Step "Installing dependencies"
  if ($SkipInstall) {
    Write-Note "Skipped npm install"
  } else {
    Invoke-Npm @("install")
  }

  Write-Step "Preparing local database"
  Invoke-Npm @("run", "prisma:generate")
  Invoke-Npm @("run", "db:push")

  $SelectedPort = Find-AvailablePort $Port
  $Url = "http://localhost:$SelectedPort$InitialPath"
  Write-Step "Starting app"
  Write-Note "Opening $Url when the server is ready"
  Write-Note "Keep this window open while playing. Press Ctrl+C here to stop the app."
  Start-BrowserWhenReady $Url
  Invoke-Npm @("run", "dev", "--", "--port", "$SelectedPort")
} catch {
  Write-Host ""
  Write-Host "Setup failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ""
  Write-Host "Press Enter to close this window."
  [void] (Read-Host)
  exit 1
}
