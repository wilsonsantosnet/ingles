param(
  [string]$ResourceGroup = "",
  [string]$WebAppName = "",

  [string]$SubscriptionId = "",
  [string]$OutputRoot = "data-backup",
  [switch]$SyncToData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-CommandExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName
  )

  $exists = Get-Command $CommandName -ErrorAction SilentlyContinue
  return $null -ne $exists
}

function Get-AzdEnvFilePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
  )

  $azureDir = Join-Path $ProjectRoot ".azure"
  if (-not (Test-Path $azureDir)) {
    return $null
  }

  $envCandidates = Get-ChildItem -Path $azureDir -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName ".env" } |
    Where-Object { Test-Path $_ }

  return $envCandidates | Select-Object -First 1
}

function Get-AzdEnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$EnvFile,

    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  if (-not (Test-Path $EnvFile)) {
    return ""
  }

  $pattern = "^$Name=(.*)$"
  $line = Get-Content -Path $EnvFile | Where-Object { $_ -match $pattern } | Select-Object -First 1
  if (-not $line) {
    return ""
  }

  $raw = $line -replace "^$Name=", ""
  return $raw.Trim().Trim('"')
}

function Invoke-ApiJson {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  return Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 120
}

function Export-DataViaAppApi {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$DestinationDir
  )

  $cleanBase = $BaseUrl.TrimEnd('/')
  $dataRoot = Join-Path $DestinationDir "data"
  $categoriesRoot = Join-Path $dataRoot "categories"

  New-Item -ItemType Directory -Path $categoriesRoot -Force | Out-Null

  $categoriesResp = Invoke-ApiJson -Url "$cleanBase/api/categories"
  $categories = @()

  if ($categoriesResp -and $categoriesResp.categories) {
    $categories = @($categoriesResp.categories)
  }

  $categoriesJsonPath = Join-Path $dataRoot "categories.json"
  @{ categories = $categories } | ConvertTo-Json -Depth 100 | Set-Content -Path $categoriesJsonPath -Encoding UTF8

  foreach ($category in $categories) {
    $categoryId = [string]$category.id
    if ([string]::IsNullOrWhiteSpace($categoryId)) {
      continue
    }

    $categoryDir = Join-Path $categoriesRoot $categoryId
    New-Item -ItemType Directory -Path $categoryDir -Force | Out-Null

    $lessons = @(Invoke-ApiJson -Url "$cleanBase/api/categories/$categoryId/lessons")
    @{ lessons = $lessons } | ConvertTo-Json -Depth 100 | Set-Content -Path (Join-Path $categoryDir "index.json") -Encoding UTF8

    foreach ($lesson in $lessons) {
      $lessonId = [string]$lesson.id
      if ([string]::IsNullOrWhiteSpace($lessonId)) {
        continue
      }

      $lessonJson = Invoke-ApiJson -Url "$cleanBase/api/categories/$categoryId/lessons/$lessonId"
      $lessonPath = Join-Path $categoryDir "$lessonId.json"
      $lessonJson | ConvertTo-Json -Depth 100 | Set-Content -Path $lessonPath -Encoding UTF8
    }

    try {
      $tipsResp = Invoke-ApiJson -Url "$cleanBase/api/categories/$categoryId/tips"
      $tipsObj = if ($tipsResp -and $tipsResp.tips) { $tipsResp.tips } else { @{} }
      $tipsObj | ConvertTo-Json -Depth 100 | Set-Content -Path (Join-Path $categoryDir "tips.json") -Encoding UTF8
    } catch {
      # Algumas categorias podem nao ter tips ou endpoint pode falhar temporariamente.
    }
  }

  return $dataRoot
}

function Get-FtpDirectoryItems {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [Parameter(Mandatory = $true)]
    [System.Net.NetworkCredential]$Credential
  )

  $request = [System.Net.FtpWebRequest]::Create($Uri)
  $request.Method = [System.Net.WebRequestMethods+Ftp]::ListDirectory
  $request.Credentials = $Credential
  $request.EnableSsl = $true
  $request.UseBinary = $true
  $request.KeepAlive = $false

  $response = $request.GetResponse()
  $stream = $response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  $content = $reader.ReadToEnd()
  $reader.Close()
  $response.Close()

  return $content -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
}

function Test-FtpDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [Parameter(Mandatory = $true)]
    [System.Net.NetworkCredential]$Credential
  )

  try {
    $null = Get-FtpDirectoryItems -Uri ($Uri.TrimEnd('/') + '/') -Credential $Credential
    return $true
  } catch {
    return $false
  }
}

