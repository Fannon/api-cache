//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var express = require('express');
var semlog = require('semlog');
var log = semlog.log;


//////////////////////////////////////////
// VARIABLES                            //
//////////////////////////////////////////

/**
 * Bootstraps the Webserver. Uses the Express Library
 *
 * @param settings
 * @param dataStore
 * @param requestSettings
 */
exports.init = function(settings, dataStore, requestSettings) {

    exports.settings = settings;
    exports.dataStore = dataStore;
    exports.requestSettings = requestSettings;

    // Create new Webserver
    exports.webserver = express();

    // Register Routes
    exports.registerRoutes();

    // Listen
    exports.webserver.listen(settings.port);
    log('[i] Serving API caches at localhost:' + settings.port);

};


exports.registerRoutes = function() {

    var ws = exports.webserver;
    var ds = exports.dataStore;


    //////////////////////////////////////////
    // Main Entry Point                     //
    //////////////////////////////////////////

    if (exports.settings.serveMain) {

        ws.get('/', function(req, res) {

            var host = 'http://' + req.get('host') + '/';


            //////////////////////////////////////////
            // All Caches Overview                  //
            //////////////////////////////////////////

            var caches = {};
            for (var requestName in exports.requestSettings) {
                caches[requestName] = exports.getCacheInfo(requestName, host);
            }


            //////////////////////////////////////////
            // Debug entry points                   //
            //////////////////////////////////////////

            var debug = ['status', 'settings', 'dataStore', 'requestSettings'];
            debug = debug.map(function(name) {
                return host + '_debug/' + name;
            });


            //////////////////////////////////////////
            // Global (Meta) Statistics             //
            //////////////////////////////////////////

            var memUsage = process.memoryUsage();

            var globalStatistics = {
                startTime: exports.settings.startTime,
                errorCounter: 0,
                runCounter: 0,
                fetchedCounter: 0,
                memory: {
                    rss: semlog.prettyBytes(memUsage.rss),
                    heapTotal: semlog.prettyBytes(memUsage.heapTotal),
                    heapUsed: semlog.prettyBytes(memUsage.heapUsed)
                }
            };

            for (requestName in exports.requestSettings) {
                var requestStatistics = exports.requestSettings[requestName].statistics;
                globalStatistics.errorCounter += requestStatistics.errorCounter;
                globalStatistics.runCounter += requestStatistics.runCounter;
                globalStatistics.fetchedCounter += requestStatistics.fetchedCounter;
                globalStatistics.fetchedCounter += requestStatistics.fetchedCounter;
            }


            //////////////////////////////////////////
            // Serve main entry point               //
            //////////////////////////////////////////

            var json = {
                caches: caches,
                debug: debug,
                '@meta': {
                    generator: 'cacheur',
                    version: exports.settings.version,
                    url: 'https://github.com/Fannon/cacheur',
                    globalStatistics: globalStatistics
                }
            };

            exports.sendJson(req, res, json, true);

        });
    }

    //////////////////////////////////////////
    // Debugging output                     //
    //////////////////////////////////////////

    if (exports.settings.serveDebug) {
        ws.get('/_debug/status', function(req, res) {
            var statusObj = {
                ok: true,
                caches: {}
            };

            for (var requestName in exports.requestSettings) {
                var r = exports.requestSettings[requestName];

                var jobStatus = {
                    ok: true,
                    lastUpdateUnixTime: Math.round(r.statistics.lastUpdateTimestamp / 1000),
                    lastChangeUnixTime: Math.round(r.statistics.lastChangeTimestamp / 1000)
                };
                if (r.valid === false || r.available === false) {
                    statusObj.ok = false;
                    jobStatus.ok = false;
                }
                statusObj.caches[requestName] = jobStatus;
            }
            exports.sendJson(req, res, statusObj, true);
        });

        ws.get('/_debug/settings', function(req, res) {
            exports.sendJson(req, res, exports.settings, true);
        });

        ws.get('/_debug/dataStore', function(req, res) {
            exports.sendJson(req, res, ds, true);
        });

        ws.get('/_debug/requestSettings', function(req, res) {
            exports.sendJson(req, res, exports.requestSettings, true);
        });
    }

    //////////////////////////////////////////
    // Get cache entry point                //
    //////////////////////////////////////////

    ws.get('/:id', function(req, res) {
        var id = req.params.id;
        var host = 'http://' + req.get('host') + '/';
        if (exports.requestSettings[id]) {
            exports.sendJson(req, res, exports.getCacheInfo(id, host));
        } else {
            exports.sendJsonError(req, res, 'Cache not found', {id: id});
        }
    });


    //////////////////////////////////////////
    // Get infos                            //
    //////////////////////////////////////////

    if (exports.settings.serveDetail) {
        ws.get('/:id/_detail', function(req, res) {
            var id = req.params.id;
            if (exports.requestSettings[id]) {
                exports.sendJson(req, res, exports.requestSettings[id]);
            } else {
                exports.sendJsonError(req, res, 'Cache not found', {id: id});
            }
        });
    }


    //////////////////////////////////////////
    // Get full cache                       //
    //////////////////////////////////////////

    ws.get('/:id/:format', function(req, res) {

        var id = req.params.id;
        var format = req.params.format;

        // Write statistics
        if (exports.requestSettings[id] && exports.requestSettings[id].statistics) {
            exports.requestSettings[id].statistics.fetchedCounter += 1;
        }

        if (exports.dataStore[id] && exports.dataStore[id][format]) {
            exports.sendJson(req, res, exports.dataStore[id][format]);
        } else {
            exports.sendJsonError(req, res, 'Cache not found', {id: id, format: format});
        }

    });

};

