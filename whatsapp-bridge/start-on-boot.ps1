# Starts the bridge whenever you log in to Windows. Run once in PowerShell:
#   powershell -ExecutionPolicy Bypass -File start-on-boot.ps1
$dir = $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c cd /d `"$dir`" && node bridge.mjs >> bridge.log 2>&1" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "CampusDailyWhatsAppBridge" -Action $action -Trigger $trigger -Settings $settings -Description "Campus Daily WhatsApp bridge (read-only)" -Force | Out-Null
Write-Host "Done. The bridge starts at every login. Log: $dir\bridge.log"