function Download-FtpFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [Parameter(Mandatory = $true)]
    [System.Net.NetworkCredential]$Credential,

    [Parameter(Mandatory = $true)]
    [string]$DestinationPath
  )

  $request = [System.Net.FtpWebRequest]::Create($Uri)
  $request.Method = [System.Net.WebRequestMethods+Ftp]::DownloadFile
  $request.Credentials = $Credential
  $request.EnableSsl = $true
  $request.UseBinary = $true
  $request.KeepAlive = $false

  $response = $request.GetResponse()
  $stream = $response.GetResponseStream()

  $destDir = Split-Path -Path $DestinationPath -Parent
  if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  }

  $fileStream = [System.IO.File]::Open($DestinationPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  $stream.CopyTo($fileStream)
  $fileStream.Close()
  $stream.Close()
  $response.Close()
}

function Export-DataViaFtp {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FtpRootUrl,

    [Parameter(Mandatory = $true)]
    [string]$FtpUser,

    [Parameter(Mandatory = $true)]
    [string]$FtpPassword,

    [Parameter(Mandatory = $true)]
    [string]$DestinationDir
  )

  $credential = New-Object System.Net.NetworkCredential($FtpUser, $FtpPassword)
  $ftpDataRoot = ($FtpRootUrl.TrimEnd('/') + '/data')
  $localDataRoot = Join-Path $DestinationDir 'data'
  New-Item -ItemType Directory -Path $localDataRoot -Force | Out-Null

  $stack = New-Object System.Collections.Stack
  $stack.Push(@{ Remote = $ftpDataRoot; Local = $localDataRoot })

  while ($stack.Count -gt 0) {
    $current = $stack.Pop()
    $remote = [string]$current.Remote
    $local = [string]$current.Local

    if (-not (Test-Path $local)) {
      New-Item -ItemType Directory -Path $local -Force | Out-Null
    }

    $items = Get-FtpDirectoryItems -Uri ($remote.TrimEnd('/') + '/') -Credential $credential
    foreach ($name in $items) {
      $escapedName = [Uri]::EscapeDataString($name)
      $remoteChild = ($remote.TrimEnd('/') + '/' + $escapedName)
      $localChild = Join-Path $local $name

      if (Test-FtpDirectory -Uri $remoteChild -Credential $credential) {
        $stack.Push(@{ Remote = $remoteChild; Local = $localChild })
        continue
      }

      if ($name -like '*.json') {
        Download-FtpFile -Uri $remoteChild -Credential $credential -DestinationPath $localChild
      }
    }
  }

  return $localDataRoot
}

function Get-ScmPolicyId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory = $true)]
    [string]$WebAppName
  )

  return "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.Web/sites/$WebAppName/basicPublishingCredentialsPolicies/scm"
}

function Get-ScmBasicAuthAllowed {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PolicyId
  )

  try {
    $value = az resource show --ids $PolicyId --query properties.allow -o tsv
    return [string]$value -eq 'true'
  } catch {
    return $false
  }
}

function Enable-ScmBasicAuth {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PolicyId
  )

  az resource update --ids $PolicyId --set properties.allow=true --output none | Out-Null
}

