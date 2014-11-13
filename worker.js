importScripts('worker-lib.js');
importScripts('idb.js');


// Overwrite console.log -- dirty, i know
var _log = console.log
console.log = function() {
    _log.apply(this, arguments);
};

DATA = null; // Last received data


self.onmessage = function(e) {
    var data = e.data;
    console.log('worker received', data);
    DATA = data;
    if (data.type == 'code') {
        try {
            var out = eval(data.code);
        } catch(e) {
            console.log(e)
            var out = e.toString();
        }
        postMessage({id: data.id, out: out});
    }
};


function runMain(cb) {
    // Runs some code in the main thread
    postMessage({
        cb: cb.toString(),
        args: Array.prototype.slice.call(arguments, 1)
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
                App.runWorker(id, 'loadFiles(DATA.args);', files);
            })
            .show();
    }, DATA.id);
}

function loadFiles(files) {
    console.log('loading!!')
    var file = files.shift();
    if (!file) return;
    
    console.log('parsing file', file);
    var reader = new NextCSV(file, {
        headers: headers,
        delim: '|'
    });
    addRows(reader, function() {
        loadFiles(files);
    });
}


function addRows(reader, cb) {
    reader.next()
        .then(function(rows) {
            console.log('addRows', rows)
            if (!rows) return cb();
            idb('nigeria')
                .store('test')
                .load(rows)
                .then(function() {
                    addRows(reader);
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





