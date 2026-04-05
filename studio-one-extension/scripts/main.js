/* Fornix MCP Bridge — Studio One 7 Extension (Stage 2 IO Probe)
 *
 * Purpose: map the full Host.IO.File API surface.
 * Stage 1 confirmed: Host.IO.File exists, has exists/remove/rename/path/toString.
 * Stage 2 answers: can we READ and WRITE files?
 *
 * Format: IComponent / FrameworkService (createInstance → initialize).
 * Runs inside Studio One's scripting engine — NOT Node.js.
 */

include_file("resource://{main}/sdk/cclapp.js");

var PROBE_VERSION = 10;

function log(msg) {
  Host.Console.writeLine("[FornixMCPBridge] " + msg);
}

// ─── Safe property enumerator ──────────────────────────────────────────────

function probeObject(obj, label, maxDepth) {
  if (typeof maxDepth === "undefined") maxDepth = 1;
  if (!obj || maxDepth < 0) return;

  var keys = [];
  try {
    for (var k in obj) {
      keys.push(k);
    }
  } catch (e) {
    log(label + " — cannot enumerate: " + e);
    return;
  }

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    try {
      var val = obj[key];
      var t = typeof val;
      if (t === "function") {
        log("  " + label + "." + key + " = function");
      } else if (t === "object" && val !== null) {
        log("  " + label + "." + key + " = object");
        if (maxDepth > 0) {
          probeObject(val, label + "." + key, maxDepth - 1);
        }
      } else {
        log("  " + label + "." + key + " = " + t + " = " + String(val));
      }
    } catch (e2) {
      log("  " + label + "." + key + " — access error: " + e2);
    }
  }

  if (keys.length === 0) {
    log("  " + label + " — no enumerable keys (try Object methods below)");
  }
}

// ─── Host.IO probe ────────────────────────────────────────────────────────

function probeHostIO() {
  log("--- Host.IO probe ---");

  if (typeof Host === "undefined" || !Host) {
    log("Host is undefined");
    return;
  }

  if (typeof Host.IO === "undefined") {
    log("Host.IO is undefined");
    return;
  }

  log("Host.IO = " + typeof Host.IO);
  probeObject(Host.IO, "Host.IO", 0);
}

// ─── Host.IO.File probe ──────────────────────────────────────────────────

function probeIOFile() {
  log("--- Host.IO.File probe ---");

  if (typeof Host === "undefined" || !Host || !Host.IO) {
    log("Host.IO unavailable — skipping");
    return;
  }

  // Test constructor with a known path
  var testPath = "C:/Users/Public/fornix-io-probe-test.txt";
  var f;
  try {
    f = new Host.IO.File(testPath);
    log("Host.IO.File(path) = " + typeof f + " " + f);
  } catch (e) {
    log("Host.IO.File constructor failed: " + e);
    return;
  }

  // Enumerate all properties/methods
  probeObject(f, "f", 1);

  // Test specific methods
  log("--- IO.File method tests ---");

  // exists
  try {
    var exists = f.exists();
    log("f.exists() = " + exists);
  } catch (e) {
    log("f.exists() error: " + e);
  }

  // toString
  try {
    log("f.toString() = " + f.toString());
  } catch (e) {
    log("f.toString() error: " + e);
  }

  // path
  try {
    log("f.path = " + typeof f.path);
    if (f.path) {
      log("f.path.toString() = " + f.path.toString());
      probeObject(f.path, "f.path", 0);
    }
  } catch (e) {
    log("f.path error: " + e);
  }

  // Test read-related methods
  log("--- IO.File READ probes ---");
  var readMethods = [
    "read", "readAll", "readLine", "readLines",
    "getText", "getContent", "getContents",
    "text", "content", "contents", "data",
    "open", "openRead", "openText",
    "createReader", "getReader",
    "inputStream", "getInputStream"
  ];

  for (var i = 0; i < readMethods.length; i++) {
    try {
      var method = readMethods[i];
      var val = f[method];
      if (typeof val !== "undefined") {
        log("f." + method + " = " + typeof val);
        if (typeof val === "function") {
          log("  EXISTS — trying f." + method + "()...");
          try {
            var result = val.call(f);
            log("  f." + method + "() returned: " + typeof result + " = " + String(result).substring(0, 200));
          } catch (callErr) {
            log("  f." + method + "() error: " + callErr);
          }
        }
      }
    } catch (e) {
      log("f." + readMethods[i] + " access error: " + e);
    }
  }

  // Test write-related methods
  log("--- IO.File WRITE probes ---");
  var writeMethods = [
    "write", "writeAll", "writeLine",
    "setText", "setContent", "setContents",
    "save", "saveAs",
    "openWrite", "openText",
    "createWriter", "getWriter",
    "outputStream", "getOutputStream",
    "create", "append"
  ];

  for (var j = 0; j < writeMethods.length; j++) {
    try {
      var wmethod = writeMethods[j];
      var wval = f[wmethod];
      if (typeof wval !== "undefined") {
        log("f." + wmethod + " = " + typeof wval);
      }
    } catch (e) {
      log("f." + writeMethods[j] + " access error: " + e);
    }
  }
}

