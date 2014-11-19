App = {
    codeDelim: '\n//!BLOCK\n'
};
App.init = function() {
    // Module entry point
    var self = this;
    this.worker = this.startWorker();
    this.editors = {};
    
    // Events
    window.onbeforeunload = function() {
        return 'Are you sure you want to close this page?';
    };
    
    // For some reason $.get() loads the script and does not trigger success handler..
    var req = new XMLHttpRequest();
    req.onload = function() {
        App.restore(this.responseText);
    };
    req.open('get', 'demo.js', true);
    req.send();
};

App.save = function() {
    var codes = [];
    $('.editor')
        .each(function() {
            var code = this.CodeMirror.getValue();
            if (code) codes.push(code);
        });
    localStorage.codes = codes.join(this.codeDelim);
};

App.restore = function(code) {
    // Restore saved page
    var self = this;
    code = (code != undefined) ? code : localStorage.codes || '';
    var codes = code.split(this.codeDelim);
    if (codes.length) {
        codes.forEach(function(code) {
            self.newEditor(code);
        });
    } else {
        self.newEditor();
    }
};

App.startWorker = function() {
    // Run to initialize worker
    var self = this;
    var worker = new Worker('worker.js');
    worker.onmessage = function(e) {
        console.log('worker sent', e.data);
        var data = e.data;
        var editor = self.editors[data.id];
        if (data.type === 'callback') {
            var func = Function('return ' + data.cb)();
            func.apply(null, data.args);
        } else {
            editor.$output.append('<div>' + data.out + '</div>');
        }
    };
    worker.onerror = function(e) {
        console.log('worker error', e);
    };
    return worker;
};

App.newEditor = function(code) {
    var editor = new Editor(code || '');
    this.editors[editor.id] = editor;
};

App.runWorker = function(id, code, args) {
    // Runs code in worker
    this.worker.postMessage({
        type: 'code',
        id: id,
        code: code,
        args: args
    });
};

App.prettyprint = function(what) {
    if (!what) {
        return what;
    } else if (what.length != undefined) {
        var items = [];
        for (var i=0, item; item=what[i]; i++) {
            items.push(item.toString());
        }
        return '[' + items.join(',') + ']';
    }
    return what.toString();
};



function Editor(code) {
    var self = this;
    self.id = Math.random();
    self.editor = CodeMirror($('.content')[0], {
        value: code || '',
        fixedGutter: false,
        mode: 'javascript',
        indentUnit: 4,
        theme: 'ambiance'
    });
    
    // Manually add editor class
    var wrapper = self.editor.getWrapperElement();
    $(wrapper).addClass('editor');
    
    self.$output = $('<div class="output"></div>')
        .insertAfter(wrapper);
        
    self.editor.setOption('extraKeys', {
        'Shift-Enter': function(cm) {
            // Save all editor code
            App.save();
            // Clear output
            self.$output.empty();
            
            // Run code
            self.run(cm.getValue());
            
            // Focus on next editor
            var nextEditor = self.$output.next('.editor');
            if (nextEditor.length) {
                nextEditor[0].CodeMirror.focus();
            } else {
                App.newEditor();
            }
        }
    });
}

Editor.prototype.run = function(code) {
    var self = this;
    var code = "function log() { Editor.log($output, arguments); };\n" +
        self.editor.getValue();
    var fn = Function('$output', code);
    try {
        var out = fn.call(null, self.$output);
    } catch (e) {
        var out = Editor.log(self.$output, [e.stack]);
    }
    App.save();
};

Editor.log = function($output, args) {
    $output.append('<div>' + Editor.prettyprint(args) + '</div>');
    console.log.apply(console, args);
};

Editor.prettyprint = function(what) {
    if (!what) {
        return '' + what;
    } else if (_.isArguments(what)) {
        var items = [];
        for (var i=0, item; item=what[i]; i++) {
            items.push(Editor.prettyprint(item));
        }
        return items.join(', ');
    } else if (_.isArray(what)) {
        var items = [];
        for (var i=0, item; item=what[i]; i++) {
            items.push(Editor.prettyprint(item));
        }
        return '[' + items.join(', ') + ']';
    } else if (typeof what == 'object') {
        var items = [];
        for (var key in what) {
            if (what.hasOwnProperty(key)) {
                items.push(key + ': ' + Editor.prettyprint(what[key]));
            }
        }
        return '{' + items.join(', ') + '}';
    }
    return what.toString();
};



function upload($output) {
    // Show file picker
    return new Promise(function(resolve, reject) {
        $('<input type="file" multiple class="file_picker">')
            .appendTo($output)
            .change(function() {
                var files = Array.prototype.slice.call(this.files, 0);
                resolve(files);
            })
            .show();
    });
}

function download($output, data) {
    return new Promise(function(resolve, reject) {
        
    });
}


function NextCSV(file, options) {
    options = options || {};
    this.file = file;
    this.headers = options.headers;
    this.delim = options.delim || ',';
    this.start = 0;
    this.chunk = 5 * 1024 * 1024;
    this.buffer = '';
    this.rows = [];
    this.done = false;
}

NextCSV.prototype.next = function() {
    // Returns 
    var self = this;
    return new Promise(function(resolve, reject) {
        if (self.rows.length) {
            resolve(self.rows);
            self.rows = [];
        } else {
            self._load(function(done) {
                if (done) {
                    resolve(null);
                } else {
                    resolve(self.rows);
                    self.rows = [];
                }
            });
        }
    });
};

NextCSV.prototype._load = function(cb) {
    // Loads buffer until a row is parsed
    var self = this;
    var end = self.start + self.chunk;
    var reader = new FileReader();
    var blob = self.file.slice(self.start, end);
        
    reader.onload = function(e) {
        self.buffer += e.target.result;
        self._parse();
        
        if (end >= self.file.size) {
            return cb(true);
        }
        self.start = end;
        
        if (self.rows.length) {
            cb(false);
        } else {
            self._load(cb);
        }
    };
    reader.readAsText(blob);
};

NextCSV.prototype._parse = function() {
    // Parses buffer into objects
    var self = this;
    var lines = [];
    
    // Add new lines from buffer
    if (self.buffer.indexOf(self.delim) != -1) {
        var newlines = self.buffer.match(/[^\r\n]+/g);
        self.buffer = newlines.pop() || '';
        lines = lines.concat(newlines);
    }
    if (self.done) lines.push(buffer);
    
    // Parse header
    if (!self.headers && lines.length) {
        self.headers = lines.shift().split(self.delim);
    }
    
    // Parse lines
    lines.forEach(function(line) {
        var values = line.split(self.delim);
        var row = {};
        for (var i=0; i < self.headers.length; i++) {
            row[self.headers[i]] = values[i];
        }
        self.rows.push(row);
    }); 
};



