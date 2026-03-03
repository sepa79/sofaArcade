param(
  [string]$WslDistro,
  [string]$ListenAddress = '0.0.0.0',
  [int[]]$Ports = @(5174, 8787)
)

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  throw 'Run this script in PowerShell as Administrator.'
}

if ($Ports.Count -eq 0) {
  throw 'Ports list cannot be empty.'
}

if ([string]::IsNullOrWhiteSpace($WslDistro)) {
  $wslIp = (wsl.exe -e sh -lc "hostname -I | awk '{print \$1}'").Trim()
} else {
  $wslIp = (wsl.exe -d $WslDistro -e sh -lc "hostname -I | awk '{print \$1}'").Trim()
}

if ([string]::IsNullOrWhiteSpace($wslIp)) {
  throw 'Could not resolve WSL IP.'
}

Write-Host "Resolved WSL IP: $wslIp"

foreach ($port in $Ports) {
  if ($port -le 0 -or $port -gt 65535) {
    throw "Invalid port: $port"
  }

  & netsh interface portproxy delete v4tov4 listenaddress=$ListenAddress listenport=$port | Out-Null
  & netsh interface portproxy add v4tov4 listenaddress=$ListenAddress listenport=$port connectaddress=$wslIp connectport=$port | Out-Null

  $ruleName = "Light80 WSL Port $port"
  $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if ($null -eq $existingRule) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port | Out-Null
  }

  Write-Host "Forwarded TCP $ListenAddress:$port -> $wslIp:$port"
}

Write-Host 'Current portproxy table:'
& netsh interface portproxy show v4tov4
