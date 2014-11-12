
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
    Editor.saveAll();
    
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

Editor.restore();



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


function textStream(file) {
    return Bacon.fromBinder(function(sink) {
        var start = 0;
        var chunk = 5 * 1024 * 1024;
        
        function readChunk(start) {
            var end = start + chunk;
            var reader = new FileReader();
            var blob = file.slice(start, end);
            reader.onload = function(e) {
                if (end >= file.size) {
                    console.log('end');
                    sink(new Bacon.End());
                } else {
                    sink(e.target.result);
                    readChunk(end, end + chunk);
                }
            };
            reader.readAsText(blob);
        }
        readChunk(start);
        return function() {};
    });
}

function textStream2(file) {
    return Kefir.fromBinder(function(emitter) {
        var start = 0;
        var chunk = 5 * 1024 * 1024;
        
        function readChunk(start) {
            var end = start + chunk;
            var reader = new FileReader();
            var blob = file.slice(start, end);
            reader.onload = function(e) {
                if (end >= file.size) {
                    emitter.end();
                } else {
                    emitter.emit(e.target.result);
                    readChunk(end, end + chunk);
                }
            };
            reader.readAsText(blob);
        }
        readChunk(start);
        return function() {};
    });
}


function CSVReader(file, options) {
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

CSVReader.prototype.next = function() {
    var self = this;
    return new Promise(function(resolve, reject) {
        if (self.rows.length) {
            resolve(self.rows.shift());
        } else {
            self.loadRows(function() {
                if (self.done) {
                    resolve(null);
                } else {
                    resolve(self.rows.shift());
                }
            });
        }
    });
};

CSVReader.prototype.loadRows = function(cb) {
    console.log('load rows')
    var self = this;
    var end = self.start + self.chunk;
    var reader = new FileReader();
    var blob = self.file.slice(self.start, end);
        
    reader.onload = function(e) {
        self.buffer += e.target.result;
        if (end >= self.file.size) {
            self.done = true;
        } else {
            self.start = end;
        }
        self.getRows();
        
        if (self.rows.length || self.done) {
            cb();
        } else {
            self.loadRows(cb);
        }
    };
    reader.readAsText(blob);
};

CSVReader.prototype.getRows = function() {
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

function parseCSV2(file, options) {
    var rows = Kefir.emitter();
    var options = _.defaults(options || {}, {
        headers: null,
        delim: ','
    });
    var headers = options.headers;
    var buffer = '';
    var lines = [];
    
    stream.onValue(parse);
    stream.onEnd(function(text) {
        parse(text, true);
        rows.end();
    });
    
    function parse(text, end) {
        buffer += text;
        // Add new lines from buffer
        if (buffer.indexOf(options.delim) != -1) {
            var newlines = buffer.match(/[^\r\n]+/g);
            buffer = newlines.pop() || '';
            lines = lines.concat(newlines);
        }
        if (end) lines.push(buffer);
        
        // Parse header
        if (!headers && lines.length) {
            headers = lines.shift().split(options.delim);
        }
        
        // Parse rows
        lines.forEach(function(line) {
            var values = line.split(options.delim);
            var row = {};
            for (var i=0; i < headers.length; i++) {
                row[headers[i]] = values[i];
            }
            rows.emit(row);
        });
        lines = [];
    }
    return rows;
}



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





