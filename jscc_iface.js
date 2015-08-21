// Utilities
if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function(str) {
    return this.slice(0, str.length) == str;
  };
}

function escapeRegExp(string) {
      return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

if (typeof String.prototype.replaceAll != 'function') {
  String.prototype.replaceAll = function(str, replacement) {
    if (str instanceof RegExp) {
      if (!str.global)
        str = new RegExp(str.toString, 'g')
      return this.replace(str, replacement)
    } else {
      regexp = new RegExp(escapeRegExp(str), 'g');
      return this.replace(regexp, replacement);
    }
  }
}

function download(filename, text) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);

    if (document.createEvent) {
        var event = document.createEvent('MouseEvents');
        event.initEvent('click', true, true);
        pom.dispatchEvent(event);
    }
    else {
        pom.click();
    }
}


var runbuttonElement = document.getElementById("runbutton");
var jsccElement = document.getElementById("jscc");
var jsccWorker = new Worker("jscc_worker.js")
var jsccDeferredCommands = [];
var jsccExecutedCommands = [];

function enterButtonrunner(e) {
  event = e || window.event;
  if (event.keyCode == 13) {
    buttonrunner();
  }
}

function jsccAddInputField() {
  var input = document.createElement("input");
  input.type = "text";
  input.id = "current_input";
  jsccElement.appendChild(input);
  jsccElement.appendChild(runbuttonElement);
  input.onkeydown = enterButtonrunner;
  input.focus();
}

function saveSvg(visualization) {
  var savableSvgNode = visualization.getElementsByTagName('svg')[0];

  function responseReady() {
    var savableSvg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="c3">'
    savableSvg += '<style type="text/css"> <![CDATA['
    savableSvg += xmlhttp.responseText;
    savableSvg += ']]></style>';
    savableSvg += savableSvgNode.innerHTML;
    savableSvg += '</svg>';

    savableSvg = savableSvg.replaceAll(location.href, '#');

//string = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(savableSvg);
    download('jscc.svg', savableSvg);
  }

  // Get styles
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open('GET', 'c3.css', true);
  xmlhttp.addEventListener('load', responseReady)
  xmlhttp.send();
}

jsccWorker.onmessage = function(msg) {
  var output = document.createElement("div");
  if (typeof msg.data !== "string") {
    throw new Error("main page: strange message received");
  }

  jsccElement.appendChild(output);
  if (msg.data.startsWith("!latex! ")) {
    output.innerHTML = "\\(" + msg.data.replace(/!latex! /,"") + "\\)";
    MathJax.Hub.Queue(["Typeset", MathJax.Hub, output]);
  } else if (msg.data.startsWith("!error! ")) {
    output.innerHTML = msg.data.replace(/!error! /,"");
    output.style.color = "red";
  } else if (msg.data.startsWith("!isl! ")) {
    output.innerHTML = msg.data.replace(/!isl! /,"");
    output.style.fontFamily = "monospace";
  } else if (msg.data.startsWith("!plot2! ")) {
    var rawdata = JSON.parse(msg.data.replace(/!plot2! /,""));
    var wrapper = document.createElement('div')
    var visualization = document.createElement("div");
    visualization.class = 'c3';
    output.appendChild(visualization);
    var cols = [ ["i"], ["j"] ];
    for (var i = 0; i < rawdata.length; i++) {
      cols[0].push(rawdata[i][0]);
      cols[1].push(rawdata[i][1]);
    }
    var chart = c3.generate({
      bindto: visualization,
      data: {
        xs: {j: "i"},
        columns: cols,
        type: 'scatter'
      }
    });

    // Save button
    var saveLink = document.createElement('a');
    saveLink.innerHTML = 'Save SVG';
    saveLink.setAttribute('href', '#');
    saveLink.onclick = function() { saveSvg(visualization); };
    output.appendChild(saveLink);


  } else if (msg.data.startsWith("!code! ")) {
    var code = msg.data.replace(/!code! /,"");
    preElement = document.createElement('pre');
    preElement.setAttribute("class", "hljs");
    output.appendChild(preElement);
    codeElement = document.createElement('code');
    preElement.appendChild(codeElement);
    codeElement.innerHTML = code;
    codeElement.setAttribute("class", "hljs cpp");
    hljs.configure({
      languages: ['cpp']
    });
    hljs.highlightBlock(codeElement);
  } else {
    throw new Error('main page: message does not contain type tag');
  }
  jsccAddInputField();
  jsccProcessDeferred();
}

