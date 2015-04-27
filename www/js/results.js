// results.js     Saved test results
//
angular.module('replictest.results', [])

/* We're using HTML5 local storage. The value is JSON representing an
 * array of objects like this:
 *
 * {  nettype: 'wifi or cellular',
 *    count: int,            // Number of records replicated
 *    blocksize: int,        // Number of records in a block for large docs
 *    insmall:  millisec,    // Time to pull small docs from server
 *    outsmall: millisec,    // Time to push small docs to server
 *    inlarge:  millisec,    // Time to pull large docs from server
 *    outlarge: millisec,    // Time to push large docs to server
 *    id: int                // Unique identifier assigned here
 * }
 */

.factory('Results', function() {
    var key = 'results';
    var results;

    function init()
    {
        if (results)
            return;
        var json;
        if(!!(json = window.localStorage.getItem(key))) {
            results = JSON.parse(json);
        } else
            results = [];
    }

    return {
        all: function() {
            init();
            return results;
        },
        add: function(res) {
            // Caller is responsible for well formed res.
            //
            init();
            res.id = results.length;
            results.unshift(res);
            var json = JSON.stringify(results);
            window.localStorage.setItem(key, json);
        }
    };
})
