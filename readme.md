# Datos

A lightweight client-side data analysis tool.


## Gotchas

Code blocks don't share local scope. This means variables declared with `var` are not accessible between code blocks. One way to work around this is to declare variables globally.

This feature is somewhat difficult to implement, but may be added in the future.
1. Regex to scan code string for `var` declarations
2. Append and return local variables in an object `{a: 1, b:2, c: 3}`
4. Run next code block inside a `function(a,b,c){}`



## Useful links
- [Quota research](http://www.html5rocks.com/en/tutorials/offline/quota-research/)
- http://pandas.pydata.org/
- [Intro to reactive programming](https://gist.github.com/staltz/868e7e9bc2a7b8c1f754)
- http://baconjs.github.io/index.html
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- http://stackoverflow.com/questions/19287586/save-client-generated-data-as-file-in-javascript-in-chunks
- http://www.rethinkdb.com/api/javascript/
- https://github.com/jlongster/transducers.js
- http://danieltao.com/lazy.js/

## License

This projected is licensed under the terms of the MIT license

