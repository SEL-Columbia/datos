(function() {
    
idb = function(name) {
    return new Database(name);
};

idb.list = function() {
    // Returns a promise containing a list of IndexedDb database names
    return new Promise(function(resolve, reject) {
        indexedDB
            .webkitGetDatabaseNames()
            .onsuccess = function(sender, args) {
                resolve(sender.target.result);
            };
    });
};

idb.delete = function(name) {
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

Database.prototype.getIDB = function() {
    // Returns a promise containing an IDBDatabase instance
    var self = this;
    return new Promise(function(resolve, reject) {
        var req = indexedDB.open(self.name);
        req.onsuccess = function(event) {
            var db = req.result;
            db.onerror = function(event) {
                throw 'Error creating/accessing IndexedDB';
            };
            resolve(db);
        };
        req.onerror = function(event) {
            reject(event);
        };
    });
};


Database.prototype.list = function() {
    // List stores
    var self = this;
    return new Promise(function(resolve, reject) {
        self.getIDB()
            .then(function(db) {
                resolve(db.objectStoreNames);
            });
    });
};

Database.prototype.delete = function(name) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.getIDB()
            .then(function(db) {
                db.close();
                var req = indexedDB.open(self.name, db.version + 1);
                req.onupgradeneeded = function(e) {
                    var db2 = e.target.result;
                    try {
                        db2.deleteObjectStore(name);
                        resolve(true);
                    } catch(e) {
                        reject(e);
                    }
                };
            });
    });
};

Database.prototype.store = function(name) {
    return new Store(this, name);
};


function Store(db, name, queue) {
    this.db = db;
    this.name = name;
    this.queue = queue || []; // Operations queue
}

Store.prototype.getIDBStore = function(mode) {
    var self = this;
    return new Promise(function(resolve,reject) {
        self.db
            .getIDB()
            .then(function(db) {
                if (db.objectStoreNames.contains(self.name)) {
                    // Return object store
                    var store = db.transaction([self.name], mode)
                        .objectStore(self.name);
                    resolve(store);
                } else {
                    // Create an object store
                    // Close connection as it will block transactions
                    db.close();
                    var req = indexedDB.open(db.name, db.version + 1);
                    req.onupgradeneeded = function(event) {
                        var db2 = event.target.result;
                        db2.createObjectStore(self.name, {autoIncrement: true});
                        db2.close();
                        self.getIDBStore(mode)
                            .then(resolve);
                    };
                    req.onerror = function(event) {
                        reject(event);
                    };
                }
            });
    });
};


Store.prototype.get = function(id) {
    var self = this;
    return self.getIDBStore('readonly')
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
    return new Promise(function(resolve, reject) {
        self.getIDBStore('readwrite')
            .then(function(store) {
                // TODO: figure out why transactions are interrupted by console.log()
                // https://www.youtube.com/watch?v=2Oe9Plp6bdE
                var req = store.add(obj);
                req.onsuccess = function(e) {
                    // Returns row key
                    resolve(e.target.result);
                };
                req.onerror = function(e) {
                    reject(e);
                };
            });
    });
};

Store.prototype.load = function(objs) {
    // Bulk loads rows
    // Returns a promise that will trigger when loading has finished
    //
    // http://stackoverflow.com/questions/22247614/optimized-bulk-chunk-upload-of-objects-into-indexeddb
    // http://stackoverflow.com/questions/10471759/inserting-large-quantities-in-indexeddbs-objectstore-blocks-ui
    var self = this;    
    return new Promise(function(resolve, reject) {
        self.getIDBStore('readwrite')
            .then(function(store) {
                var index = 0;                
                function addNext() {
                    var obj = objs[index++];
                    if (!obj) return resolve();
                    var req = store.add(obj);
                    req.onsuccess = addNext;
                    req.onerror = reject;
                }
                addNext();
            });
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
    return this.run('readwrite');
};

Store.prototype.run = function(mode) {
    var self = this;
    mode = mode || 'readonly';
    return new Promise(function(resolve, reject) {
        self.getIDBStore(mode)
            .then(function(store) {
                store.openCursor().onsuccess = function(event) {
                    var cursor = event.target.result;
                    if (cursor) {
                        var row = cursor.value;
                        row.id = cursor.key;
                        for (var i=0, fn; fn=self.queue[i]; i++) {
                            row = fn.call(null, row, store);
                            if (row === false) {
                                return resolve();                                
                            }
                        }
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
            });
    });
};

Store.prototype.all = function() {
    var self = this;
    var rows = [];
    self.queue.push(function(row) {
        rows.push(row);
    });
    return self.run()
        .then(function() {
            return rows;
        });
};

Store.prototype.first = function(n) {
    return this.each(function(row) {
        return n-- ? row : false;
    });
};


Store.prototype.count = function() {
    var self = this;
    var count = 0;
    self.queue.push(function(row) {
        count++;
    });
    return self.run()
        .then(function() {
            return count;
        });
};


})();
