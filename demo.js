
var headers = ['state','lga','ward','polling_unit','voter_id',
        'puid','name_1','name_2','name_3','birth_year','birth_month',
        'birth_day','sex','address','profession','status'];

upload().then(function(files) {
    files.forEach(function(file) {
        console.log('parsing file', file);
        parseCSV(file, processRow);
    });
});

function processRow(row) {
    console.log('adding row');
    idb('nigeria').store('test5').add(row);
}


var reader = new CSVReader(file);
function addRow() {
    reader.next()
        .then(function(row) {
            if (!row) return;
            idb('nigeria')
                .store('test5')
                .add(row)
                .then(addRow);
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

