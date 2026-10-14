# Registers the bridge to start when you log in to Windows (run once in PowerShell).
$dir = $PSScriptRoot
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c cd /d `"$dir`" && npm start >> bridge.log 2>&1"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "CampusDailyWhatsAppBridge" -Action $action -Trigger $trigger -Description "Campus Daily WhatsApp bridge" -Force
Write-Host "Done. The bridge will start at your next login. Logs: $dir\bridge.log"