// ─── Host.IO.TextFile / BinaryFile / Stream probes ───────────────────────

function probeIOStreams() {
  log("--- Host.IO stream classes probe ---");

  if (typeof Host === "undefined" || !Host || !Host.IO) return;

  var classes = [
    "TextFile", "BinaryFile", "DataStream", "TextStream",
    "InputStream", "OutputStream", "FileStream",
    "Reader", "Writer", "BufferedReader", "BufferedWriter",
    "StreamReader", "StreamWriter"
  ];

  for (var i = 0; i < classes.length; i++) {
    try {
      var cls = Host.IO[classes[i]];
      if (typeof cls !== "undefined") {
        log("Host.IO." + classes[i] + " = " + typeof cls);
        if (typeof cls === "function") {
          log("  Found constructor — trying new Host.IO." + classes[i] + "()...");
          try {
            var inst = new cls("C:/Users/Public/fornix-stream-test.txt");
            log("  Instance created: " + typeof inst);
            probeObject(inst, "  Host.IO." + classes[i], 0);
          } catch (e2) {
            log("  Constructor error: " + e2);
          }
        }
      }
    } catch (e) {
      log("Host.IO." + classes[i] + " error: " + e);
    }
  }
}

// ─── Host.Url probe ──────────────────────────────────────────────────────

function probeHostUrl() {
  log("--- Host.Url probe ---");

  if (typeof Host === "undefined" || !Host) return;
  if (typeof Host.Url === "undefined") {
    log("Host.Url undefined");
    return;
  }

  try {
    var u = new Host.Url("C:/Users/Public/test.json");
    log("Host.Url = " + typeof u + " " + u);
    probeObject(u, "url", 0);
  } catch (e) {
    log("Host.Url error: " + e);
  }
}

// ─── Write test: try every known method ──────────────────────────────────

function probeWriteAttempt() {
  log("--- WRITE ATTEMPT ---");

  if (typeof Host === "undefined" || !Host || !Host.IO) return;

  var testPath = "C:/Users/Public/fornix-write-test.txt";
  var testContent = "Fornix IO probe write test " + new Date().getTime();

  // Method 1: IO.File constructor + write
  try {
    var f = new Host.IO.File(testPath);
    if (typeof f.write === "function") {
      f.write(testContent);
      log("WRITE SUCCESS via f.write()");
      // Verify by checking exists
      var f2 = new Host.IO.File(testPath);
      log("After write, f2.exists() = " + f2.exists());
      return;
    }
  } catch (e) {
    log("f.write() failed: " + e);
  }

  // Method 2: TextFile
  try {
    if (Host.IO.TextFile) {
      var tf = new Host.IO.TextFile(testPath);
      if (typeof tf.open === "function") {
        tf.open("write");
        tf.write(testContent);
        tf.close();
        log("WRITE SUCCESS via TextFile");
        return;
      }
    }
  } catch (e) {
    log("TextFile write failed: " + e);
  }

  // Method 3: openForWriting pattern
  try {
    var f3 = new Host.IO.File(testPath);
    if (typeof f3.open === "function") {
      var stream = f3.open("w");
      if (stream && typeof stream.write === "function") {
        stream.write(testContent);
        stream.close();
        log("WRITE SUCCESS via f.open('w')");
        return;
      }
    }
  } catch (e) {
    log("f.open('w') write failed: " + e);
  }

  log("All write methods exhausted — write NOT possible with current API surface");
}

