# Speaks SSML lines with a Windows (OneCore) voice through WinRT and writes one WAV per line.
# Called by voiceover.js: powershell -NoProfile -NonInteractive -File tts.ps1 -Jobs jobs.json -Voice "Microsoft Julie"
# jobs.json = [ { "ssml": "<speak ...>", "out": "C:\\...\\line-01.wav" }, ... ]
param(
  [Parameter(Mandatory = $true)][string]$Jobs,
  [string]$Voice = 'Microsoft Julie'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $null = $task.Wait(-1)
  $task.Result
}

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $Voice } | Select-Object -First 1
if (-not $v) {
  $names = ([Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object { $_.DisplayName }) -join ', '
  throw "Voice not found: $Voice (installed: $names)"
}
$synth.Voice = $v

foreach ($job in (Get-Content -Raw -Encoding UTF8 $Jobs | ConvertFrom-Json)) {
  $stream = Await ($synth.SynthesizeSsmlToStreamAsync($job.ssml)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
  $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
  $n = Await ($reader.LoadAsync([uint32]$stream.Size)) ([uint32])
  $bytes = New-Object byte[] $n
  $reader.ReadBytes($bytes)
  [IO.File]::WriteAllBytes($job.out, $bytes)
  $reader.Dispose()
  $stream.Dispose()
  Write-Output $job.out
}
