// tests.js     Replication tests
//
angular.module('replictest.tests', [ 'replictest.base64' ])

.factory('Tests', function($q, $http, Base64) {
    var LDBNAME = 'repltest';
    var RDBBASE = 'tractdb.org/couch/{USER}_tractdb';
    var RDBURL = 'http://' + RDBBASE;
    var RDBURLUP = 'http://{USER}:{PASS}@' + RDBBASE;
    var SMDOCTYPE = 'replsmall';   // Doc type for small test doc
    var LGDOCTYPE = 'repllarge';   // Doc type for large test doc
    var username = 'jeffsco';      // Hard coded for now
    var password = 'xxxxxxxxxxxx'; // SUPER SECRET PASSWORD
    var db_is_initialized = false;

    var c_rdburl, c_rdburlup;      // Cached copies of remote DB URLs
    var c_cblurl;                  // Cached copy of Couchbase Lite URL

    function rdburl()
    {
        // Remote db url.
        //
        if (!c_rdburl)
            c_rdburl = RDBURL.replace(/{USER}/g, username);
        return c_rdburl;
    }

    function rdburlup()
    {
        // Remote db url with embedded username and password.
        //
        if (!c_rdburlup) {
            c_rdburlup = RDBURLUP.replace(/{USER}/g, username);
            c_rdburlup = c_rdburlup.replace(/{PASS}/g, password);
        }
        return c_rdburlup;
    }

    function cblurl_p()
    {
        // Return a promise that resolves to the URL for the local
        // Couchbase Lite.
        //
        var def = $q.defer();
        if (c_cblurl) {
            def.resolve(c_cblurl);
        } else {
            if (!window.cblite) {
                var msg = 'Couchbase Lite init error: no window.cblite';
                console.log(msg);
                def.reject(msg);
            } else {
                window.cblite.getURL(function(err, url) {
                    if (err) {
                        def.reject(err);
                    } else {
                        cburl = url;
                        def.resolve(url);
                    }
                });
            }
        }
        return def.promise
        .then(function(u) {
            c_cblurl = u;
            return c_cblurl;
        })
    }

    function ldburl_p()
    {
        // Return a promise that resolves to the URL for the local DB.
        // Just need to add LDBNAME to the URL of Couchbase Lite.
        //
        return cblurl_p()
        .then(function(url) {
            return url + LDBNAME;
        });
    }

    function auth_hdr()
    {
        // Return the authorization header value for requests to the
        // remote DB.
        //
        return 'Basic ' + Base64.encode(username + ':' + password);
    }

    function initdb_p(cblurl)
    {
        // Return a promise to initialize the repltest DB. The promise
        // resolves to the URL of the DB.
        // 
        var dburl = cblurl + LDBNAME;

        if (db_is_initialized) {
            var def = $q.defer();
            def.resolve(dburl);
            return def.promise;
        }

        return $http.put(dburl)
        .then(function good(resp) {
                  db_is_initialized = true;
                  return dburl;
              },
              function bad(resp) {
                  if (resp.status == 412) {
                      db_is_initialized = true;
                      return dburl; // Not really bad: DB exists already.
                  } else {
                      var msg = 'DB creation failed, status: ' + resp.status;
                      throw new Error(msg);
                  }
              }
        );
    }

    function init_p()
    {
        // Create and initialize the DB if necessary, in any case
        // resolving to its URL.
        //
        return cblurl_p().then(initdb_p);
    }

    function push_repl_p()
    {
        // Return a promise for a push replication. The promise resolves
        // to an HTTP response.
        //
        return cblurl_p()
        .then(function(cblurl) {
            var pushspec = { source: LDBNAME, target: rdburlup() };
            return $http.post(cblurl + '_replicate', pushspec);
        })
    }

    function pull_repl_p()
    {
        // Return a promise for a pull replication. The promise resolves
        // to an HTTP response.
        //
        return cblurl_p()
        .then(function(cblurl) {
            var pullspec = { source: rdburlup(), target: LDBNAME };
            return $http.post(cblurl + '_replicate', pullspec);
        });
    }

    function bidir_repl_p()
    {
        // Return a promise for a bidirectional replication. The promise
        // resolves to an array of HTTP responses for the push and pull.
        //
        console.log('started bidirectional replication');
        return $q.all([push_repl_p(), pull_repl_p()])
        .then(function(x) {
            console.log('finished bidirectional replication');
            return x;
        });
    }

    function verify_doc_count_p(local, count, type)
    {
        // Return a promise to verify that the expected number of
        // documents of the given type appear in the local/remote DB. If
        // local, then local DB, else remote DB.
        //
        // The promise resolves to null.
        //
        return ldburl_p()
        .then(function(ldburl) {
            var dburl = local ? ldburl : rdburl();
            var req = {
                method: 'GET',
                url: dburl + '/_all_docs?include_docs=true',
            };
            if (!local)
                req.headers = { Authorization: auth_hdr() };
            return $http(req);
        })
        .then(function(resp) {
            var seen = 0;
            resp.data.rows.forEach(function(r) {
                if (r.doc.type == type)
                    // If there is a docs field, count each as one doc.
                    // Otherwise the whole thing is one doc.
                    //
                    if (Array.isArray(r.doc.docs))
                        seen += r.doc.docs.length;
                    else
                        seen++;
            });
            var locality = local ? 'local' : 'remote';
            var msg = 'verify_doc_count_p(' + locality + ', ' + count + ', ' +
                        type + '), saw ' + seen;
            console.log(msg);
            if (seen != count)
                throw new Error(msg);
            return null;
        });
    }

    function delete_local_p(type)
    {
        // Return a promise to delete all local documents of the given
        // type. The promise resolves to null.
        //
        var ldburl;

        return ldburl_p()
        .then(function(u) {
            ldburl = u;
            return $http.get(ldburl + '/_all_docs?include_docs=true');
        })
        .then(function(resp) {
            var todel = [];
            resp.data.rows.forEach(function(r) {
                if (r.doc.type == type)
                    todel.push({
                        _id: r.doc._id,
                        _rev: r.doc._rev,
                        _deleted: true
                    });
            });
            return $http({
                method: 'POST',
                url: ldburl + '/_bulk_docs',
                data: { docs: todel }
            });
        })
        .then(
            function(resp) {
                return null;
            },
            function(resp) {
console.log('error', JSON.stringify(resp));// TEMP
                throw new Error(resp.statusText);
            }
        );
    }

    function clean_repl_p(type)
    {
        // Clean up remnants of replication test from both DBs.
        //
        // (Delete locally, then push the change to remote DB.)
        //
        return delete_local_p(type)
        .then(function(_) {
            return push_repl_p();
        });
    }

    function small_docs(count)
    {
        // Return an array of the given number of small documents.
        //
        var res = [];

        for (var i = 0; i < count; i++) {
            res.push({
                uuid: i,
                time: Date.now(),
                type: SMDOCTYPE,
                latitude: 47.6,
                longitude: 122.3,
                altitude: 30.0,
                horizAcc: 1.0,
                vertAcc: 5.0
            });
        }
        return res;
    }

    function large_docs(count, blocksize)
    {
        var blockct = Math.floor((count + blocksize - 1) / blocksize);
        var res = [];
        var smd = small_docs(count);

        for (i = 0; i < blockct; i++) {
            var lgd = { docs: [], type: LGDOCTYPE };
            for (j = 0; j < blocksize; j++) {
                lgd.docs.push(smd.shift());
                if (smd.length <= 0)
                    break;
            }
            res.push(lgd);
        }
        return res;
    }

    function post_bulk_p(local, docs)
    {
        // Put the given documents into the local/remote DB in bulk
        // fashion. If local, then local DB, else remote DB.
        //
        return ldburl_p()
        .then(function(ldburl) {
            var dburl = local ? ldburl : rdburl();
            var req = {
                method: 'POST',
                url: dburl + '/_bulk_docs',
                data: { docs: docs }
            };
            if (!local)
                req.headers = { Authorization: auth_hdr() };
            return $http(req);
        });
    }

    return {
        outsmall_p: function(count) {
            // Return a promise to test push replication of small
            // documents. The promise resolves to the duration of the
            // replication.
            //
            return init_p()
            .then(function(_) {
                return bidir_repl_p(); // Create initial state
            })
            .then(function(_) {
                return post_bulk_p(true, small_docs(count));
            })
            .then(function(_) {
                return verify_doc_count_p(false, 0, SMDOCTYPE);
            })
            .then(function(_) {
                start = Date.now();
                return push_repl_p();
            })
            .then(function(_) {
                duration = Date.now() - start;
console.log('saw outsmall duration', duration); // TEMP
                return verify_doc_count_p(false, count, SMDOCTYPE);
            })
            .then(function(_) {
                return clean_repl_p(SMDOCTYPE);
            })
            .then(function(_) {
                return verify_doc_count_p(false, 0, SMDOCTYPE);
            })
            .then(
                function(_) {
                    return duration;
                },
                function(resp) {
console.log('error', JSON.stringify(resp));// TEMP
                    throw new Error(resp.statusText);
                }
            )
        },

        insmall_p: function(count) {
            // Return a promise to test pull replication of small
            // documents. The promise resolves to the duration of the
            // replication.
            //
            var start, duration;

            return init_p()
            .then(function(_) {
                return bidir_repl_p();
            })
            .then(function(_) {
                return post_bulk_p(false, small_docs(count));
            })
            .then(function(_) {
                return verify_doc_count_p(true, 0, SMDOCTYPE);
            })
            .then(function(_) {
                start = Date.now();
                return pull_repl_p();
            })
            .then(function(_) {
                duration = Date.now() - start;
console.log('saw insmall duration', duration); // TEMP
                return verify_doc_count_p(true, count, SMDOCTYPE);
            })
            .then(function(_) {
                return clean_repl_p(SMDOCTYPE);
            })
            .then(function(_) {
                return verify_doc_count_p(true, 0, SMDOCTYPE);
            })
            .then(
                function(_) {
                    return duration;
                },
                function(resp) {
console.log('error', JSON.stringify(resp));// TEMP
                    throw new Error(resp.statusText);
                }
            )
        },
        outlarge_p: function(count, blocksize) {
            // Return a promise to test push replication of large
            // documents. The promise resolves to the duration of the
            // replication.
            //
            return init_p()
            .then(function(_) {
                return bidir_repl_p(); // Create initial state
            })
            .then(function(_) {
                return post_bulk_p(true, large_docs(count, blocksize));
            })
            .then(function(_) {
                return verify_doc_count_p(false, 0, LGDOCTYPE);
            })
            .then(function(_) {
                start = Date.now();
                return push_repl_p();
            })
            .then(function(_) {
                duration = Date.now() - start;
console.log('saw outlarge duration', duration); // TEMP
                return verify_doc_count_p(false, count, LGDOCTYPE);
            })
            .then(function(_) {
                return clean_repl_p(LGDOCTYPE);
            })
            .then(function(_) {
                return verify_doc_count_p(false, 0, LGDOCTYPE);
            })
            .then(
                function(_) {
                    return duration;
                },
                function(resp) {
console.log('error', JSON.stringify(resp));// TEMP
                    throw new Error(resp.statusText);
                }
            )
        },

        inlarge_p: function(count, blocksize) {
            // Return a promise to test pull replication of large
            // documents. The promise resolves to the duration of the
            // replication.
            //
            var start, duration;

            return init_p()
            .then(function(_) {
                return bidir_repl_p();
            })
            .then(function(_) {
                return post_bulk_p(false, large_docs(count, blocksize));
            })
            .then(function(_) {
                return verify_doc_count_p(true, 0, LGDOCTYPE);
            })
            .then(function(_) {
                start = Date.now();
                return pull_repl_p();
            })
            .then(function(_) {
                duration = Date.now() - start;
console.log('saw inlarge duration', duration); // TEMP
                return verify_doc_count_p(true, count, LGDOCTYPE);
            })
            .then(function(_) {
                return clean_repl_p(LGDOCTYPE);
            })
            .then(function(_) {
                return verify_doc_count_p(true, 0, LGDOCTYPE);
            })
            .then(
                function(_) {
                    return duration;
                },
                function(resp) {
console.log('error', JSON.stringify(resp));// TEMP
                    throw new Error(resp.statusText);
                }
            )
        }
    };
})
