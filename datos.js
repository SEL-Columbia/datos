
function Editor(code) {
    var self = this;
    self.editor = CodeMirror($('.content')[0], {
        value: code || '',
        mode: 'javascript',
        autofocus: true,
        indentUnit: 4,
        viewportMargin: Infinity,
        theme: 'twilight editor'
    });
    
    self.$output = $('<div class="output"></div>')
        .insertAfter(self.editor.getWrapperElement());
        
    self.editor.setOption('extraKeys', {
        'Shift-Enter': function(cm) {
            Editor.current = self;
            var code = cm.getValue();
            localStorage['code'] = code;
            try {
                var out = window.eval(code);
            } catch (e) {
                var out = e;
            }
            
            if (out && out.then) {
                // Output the value of a promise
                self.$output.append('Promise: ...');
                out.then(function(val) {
                    self.$output
                        .append('<div>' + Editor.prettyprint(val) + '</div>');
                });
            } else {
                self.$output.append(Editor.prettyprint(out));
            }
            
            new Editor();
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
    
};

Editor.restore = function() {
    
}

new Editor(localStorage['code']);



function load(cb) {
    // https://developer.mozilla.org/en-US/docs/Using_files_from_web_applications
    // http://stackoverflow.com/questions/26056540/javascript-using-file-reader-to-read-line-by-line
    // http://updates.html5rocks.com/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
    return new Promise(function(resolve, reject) {
        $('<input type="file" multiple class="file_picker">')
            .appendTo(Editor.current.$output)
            .change(function() {
                var results = [];
                var nFiles = this.files.length;
                _.each(this.files, function(file) {
                    var reader = new FileReader();
                    reader.onload = function(e) {
                        results.push([e.target.result, file]);
                        if (results.length == nFiles) {
                            resolve(results);
                        }
                    };
                    reader.readAsText(file);
                });
            })
            .show();
    });
};

function loadCSV(text) {
    var lines = text.split('\n');
    var header = lines.shift().split(',');
    var rows = [];
    lines.forEach(function(line) {
        var values = line.split(',');
        var row = {};
        for (var i=0; i < header.length; i++) {
            row[header[i]] = values[i];
        }
        rows.push(row);
    });
    return rows;
}


function db(name) {
    return new Database(name);
};

db.list = function() {
    // Returns a promise of a list of IndexedDb databases
    return new Promise(function(resolve, reject) {
        indexedDB
            .webkitGetDatabaseNames()
            .onsuccess = function(sender,args) {
                resolve(sender.target.result);
            };
    });
};

db.remove = function(name) {
    // Removes a database
    return new Promise(function(resolve, reject) {
        var req = indexedDB.deleteDatabase(name);
        req.onsuccess = function(event) {    
            resolve(true);
        };
        req.onerror = function(event) {
            resolve(false);
        };
    });
};

function Database(name) {
    this.name = name;
}


Database.prototype.getIDB = function(store) {
    // Returns a promise containing an IDBDatabase instance
    var self = this;
    return new Promise(function(resolve, reject) {
        var request = indexedDB.open(self.name);
        request.onsuccess = function(event) {
            var db = request.result;
            if (!store || db.objectStoreNames.contains(store)) {
                db.onerror = function(event) {
                    throw 'Error creating/accessing IndexedDB';
                };
                resolve(db);
            } else {
                console.log('creating store', self.name, db.version)
                // Close connection
                // Lower version # connections block other connections
                db.close();
                
                var request2 = indexedDB.open(self.name, db.version + 1);
                request2.onupgradeneeded = function(event) {
                    var db2 = event.target.result;
                    db2.createObjectStore(store, {autoIncrement: true});
                };
                request2.onsuccess = function(event) {
                    resolve(request2.result);
                };
                request2.onerror = function(event) {
                    throw event;
                    reject(event);
                };
            }
        };
        request.onerror = function(event) {
            console.log('what??')
            reject(event);
        };
    });
};

Database.prototype.getIDBVersionChange = function() {
    return this.getIDB()
        .then(function(db) {
            // Close lower version # connection as it will block other connections
            db.close();
            var req = indexedDB.open(self.name, db.version + 1);
            req.onupgradeneeded = function(event) {
                var db2 = event.target.result;
                db2.createObjectStore(store, {autoIncrement: true});
            };
            req.onsuccess = function(event) {
                resolve(req.result);
            };
            req.onerror = function(event) {
                throw event;
                reject(event);
            };

        });
};

Database.prototype.list = function() {
    // List stores
    return this.getIDB()
        .then(function(db) {
            return db.objectStoreNames;
        });
};

Database.prototype.addStore = function(name) {
    return this.getIDB()
        .then(function(db) {
            
        })
};

Database.prototype.removeStore = function() {
    
};

Database.prototype.store = function(name) {
    return new Store(this, name);
};


function Store(db, name, queue) {
    this.db = db;
    this.name = name;
    this.queue = queue || [];
}

Store.prototype.info = {
    takes: ['str'],
    returns: null
};

Store.prototype.getIDBStore = function() {
    var self = this;
    return self.db
        .getIDB(self.name)
        .then(function(db) {
            return db.transaction([self.name], 'readwrite')
                .objectStore(self.name);
        });
};

Store.prototype.get = function(id) {
    var self = this;
    return self.getIDBStore()
        .then(function(store) {
            return new Promise(function(resolve, reject) {
                var request = store.get(id);
                request.onsuccess = function(event) {
                    resolve(event.target.result);
                };
                request.onerror = function(event) {
                    reject(event);
                };
            });
        });
};

Store.prototype.add = function(obj) {
    var self = this;
    return self.getIDBStore()
        .then(function(store) {
            return new Promise(function(resolve, reject) {
                var request = store.add(obj);
                request.onsuccess = function(event) {
                    // Returns row key
                    resolve(event.target.result);
                };
                request.onerror = function(event) {
                    reject("Error creating/accessing IndexedDB");
                };
            });
        });
};

Store.prototype.addRows = function(rows) {
    var self = this;
    return self.getIDBStore()
        .then(function(store) {
            // TODO: figure out why transactions are interrupted by console.log()
            // https://www.youtube.com/watch?v=2Oe9Plp6bdE
            for (var i=0, row; row = rows[i]; i++) {
                store.add(row);
            }
            console.log('done')
        });
};

Store.prototype.each = function(cb) {
    return new Store(this.db, this.name, this.queue.concat(cb));
};

Store.prototype.saveAll = function() {
    function saveRow(row, store) {
        var id = row.id;
        delete row.id;
        store.put(row, id);
        return row;
    }
    this.queue.push(saveRow);
    this.apply();
};

Store.prototype.apply = function() {
    var self = this;
    return self.getIDBStore()
        .then(function(store) {
            return new Promise(function(resolve, reject) {
                store.openCursor().onsuccess = function(event) {
                    var cursor = event.target.result;
                    if (cursor) {
                        var row = cursor.value;
                        row.id = cursor.key;
                        self.queue.forEach(function(fn) {
                            row = fn.call(window, row, store);
                        });
                        cursor.continue();
                    } else {
                        resolve(true);
                    }
                };
            });
        });
};

Store.prototype.all = function() {
    return this.getIDBStore()
        .then(function(store) {
            return new Promise(function(resolve, reject) {
                var rows = [];
                store.openCursor().onsuccess = function(event) {
                    var cursor = event.target.result;
                    if (cursor) {
                        rows.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(rows);
                    }
                };
            });
        });
};





