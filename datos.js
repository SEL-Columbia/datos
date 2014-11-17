App = {};
App.init = function() {
    // Module entry point
    var self = this;
    this.worker = this.startWorker();
    this.editors = {};
    
    // Events
    window.onbeforeunload = function() {
        return 'Are you sure you want to close this page?';
    };
    
    // Restore saved page
    var codes = localStorage.codes ? JSON.parse(localStorage.codes) : [];
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

App.save = function() {
    var codes = [];
    $('.editor')
        .each(function() {
            var code = this.CodeMirror.getValue();
            if (code) codes.push(code);
        });
    localStorage.codes = JSON.stringify(codes);
};


function Editor(code) {
    var self = this;
    self.id = Math.random();
    self.editor = CodeMirror($('.content')[0], {
        value: code || '',
        mode: 'javascript',
        autofocus: true,
        indentUnit: 4,
        viewportMargin: Infinity,
        theme: 'twilight'
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
            
            // Run code in worker
            //App.runWorker(self.id, cm.getValue());
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

Editor.prettyprint = function(what) {
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

Editor.saveAll = function() {
    var codes = [];
    $('.editor')
        .each(function() {
            var code = this.CodeMirror.getValue();
            if (code) codes.push(code);
        });
    localStorage.codes = JSON.stringify(codes);
};

Editor.restore = function() {
    var codes = localStorage.codes ? JSON.parse(localStorage.codes) : [];
    if (codes.length) { 
        codes.forEach(function(code) {
            new Editor(code);
        });
    } else {
        new Editor();
    }
};

Editor.prototype.run = function(code) {
    var self = this;
    var c = _.clone(console);
    var code = "c.log = function(arg) {$output.append('<div>' + arg + '</div>');};" +
        "var console = c;"
        + self.editor.getValue();
    var fn = Function('$output', 'c', code);
    
    try {
        var out = fn.call(null, self.$output, c);
    } catch (e) {
        var out = e;
    }
    App.save();
    
    if (out && out.then) {
        // Output the value of a promise
        self.$output.append('Promise...');
        out.then(function(val) {
            self.$output
                .append('<div>' + Editor.prettyprint(val) + '</div>');
        });
    } else if (out && out.onValue) {
        // Bacon stream    
        out.onValue(function(val) {
            self.$output
                .append('<div>' + Editor.prettyprint(val) + '</div>');
        });
    } else {
        self.$output.append(Editor.prettyprint(out));
    }
};



// Overwrite console.log -- dirty, i know
console._log = console.log;

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
    this.options = _.defaults(options || {}, {
        headers: null,
        delim: ','
    });
    this.file = file;
    this.headers = options.headers;
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
    if (self.buffer.indexOf(self.options.delim) != -1) {
        var newlines = self.buffer.match(/[^\r\n]+/g);
        self.buffer = newlines.pop() || '';
        lines = lines.concat(newlines);
    }
    if (self.done) lines.push(buffer);
    
    // Parse header
    if (!self.headers && lines.length) {
        self.headers = lines.shift().split(self.options.delim);
    }
    
    // Parse lines
    lines.forEach(function(line) {
        var values = line.split(self.options.delim);
        var row = {};
        for (var i=0; i < this.headers.length; i++) {
            row[this.headers[i]] = values[i];
        }
        self.rows.push(row);
    }); 
};



