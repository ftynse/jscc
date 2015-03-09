var moduleErrorText = "";
Module = {
  printErr: function(text) {
    moduleErrorText += text;
  }
};

importScripts('jscc.js')

var ctx = Module.ccall('jscc_context_alloc', 'number', [], []);
var jscc_process = Module.cwrap('jscc_process_command', 'string', ['number', 'string']);

onmessage = function(msg) {
  if (typeof msg.data !== "string") {
    throw new Error("jscc_worker: strange message received");
  }
  var result = jscc_process(ctx, msg.data);
  if (moduleErrorText !== "") {
    postMessage("!error! " + moduleErrorText);
    moduleErrorText = "";
  } else {
    postMessage(result);
  }
}
