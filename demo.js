var headers = ['state','lga','ward','polling_unit','voter_id',
        'puid','name_1','name_2','name_3','birth_year','birth_month',
        'birth_day','sex','address','profession','status'];


function loadFiles(files) {
    var file = files.shift();
    if (!file) return;
    
    console.log('Remaining', files.length);
    console.log('Loading', file);
    var reader = new NextCSV(file, {
        headers: headers,
        delim: '|'
    });
    addRows(reader, function() {
        console.log('Done loading', file);
        loadFiles(files);
    });
}


function addRows(reader, cb) {
    reader.next()
        .then(function(rows) {
            console.log('Loading rows...');
            if (!rows) return cb();
            idb('nigeria')
                .store('test')
                .load(rows)
                .then(function() {
                    addRows(reader, cb);
                });
        });
}




// $ Loading CSV:
db('nigeria')
    .store('health')
    .loadCSV();


// $ Adding rows:
d.db('nohuck')
    .table('videos')
    .add({id: 123, age: 1, height: 10}); // returns Table or Row?


// Getting rows:
d.db('nohuck')
    .table('videos')
    .get(123);


// Sampling data:
d.db('nohuck')
    .table('videos')
    .sample(100);


// Filtering data:
d.db('nohuck')
    .table('videos')
    .sample(100)
    .filter(function(row) {
        return row['date'] > new Date(2000, 1);
    });


// Iterating through rows:
d.db('nohuck')
    .table('videos')
    .each(function(video) {
        
    })
    .save() // Execute and save on each row
    
// Execute lazy object and get the value:
d.db('nohuck')
    .table('videos')
    .val()

// Do stuff with columns:
d.db('nohuck')
    .table('videos')
    .col('points')
    .avg();

