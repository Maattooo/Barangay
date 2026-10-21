Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
strPath = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath
WshShell.Run Chr(34) & strPath & "\start-server.bat" & Chr(34), 0, False
Set WshShell = Nothing
Set FSO = Nothing
