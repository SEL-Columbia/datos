
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
            new Editor(code).run();
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
    
    var files = new Bacon.Bus();
    $('<input type="file" multiple class="file_picker">')
        .appendTo(Editor.current.$output)
        .change(function() {
            _.each(this.files, function(file) {
                files.push(file);
            });
        })
        .show();
    
    function fileStream(file) {
        return Bacon.fromBinder(function(sink) {
            var start = 0;
            var chunk = 5 * 1024 * 1024;
            
            function readChunk(start) {
                var end = start + chunk;
                var reader = new FileReader();
                var blob = file.slice(start, end);
                reader.onload = function(e) {
                    sink(e.target.result);
                    if (end < file.size) {
                        readChunk(end, end + chunk);
                    } else {
                        sink(new Bacon.End())
                    }
                };
                reader.readAsText(blob);
            }
            readChunk(start);
            return function() {};
        });
    }
    
    return files.map(fileStream);
};



function parseCSV(stream, options) {
    var rows = new Bacon.Bus();
    var options = _.defaults(options || {}, {
        headers: null,
        delim: ','
    });
    var headers = options.headers;
    var buffer = '';
    var lines = [];
    
    stream.onValue(parse)
    stream.onEnd(function(text) {
        parse(text, true);
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
            rows.push(row);
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





