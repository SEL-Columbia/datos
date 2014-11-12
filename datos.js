
// Overwrite console.log -- dirty, i know
var _log = console.log
console.log = function() {
    _log.apply(this, arguments);
};


Console = {};
Console.prettyprint = function(what) {
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

Console.saveAll = function() {
    var codes = [];
    $('.editor')
        .each(function() {
            var code = this.CodeMirror.getValue();
            if (code) codes.push(code);
        });
    localStorage.codes = JSON.stringify(codes);
};

Console.restore = function() {
    var codes = localStorage.codes ? JSON.parse(localStorage.codes) : [];
    if (codes.length) { 
        codes.forEach(function(code) {
            new Editor(code);
        });
    } else {
        new Editor();
    }
};




function Editor(code) {
    var self = this;
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
            Editor.current = self;            
            self.run();
            
            // Focus on next editor
            var nextEditor = self.$output.next('.editor');
            if (nextEditor.length) {
                nextEditor[0].CodeMirror.focus();
            } else {
                new Editor();
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
    var code = self.editor.getValue();
    try {
        var out = window.eval(code);
    } catch (e) {
        var out = e;
    }
    Console.saveAll();
    
    if (out && out.then) {
        // Output the value of a promise
        self.$output.append('Promise: ...');
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

Console.restore();



function upload() {
    // https://developer.mozilla.org/en-US/docs/Using_files_from_web_applications
    // http://stackoverflow.com/questions/26056540/javascript-using-file-reader-to-read-line-by-line
    // http://updates.html5rocks.com/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
    
    return new Promise(function(resolve, reject) {
        $('<input type="file" multiple class="file_picker">')
            .appendTo(Editor.current.$output)
            .change(function() {
                var files = Array.prototype.slice.call(this.files, 0);
                resolve(files);
            })
            .show();
    });
};


function loadScripts() {
    var urls = Array.prototype.slice.call(arguments);
    return new Promise(function(resolve, reject) {
        var loaded = 0;
        urls.forEach(function(url) {
            $.getScript(url)
                .done(function() {
                    loaded++;
                    if (loaded == urls.length) resolve();
                })
                .fail(function() {
                    reject('Error loading script: ' + url);
                });
        });
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
    this.lines = [];
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

NextCSV.prototype._load = function(done) {
    // Loads buffer until a row is parsed
    var self = this;
    var end = self.start + self.chunk;
    var reader = new FileReader();
    var blob = self.file.slice(self.start, end);
        
    reader.onload = function(e) {
        self.buffer += e.target.result;
        self._parse();
        
        if (end >= self.file.size) {
            done(true);
        }
        self.start = end;
        
        if (self.rows.length) {
            done(false);
        } else {
            self._load(done);
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







