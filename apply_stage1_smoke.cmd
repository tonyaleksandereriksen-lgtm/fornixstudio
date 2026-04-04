@echo off
setlocal

set "TARGET=studio-one-extension\main.js"
set "BACKUP=studio-one-extension\main.js.stage1-backup"

if not exist "studio-one-extension" (
  echo [ERROR] studio-one-extension folder not found.
  exit /b 1
)

if exist "%TARGET%" (
  copy /Y "%TARGET%" "%BACKUP%" >nul
  echo [OK] Backup created: %BACKUP%
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$content = @'
/* Fornix Studio MCP - Stage 1 smoke test
 *
 * Purpose:
 * - prove whether Studio One loads and executes this script at all
 * - attempt a very small startup/shutdown marker write
 *
 * Intentionally excluded:
 * - websocket server
 * - bridge logic
 * - command routing
 * - modern JavaScript syntax
 */

var FORNIX_ROOT_DIR = ""Documents/FornixMCP"";
var FORNIX_LOG_DIR = ""Documents/FornixMCP/logs"";

function pad2(value) {
  if (value < 10) {
    return ""0"" + String(value);
  }
  return String(value);
}

function makeTimestamp() {
  var now = new Date();
  return String(now.getFullYear()) +
    pad2(now.getMonth() + 1) +
    pad2(now.getDate()) +
    ""-"" +
    pad2(now.getHours()) +
    pad2(now.getMinutes()) +
    pad2(now.getSeconds());
}

function makeMarkerPath(prefix) {
  return FORNIX_LOG_DIR + ""/"" + prefix + ""-"" + makeTimestamp() + "".json"";
}

function escapeJsonString(value) {
  var text;

  if (value === null || value === undefined) {
    return """";
  }

  text = String(value);
  text = text.replace(/\\/g, ""\\\\"");
  text = text.replace(/""/g, '\\""');
  text = text.replace(/\r/g, ""\\r"");
  text = text.replace(/\n/g, ""\\n"");
  return text;
}

function toJsonString(data) {
  if (typeof JSON !== ""undefined"" && JSON && typeof JSON.stringify === ""function"") {
    try {
      return JSON.stringify(data, null, 2);
    } catch (error) {
    }
  }

  return ""{\n"" +
    '  ""phase"": ""' + escapeJsonString(data.phase) + '"",\n' +
    '  ""timestamp"": ""' + escapeJsonString(data.timestamp) + '"",\n' +
    '  ""path"": ""' + escapeJsonString(data.path) + '"",\n' +
    '  ""rootDirCreated"": ""' + escapeJsonString(data.rootDirCreated) + '"",\n' +
    '  ""logsDirCreated"": ""' + escapeJsonString(data.logsDirCreated) + '"",\n' +
    '  ""writeSucceeded"": ""' + escapeJsonString(data.writeSucceeded) + '"",\n' +
    '  ""note"": ""' + escapeJsonString(data.note) + '""\n' +
    ""}\n"";
}

function stringifyError(error) {
  if (!error) {
    return ""unknown error"";
  }

  if (error.message) {
    return String(error.message);
  }

  return String(error);
}

function logLine(message) {
  var text = ""[FornixMCPBridge] "" + String(message);

  try {
    if (typeof Host !== ""undefined"" && Host && Host.Console && typeof Host.Console.writeLine === ""function"") {
      Host.Console.writeLine(text);
      return;
    }
  } catch (error) {
  }

  try {
    if (typeof console !== ""undefined"" && console && typeof console.log === ""function"") {
      console.log(text);
      return;
    }
  } catch (error2) {
  }
}

function getFileSystem() {
  try {
    if (typeof Host !== ""undefined"" && Host && Host.FileSystem) {
      return Host.FileSystem;
    }
  } catch (error) {
  }

  return null;
}

function tryCreateDirectory(path) {
  var fileSystem = getFileSystem();

  if (!fileSystem) {
    return false;
  }

  try {
    if (typeof fileSystem.createDirectory === ""function"") {
      fileSystem.createDirectory(path);
      return true;
    }
  } catch (error1) {
  }

  try {
    if (typeof fileSystem.makeDirectory === ""function"") {
      fileSystem.makeDirectory(path);
      return true;
    }
  } catch (error2) {
  }

  try {
    if (typeof fileSystem.ensureDirectory === ""function"") {
      fileSystem.ensureDirectory(path);
      return true;
    }
  } catch (error3) {
  }

  return false;
}

function tryWriteFile(path, text) {
  var fileSystem = getFileSystem();

  if (!fileSystem) {
    return false;
  }

  try {
    if (typeof fileSystem.writeFile === ""function"") {
      fileSystem.writeFile(path, text);
      return true;
    }
  } catch (error1) {
  }

  try {
    if (typeof fileSystem.writeTextFile === ""function"") {
      fileSystem.writeTextFile(path, text);
      return true;
    }
  } catch (error2) {
  }

  try {
    if (typeof fileSystem.saveTextFile === ""function"") {
      fileSystem.saveTextFile(path, text);
      return true;
    }
  } catch (error3) {
  }

  return false;
}

function attemptMarkerWrite(prefix, note) {
  var markerPath = makeMarkerPath(prefix);
  var rootDirCreated = false;
  var logsDirCreated = false;
  var writeSucceeded = false;
  var payload;
  var payloadText;

  try {
    rootDirCreated = tryCreateDirectory(FORNIX_ROOT_DIR);
  } catch (error1) {
    logLine(""root dir create failed: "" + stringifyError(error1));
  }

  try {
    logsDirCreated = tryCreateDirectory(FORNIX_LOG_DIR);
  } catch (error2) {
    logLine(""logs dir create failed: "" + stringifyError(error2));
  }

  payload = {
    phase: prefix,
    timestamp: makeTimestamp(),
    path: markerPath,
    rootDirCreated: rootDirCreated,
    logsDirCreated: logsDirCreated,
    writeSucceeded: false,
    note: note || """"
  };

  payloadText = toJsonString(payload);

  try {
    writeSucceeded = tryWriteFile(markerPath, payloadText);
  } catch (error3) {
    logLine(""marker write threw: "" + stringifyError(error3));
    writeSucceeded = false;
  }

  logLine(
    ""marker "" + prefix +
    "" writeSucceeded="" + String(writeSucceeded) +
    "" path="" + markerPath +
    "" rootDirCreated="" + String(rootDirCreated) +
    "" logsDirCreated="" + String(logsDirCreated)
  );

  return writeSucceeded;
}

function activate() {
  logLine(""activate begin"");

  try {
    attemptMarkerWrite(""startup"", ""stage1-smoke"");
  } catch (error) {
    logLine(""activate failed: "" + stringifyError(error));
  }

  logLine(""activate end"");
}

function deactivate() {
  logLine(""deactivate begin"");

  try {
    attemptMarkerWrite(""shutdown"", ""stage1-smoke"");
  } catch (error) {
    logLine(""deactivate failed: "" + stringifyError(error));
  }

  logLine(""deactivate end"");
}

try {
  if (typeof exports !== ""undefined"") {
    exports.activate = activate;
    exports.deactivate = deactivate;
  }
} catch (error) {
}
'@; [System.IO.File]::WriteAllText((Join-Path (Get-Location) 'studio-one-extension\main.js'), $content, (New-Object System.Text.UTF8Encoding($false)))"

if errorlevel 1 (
  echo [ERROR] Failed to write %TARGET%
  exit /b 1
)

echo [OK] Wrote %TARGET%
echo [INFO] manifest unchanged
endlocal