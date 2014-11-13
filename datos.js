App = {};
App.init = function() {
    // Module entry point
    var self = this;
    this.worker = this.startWorker();
    this.editors = {};
    
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
        if (data.cb) {
            var func = Function('return ' + data.cb)();
            func.apply(null, data.args);
        } else {
            editor.$output.append(data.out);
        }
    };
    worker.onerror = function(e) {
        var data = e.data;
        var editor = self.editors[data.id];
        editor.$output.text(e);
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
            
            // Run code in worker
            App.runWorker(self.id, cm.getValue());
            //self.editor.run(cm.getValue());
            
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
    var code = self.editor.getValue();
    try {
        var out = window.eval(code);
    } catch (e) {
        var out = e;
    }
    App.saveAll();
    
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