function jsccProcessDeferred() {
  if (jsccDeferredCommands.length != 0) {
    command = jsccDeferredCommands.splice(0,1);
    document.getElementById("current_input").value = command[0] + ";"
    jsccPostOrComment(command[0]);
  }
}

function jsccPostOrComment(command) {
  var commentPrefix = command.match(/^\s*#/);
  if (commentPrefix != null) {
    jsccExecutedCommands.push(command);
    var commentElement = document.createElement('p');
    commentElement.setAttribute('class', 'jscccomment');
    command = command.substr(commentPrefix.length, command.length - commentPrefix.length);
    command = escapeHtml(command);
    commentElement.innerHTML = command;
    jsccRemoveInputField();
    jsccElement.appendChild(commentElement);
    jsccAddInputField();
    jsccProcessDeferred();
  } else {
    jsccExecutedCommands.push(command + ';');
    jsccReadonlyInputField();
    jsccWorker.postMessage(command + ';');
  }
}

function jsccParseCommands(string) {
  // Splitting commands by ';'.  Not very robust,
  // but seems to work with current iscc syntax.
  var commands = string.split(';');
  var posted = false;
  for (var i = 0; i < commands.length; i++) {
    if (commands[i].match(/^[;\s]*$/) == null) {
      if (!posted) {
        jsccPostOrComment(commands[i]);
        posted = true;
      } else {
        jsccDeferredCommands.push(commands[i]);
      }
    }
  }
}

function jsccParseString(string, element) {
  jsccElement = element;
  runbuttonElement = document.createElement('button');
  runbuttonElement.type='button';
  runbuttonElement.innerHTML='Run';
  var lines = string.split('\n');
  for (var i = 0; i < lines.length; i++) {
    // Detach inline comments.
    var inlineCommentStart = lines[i].indexOf('#');
    if (inlineCommentStart == -1) {
      var commandPart = lines[i];
      var commentPart = null;
    } else {
      var commandPart = lines[i].substr(0, inlineCommentStart);
      var commentPart = lines[i].substr(inlineCommentStart, lines[i].length - inlineCommentStart);
    }

    // Remove empty commands
    var commands = commandPart.split(';');
    for (var j = 0; j < commands.length; j++) {
      if (commands[j].match(/^[;\s]*$/) != null) {
        commands.splice(j, 1);
        j--;
      }
    }
    if (commands.length == 0) {
      if (commentPart != null) {
        jsccDeferredCommands.push(commentPart);
      }
      continue;
    }
    // Add all commands but the last
    for (var j = 0; j < commands.length - 1; j++) {
      jsccDeferredCommands.push(commands[j]);
    }
    // If last command has colon, add it, otherwise prepend it to the next line
    var lastCommand = commands[commands.length - 1];
    if (commandPart.match(/;\s*$/) != null) {
      jsccDeferredCommands.push(lastCommand);
      if (commentPart != null) {
        jsccDeferredCommands.push(commentPart);
      }
    } else {
      if (commentPart != null) {
        jsccDeferredCommands.push(commentPart);
      }
      if (i != lines.length - 1) {
        lines[i + 1] = lastCommand + lines[i + 1];
      } else {
        jsccDeferredCommands.push("$$$ file corrupted $$$"); // WTF method to generate error
      }
    }
  }
  jsccAddInputField();
  jsccProcessDeferred();
}

var textarea = document.createElement('textarea');
function escapeHtml(string) {
  // Textarea will escape html special caracters when added.
  textarea.innerHTML = string;
  return textarea.innerHTML;
}

function jsccReadonlyInputField() {
  var inputElement = document.getElementById("current_input");
  inputElement.readOnly = true;
  inputElement.removeAttribute("id");
  inputElement.onkeydown = undefined;
  jsccElement.removeChild(runbuttonElement);
}

function jsccRemoveInputField() {
  var inputElement = document.getElementById("current_input");
  if (!inputElement)
    return;
  jsccElement.removeChild(inputElement);
  jsccElement.removeChild(runbuttonElement);
}

function jsccGenerateIscc() {
  return jsccExecutedCommands.join('\n');
}

function buttonrunner() {
  var commands = document.getElementById("current_input").value;
  jsccParseCommands(commands);
}