if (-not (Test-CommandExists -CommandName "az")) {
  throw "Azure CLI (az) nao encontrado. Instale e execute novamente."
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$azdEnvFile = Get-AzdEnvFilePath -ProjectRoot $projectRoot

if ([string]::IsNullOrWhiteSpace($SubscriptionId)) {
  if (-not [string]::IsNullOrWhiteSpace($env:AZURE_SUBSCRIPTION_ID)) {
    $SubscriptionId = $env:AZURE_SUBSCRIPTION_ID
  } elseif ($azdEnvFile) {
    $SubscriptionId = Get-AzdEnvValue -EnvFile $azdEnvFile -Name "AZURE_SUBSCRIPTION_ID"
  }
}

if ([string]::IsNullOrWhiteSpace($WebAppName)) {
  if (-not [string]::IsNullOrWhiteSpace($env:WEBAPP_NAME)) {
    $WebAppName = $env:WEBAPP_NAME
  } elseif ($azdEnvFile) {
    $WebAppName = Get-AzdEnvValue -EnvFile $azdEnvFile -Name "WEBAPP_NAME"
  }
}

if ([string]::IsNullOrWhiteSpace($SubscriptionId) -eq $false) {
  Write-Host "Selecionando subscription: $SubscriptionId"
  az account set --subscription $SubscriptionId | Out-Null
}

if ([string]::IsNullOrWhiteSpace($WebAppName)) {
  throw "Nao foi possivel inferir WebAppName. Informe -WebAppName ou defina WEBAPP_NAME no ambiente/azd .env."
}

if ([string]::IsNullOrWhiteSpace($ResourceGroup)) {
  $ResourceGroup = az webapp list --query "[?name=='$WebAppName'].resourceGroup | [0]" --output tsv
}

if ([string]::IsNullOrWhiteSpace($ResourceGroup)) {
  throw "Nao foi possivel inferir ResourceGroup para o WebApp '$WebAppName'. Informe -ResourceGroup explicitamente."
}

$webAppUri = ""
if (-not [string]::IsNullOrWhiteSpace($env:WEBAPP_URI)) {
  $webAppUri = $env:WEBAPP_URI
} elseif ($azdEnvFile) {
  $webAppUri = Get-AzdEnvValue -EnvFile $azdEnvFile -Name "WEBAPP_URI"
}
if ([string]::IsNullOrWhiteSpace($webAppUri)) {
  $webAppUri = "https://$WebAppName.azurewebsites.net"
}

$timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
$backupRoot = Join-Path $projectRoot $OutputRoot
$backupDir = Join-Path $backupRoot "azure-$timestamp"
$tempDir = Join-Path $backupDir "_tmp"
$zipPath = Join-Path $tempDir "azure-data.zip"
$extractDir = Join-Path $backupDir "extract"

New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
New-Item -ItemType Directory -Path $extractDir -Force | Out-Null

Write-Host "Obtendo perfil de publicacao do App Service..."
$publishingUser = ""
$publishingPassword = ""
$kuduBaseUrl = ""
$profilesJson = az webapp deployment list-publishing-profiles --name $WebAppName --resource-group $ResourceGroup --output json
$profiles = $profilesJson | ConvertFrom-Json

if ($null -eq $profiles -or $profiles.Count -eq 0) {
  throw "Nenhum perfil de publicacao encontrado para o App Service informado."
}

$profile = $profiles | Where-Object { $_.publishMethod -eq "ZipDeploy" } | Select-Object -First 1
if ($null -eq $profile) {
  $profile = $profiles | Where-Object { $_.publishMethod -eq "MSDeploy" } | Select-Object -First 1
}
if ($null -eq $profile) {
  $profile = $profiles | Select-Object -First 1
}

$publishingUser = [string]$profile.userName
$publishingPassword = [string]$profile.userPWD

$publishUrl = [string]$profile.publishUrl
if ($publishUrl -match '^https?://') {
  $kuduBaseUrl = $publishUrl
} else {
  $kuduBaseUrl = "https://$publishUrl"
}

if ([string]::IsNullOrWhiteSpace($publishingUser) -or [string]::IsNullOrWhiteSpace($publishingPassword)) {
  throw "Credenciais de publicacao nao encontradas."
}

if ([string]::IsNullOrWhiteSpace($kuduBaseUrl)) {
  throw "Nao foi possivel determinar a URL base do Kudu (scmUri/publishUrl)."
}

$kuduBaseUrl = $kuduBaseUrl.TrimEnd('/')
$zipUrl = "$kuduBaseUrl/api/zip/site/wwwroot/data/"
$dataFromZip = ""

Write-Host "Baixando snapshot da pasta /home/site/wwwroot/data via Kudu..."
$rawAuth = "{0}:{1}" -f $publishingUser, $publishingPassword
$encodedAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($rawAuth))
$headers = @{ Authorization = "Basic $encodedAuth" }

