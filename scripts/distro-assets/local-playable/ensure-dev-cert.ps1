param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [string]$HttpsHost
)

$resolvedHost = $null
if ($HttpsHost -and $HttpsHost.Trim().Length -gt 0) {
  $resolvedHost = $HttpsHost.Trim()
} else {
  try {
    $resolvedHost = Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object { $_.IPAddress -notlike '127.*' -and -not $_.SkipAsSource } |
      Select-Object -First 1 -ExpandProperty IPAddress
  } catch {
    $resolvedHost = $null
  }
}

if (-not $resolvedHost) {
  throw 'Unable to resolve LAN host for HTTPS certificate. Set LIGHT80_HTTPS_HOST before start-local.cmd.'
}

$sanEntries = @('DNS=localhost', 'IPAddress=127.0.0.1', "DNS=$env:COMPUTERNAME")
if ($resolvedHost -match '^\d+\.\d+\.\d+\.\d+$') {
  $sanEntries += "IPAddress=$resolvedHost"
} else {
  $sanEntries += "DNS=$resolvedHost"
}

$cert = New-SelfSignedCertificate `
  -Type Custom `
  -Subject 'CN=Light80 Local Phone Link' `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -NotAfter (Get-Date).AddYears(5) `
  -TextExtension @(
    '2.5.29.37={text}1.3.6.1.5.5.7.3.1',
    ('2.5.29.17={text}' + ($sanEntries -join '&'))
  )

$passwordSecure = ConvertTo-SecureString -String $Password -Force -AsPlainText
$outputDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Export-PfxCertificate `
  -Cert $cert `
  -FilePath $OutputPath `
  -Password $passwordSecure `
  -ChainOption EndEntityCertOnly | Out-Null

Write-Output $resolvedHost