exports.getCacheInfo = function(id, host) {

    var ds = exports.dataStore;
    var r = exports.requestSettings[id];


    //////////////////////////////////////////
    // Request Status Overview              //
    //////////////////////////////////////////

    var cacheInfo = {
        entryPoints: {},
        info: host + id,
        detail: host + id + '/_detail',
        valid: r.valid || false,
        available: r.available || false
    };

    if (!exports.settings.serveDetail) {
        delete cacheInfo.detail;
    }
    if (r.statistics.lastUpdate) {
        cacheInfo.lastUpdate = r.statistics.lastUpdate;
    }
    if (r.statistics.lastChange) {
        cacheInfo.lastChange = r.statistics.lastChange;
    }
    if (r.statistics.lastErrorTimestamp) {
        cacheInfo.lastError = semlog.humanDate(new Date(r.statistics.lastErrorTimestamp));
        cacheInfo.errors = r.statistics.errors;
    }
    if (r.transformers && typeof r.transformers === 'object' && Object.keys(r.transformers).length > 0) {
        cacheInfo.transformers = Object.keys(r.transformers);
    }


    //////////////////////////////////////////
    // Available caches entry points        //
    //////////////////////////////////////////

    for (var format in ds[id]) {

        // If a webserver is used, link to it
        if (r.webserver) {
            var url = r.webserver.url + '/' || 'http://localhost/';
            cacheInfo.entryPoints[format] = url + id + '/' + format + '.json';
        } else {
            cacheInfo.entryPoints[format] = host + id + '/' + format;
        }
    }

    return cacheInfo;
};

/**
 * Sends the response as JSON
 */
exports.sendJson = function(req, res, json, pretty) {

    if (exports.settings.verbose) {
        log('[i] Served JSON: ' + req.originalUrl + '');
    }

    res.set('Content-Type', 'application/json; charset=utf-8');

    if (pretty || exports.settings.prettyJson) {
        json = JSON.stringify(json, false, 4);
        res.send(json);
    } else {
        res.json(json);
    }

};

/**
 * Sends an error object as JSON response
 *
 * @param req
 * @param res
 * @param msg
 * @param params
 */
exports.sendJsonError = function(req, res, msg, params) {

    var error = {
        error: {
            message: msg,
            path: req.originalUrl,
            params: params
        }
    };

    log('[W] Invalid request: ' + req.originalUrl + ': ' + msg);

    if (exports.settings.debug) {
        log(error);
    }

    exports.sendJson(req, res, error, true); // Always send "pretty" errors

};
