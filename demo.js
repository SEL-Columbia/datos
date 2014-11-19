// Welcome to Datos, a lightweight data-analysis tool
//
// "It's like iPython, but for Javascript and on the client-side"
// Github: https://github.com/SEL-Columbia/datos
//
// Usage: To execute a code block, press SHIFT + RETURN


// Storing data in IndexedDB
idb('zoo')                          // Creates a database 
    .store('penguins')              // Creates a store (aka table)
    .add({                          // Adds a row and returns a promise
        name: 'Bob',
        age: 3,
        likes: ['cheese', 'fries']
    })
    .then(log);                     // Once complete, log the output
                                    // (the id of the row)
//!BLOCK
// Adding multiple rows
idb('zoo')
    .store('penguins')
    .load([
        {name: 'April', age: 4, likes: ['milk', 'corn']},
        {name: 'Charles', age: 6, likes: ['milk', 'cheese', 'truffles']},
        {name: 'Devone', age: 10, likes: ['corn', 'penguins']}
    ])
    .then(log);
//!BLOCK
// How many penguins?
idb('zoo')
    .store('penguins')
    .count()
    .then(log);
//!BLOCK
// Listing all the penguins
idb('zoo')
    .store('penguins')
    .all()
    .then(log);
//!BLOCK
// Modifying stuff (lazily!)
idb('zoo')
    .store('penguins')
    .each(function(penguin) {
        // I forgot they liked fish
        penguin.likes.push('fish');
    })
    .save(log);
//!BLOCK
// Tallying stuff
likes = {};
ageTot = 0;
nPenguins = 0;

idb('zoo')
    .store('penguins')
    .each(function(penguin) {
        // Tally likes
        penguin.likes.forEach(function(like) {
            likes[like] = (likes[like] || 0) + 1;
        });
        
        // Tally age
        ageTot += penguin.age;
        nPenguins++;
    })
    .run()
    .then(function() {
        log('Penguins Like', likes);
        log('Median penguin age', ageTot / nPenguins);
    });
//!BLOCK
// Embedding a chart
var img = '<img src="https://chart.googleapis.com/chart?cht=p3&chs=250x100' +
    '&chl=' + _.keys(likes).join('|') +
    '&chd=t:' + _.values(likes).join(',') + '">';
$output.append(img);