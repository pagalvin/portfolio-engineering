cd "c:\src\portfolio-engineering\portfolio-engineering"

$process = Start-Process -FilePath "node" -ArgumentList @("--test", "--experimental-strip-types", "apps\frontend\src\sessionState.test.ts") -NoNewWindow -RedirectStandardOutput stdout.txt -RedirectStandardError stderr.txt -PassThru

$process.WaitForExit()
$exitCode = $process.ExitCode

Write-Host "=== EXIT CODE ===" 
Write-Host $exitCode
Write-Host ""
Write-Host "=== STDOUT OUTPUT ===" 
Get-Content stdout.txt
Write-Host ""
Write-Host "=== STDERR OUTPUT ===" 
Get-Content stderr.txt