// ─── Read test: if a file exists, try to read it ─────────────────────────

function probeReadAttempt() {
  log("--- READ ATTEMPT ---");

  if (typeof Host === "undefined" || !Host || !Host.IO) return;

  // Try to read the metainfo.xml that we know exists in the extension dir
  var paths = [
    "C:/Users/Public/fornix-write-test.txt",
    "C:/Users/Public/desktop.ini"
  ];

  for (var p = 0; p < paths.length; p++) {
    var testPath = paths[p];
    try {
      var f = new Host.IO.File(testPath);
      if (!f.exists()) {
        log("Read test file not found: " + testPath);
        continue;
      }

      log("Read test file exists: " + testPath);

      // Try read methods
      if (typeof f.read === "function") {
        try {
          var result = f.read();
          log("READ SUCCESS via f.read(): " + typeof result + " = " + String(result).substring(0, 200));
          return;
        } catch (e) {
          log("f.read() error: " + e);
        }
      }

      if (typeof f.readAll === "function") {
        try {
          var result2 = f.readAll();
          log("READ SUCCESS via f.readAll(): " + String(result2).substring(0, 200));
          return;
        } catch (e) {
          log("f.readAll() error: " + e);
        }
      }

      if (typeof f.getText === "function") {
        try {
          var result3 = f.getText();
          log("READ SUCCESS via f.getText(): " + String(result3).substring(0, 200));
          return;
        } catch (e) {
          log("f.getText() error: " + e);
        }
      }

      if (typeof f.open === "function") {
        try {
          var stream = f.open("r");
          if (stream && typeof stream.read === "function") {
            var data = stream.read();
            stream.close();
            log("READ SUCCESS via f.open('r').read(): " + String(data).substring(0, 200));
            return;
          }
        } catch (e) {
          log("f.open('r') error: " + e);
        }
      }

      // Try property access
      if (typeof f.text !== "undefined") {
        log("f.text = " + typeof f.text + " = " + String(f.text).substring(0, 200));
      }
      if (typeof f.content !== "undefined") {
        log("f.content = " + typeof f.content + " = " + String(f.content).substring(0, 200));
      }

    } catch (e) {
      log("Read attempt error for " + testPath + ": " + e);
    }
  }

  log("All read methods exhausted — read NOT possible with current API surface");
}

// ─── IComponent service ──────────────────────────────────────────────────

function FornixMCPBridgeService() {
  this.interfaces = [Host.Interfaces.IComponent];

  this.initialize = function() {
    log("initialize (v" + PROBE_VERSION + ")");

    try { probeHostIO(); } catch (e) { log("probeHostIO error: " + e); }
    try { probeIOFile(); } catch (e) { log("probeIOFile error: " + e); }
    try { probeIOStreams(); } catch (e) { log("probeIOStreams error: " + e); }
    try { probeHostUrl(); } catch (e) { log("probeHostUrl error: " + e); }
    try { probeWriteAttempt(); } catch (e) { log("probeWriteAttempt error: " + e); }
    try { probeReadAttempt(); } catch (e) { log("probeReadAttempt error: " + e); }

    log("=== Stage 2 IO probe complete ===");
    return Host.Results.kResultOk;
  };

  this.terminate = function() {
    log("terminate");
    return Host.Results.kResultOk;
  };
}

// ─── Class factory entry point ───────────────────────────────────────────

function createInstance(args) {
  __init(args);
  log("createInstance (v" + PROBE_VERSION + ")");
  return new FornixMCPBridgeService;
}
