
// $ Loading CSV:
d.db('nohuck')
    .store('videos')
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

