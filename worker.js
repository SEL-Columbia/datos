importScripts('idb.js');

// Overwrite console.log -- dirty, i know
var _log = console.log
console.log = function() {
    _log.apply(this, arguments);
};

_ID = null; // ID of code editor that last ran code


self.onmessage = function(e) {
    var data = e.data;
    console.log('worker received', data);
    if (data.type == 'run') {
        _ID = data.id;
        try {
            var out = eval(data.code);
        } catch(e) {
            var out = e.toString();
        }
        postMessage({
            id: data.id,
            out: out
        });
    }
};


function runMain() {
    // Runs some code in the main thread    
    postMessage({
        cb: args[0].toString(),
        args: args.slice(1)
    });
}


function upload() {
    runMain(function(id) {
        // Show file picker
        var editor = App.editors[id];
        $('<input type="file" multiple class="file_picker">')
            .appendTo(editor.$output)
            .change(function() {
                var files = Array.prototype.slice.call(this.files, 0);
                App.worker.postMessage(files);
            })
            .show();
    }, _ID);
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





