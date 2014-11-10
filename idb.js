(function() {
    
idb = function(name) {
    return new Database(name);
};

idb.list = function() {
    // Returns a promise of a list of IndexedDb databases
    return new Promise(function(resolve, reject) {
        indexedDB
            .webkitGetDatabaseNames()
            .onsuccess = function(sender,args) {
                resolve(sender.target.result);
            };
    });
};

idb.remove = function(name) {
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
            db.onerror = function(event) {
                throw 'Error creating/accessing IndexedDB';
            };
            resolve(db);
        };
        request.onerror = function(event) {
            console.log('what??')
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
    var self = this;
    return new Promise(function(resolve,reject) {
        self.getIDB()
            .then(function(db) {
                // Close lower version # connection as it will block other connections
                db.close();
                var req = indexedDB.open(self.name, db.version + 1);
                req.onupgradeneeded = function(event) {
                    var db2 = event.target.result;
                    var store = db2.createObjectStore(name, {autoIncrement: true});
                    resolve(store);
                };
                req.onerror = function(event) {
                    reject(event);
                };
            });
    });
};

Database.prototype.removeStore = function(name) {
    var self = this;
    return new Promise(function(resolve,reject) {
        self.getIDB()
            .then(function(db) {
                db.close();
                var req = indexedDB.open(self.name, db.version + 1);
                req.onupgradeneeded = function(event) {
                    var db2 = event.target.result;
                    try {
                        db2.removeObjectStore(name);
                        resolve(true);
                    } catch(e) {
                        resolve(false);
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


})();
