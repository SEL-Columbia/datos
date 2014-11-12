var headers = ['state','lga','ward','polling_unit','voter_id',
        'puid','name_1','name_2','name_3','birth_year','birth_month',
        'birth_day','sex','address','profession','status'];

upload().then(function(files) {
    loadFiles(files);
});


function loadFiles(files) {
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

i = 0;

function addRows(reader, end) {
    reader.next()
        .then(function(rows) {
        	console.log(rows);
        	i++;
            if (!rows) {
                return loadFiles(files);
            }
            idb('nigeria')
                .store('test6')
                .load(rows)
                .then(function() {
                	addRows(reader);
            	});
        });
}




function testIter() {
    i = 0;
    start = new Date();
    idb('nigeria')
        .store('test6')
        .each(function(row){
            i++;
        })
        .run()
    	.catch(console.log)
	    .then(function(){
            var end  = new Date();
            var time = (end.getTime() - start.getTime()) / 1000;
            console.log(i, time);
        });
}


testIter();






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