try {
  Invoke-WebRequest -Uri $zipUrl -Headers $headers -OutFile $zipPath

  Write-Host "Extraindo arquivos para $extractDir"
  Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

  $dataFromZip = Join-Path $extractDir "data"
  if (-not (Test-Path $dataFromZip)) {
    $dataFromZip = $extractDir
  }
} catch {
  Write-Host "Kudu retornou erro de autenticacao/acesso. Verificando policy SCM Basic Auth..."

  $retriedWithScmPolicy = $false
  if (-not [string]::IsNullOrWhiteSpace($SubscriptionId)) {
    $scmPolicyId = Get-ScmPolicyId -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -WebAppName $WebAppName
    $scmAllowed = Get-ScmBasicAuthAllowed -PolicyId $scmPolicyId

    if (-not $scmAllowed) {
      Write-Host "Policy SCM Basic Auth estava desabilitada. Habilitando automaticamente..."
      Enable-ScmBasicAuth -PolicyId $scmPolicyId
      $retriedWithScmPolicy = $true
    }
  }

  if ($retriedWithScmPolicy) {
    try {
      $retryProfilesJson = az webapp deployment list-publishing-profiles --name $WebAppName --resource-group $ResourceGroup --output json
      $retryProfiles = $retryProfilesJson | ConvertFrom-Json
      $retryProfile = $retryProfiles | Where-Object { $_.publishMethod -eq "ZipDeploy" } | Select-Object -First 1
      if ($null -eq $retryProfile) {
        $retryProfile = $retryProfiles | Where-Object { $_.publishMethod -eq "MSDeploy" } | Select-Object -First 1
      }

      if ($retryProfile) {
        $publishingUser = [string]$retryProfile.userName
        $publishingPassword = [string]$retryProfile.userPWD
        $retryPublishUrl = [string]$retryProfile.publishUrl
        if ($retryPublishUrl -match '^https?://') {
          $kuduBaseUrl = $retryPublishUrl
        } else {
          $kuduBaseUrl = "https://$retryPublishUrl"
        }
        $kuduBaseUrl = $kuduBaseUrl.TrimEnd('/')
        $zipUrl = "$kuduBaseUrl/api/zip/site/wwwroot/data/"

        $rawAuth = "{0}:{1}" -f $publishingUser, $publishingPassword
        $encodedAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($rawAuth))
        $headers = @{ Authorization = "Basic $encodedAuth" }
      }

      Write-Host "Repetindo download via Kudu apos habilitar SCM Basic Auth..."
      Invoke-WebRequest -Uri $zipUrl -Headers $headers -OutFile $zipPath
      Write-Host "Extraindo arquivos para $extractDir"
      Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

      $dataFromZip = Join-Path $extractDir "data"
      if (-not (Test-Path $dataFromZip)) {
        $dataFromZip = $extractDir
      }
    } catch {
      Write-Host "Retry via Kudu falhou. Tentando fallback via FTP seguro..."
    }
  } else {
    Write-Host "Tentando fallback via FTP seguro..."
  }

  if (-not $dataFromZip) {
    Write-Host "Executando fallback via FTP seguro..."

    $profilesJson = az webapp deployment list-publishing-profiles --name $WebAppName --resource-group $ResourceGroup --output json
    $profiles = $profilesJson | ConvertFrom-Json
    $ftpProfile = $profiles | Where-Object { $_.publishMethod -eq "FTP" } | Select-Object -First 1

    if ($null -eq $ftpProfile -or [string]::IsNullOrWhiteSpace([string]$ftpProfile.publishUrl)) {
      Write-Host "Perfil FTP nao encontrado. Tentando fallback final pela API publica da aplicacao..."
      Write-Host "Endpoint base usado: $webAppUri"
      $dataFromZip = Export-DataViaAppApi -BaseUrl $webAppUri -DestinationDir $extractDir
    } else {
      $ftpRoot = [string]$ftpProfile.publishUrl
      $ftpUser = [string]$ftpProfile.userName
      $ftpPass = [string]$ftpProfile.userPWD

      if ([string]::IsNullOrWhiteSpace($ftpUser) -or [string]::IsNullOrWhiteSpace($ftpPass)) {
        throw "Perfil FTP encontrado, mas sem credenciais de acesso."
      }

      $dataFromZip = Export-DataViaFtp -FtpRootUrl $ftpRoot -FtpUser $ftpUser -FtpPassword $ftpPass -DestinationDir $extractDir
    }
  }
}

$jsonFiles = Get-ChildItem -Path $dataFromZip -Recurse -File -Filter *.json
$jsonCount = ($jsonFiles | Measure-Object).Count

Write-Host "Total de arquivos .json baixados: $jsonCount"
Write-Host "Backup salvo em: $backupDir"

if ($SyncToData.IsPresent) {
  $localDataPath = Join-Path $projectRoot "data"
  if (-not (Test-Path $localDataPath)) {
    New-Item -ItemType Directory -Path $localDataPath -Force | Out-Null
  }

  Write-Host "Sincronizando conteudo baixado para pasta local data/..."
  Copy-Item -Path (Join-Path $dataFromZip "*") -Destination $localDataPath -Recurse -Force
  Write-Host "Sincronizacao concluida em: $localDataPath"
}

Write-Host "Concluido."
