//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var express = require('express');
var semlog = require('semlog');
var log = semlog.log;


//////////////////////////////////////////
// VARIABLES                            //
//////////////////////////////////////////


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
            // Request Status Overview              //
            //////////////////////////////////////////

            var caches = {};
            for (var requestName in exports.requestSettings) {

                var r = exports.requestSettings[requestName];

                var requestStatus = {};

                if (exports.settings.serveInfo) {
                    requestStatus.info = host + requestName + '/_info';
                }

                requestStatus.valid = r.valid || false;
                requestStatus.available = r.available || false;

                if (r.statistics.lastUpdate) {
                    requestStatus.lastUpdate = r.statistics.lastUpdate;
                }
                if (r.statistics.lastChange) {
                    requestStatus.lastChange = r.statistics.lastChange;
                }

                if (r.statistics.lastErrorTimestamp) {
                    requestStatus.lastError = semlog.humanDate(new Date(r.statistics.lastErrorTimestamp));
                    requestStatus.errors = r.statistics.errors;
                }

                if (r.transformers && typeof r.transformers === 'object' && Object.keys(r.transformers).length > 0) {
                    requestStatus.transformers = Object.keys(r.transformers);
                }

                caches[requestName] = requestStatus;
            }


            //////////////////////////////////////////
            // Available caches entry points        //
            //////////////////////////////////////////

            for (var type in ds) {

                var typeObj = ds[type];

                for (var name in typeObj) {

                    if (caches[name]) {

                        if (!caches[name].entryPoints) {
                            caches[name].entryPoints = {};
                        }

                        // If a webserver is used, link to it
                        if (exports.requestSettings[name].webserver) {
                            var url = exports.requestSettings[name].webserver.url + '/' || 'http://localhost/';
                            caches[name].entryPoints[type] = url + name + '/' + type + '.json';

                        } else {
                            caches[name].entryPoints[type] = host + name + '/' + type;
                        }


                    }
                }
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
                    globalStatistics: globalStatistics,
                    url: 'https://github.com/Fannon/cacheur'
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
        log('GET CACHE ENTRY POINT)');
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

    if (exports.settings.serveInfo) {
        ws.get('/:id/_info', function(req, res) {
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

        if (exports.dataStore[format] && exports.dataStore[format][id]) {
            exports.sendJson(req, res, exports.dataStore[format][id]);
        } else {
            exports.sendJsonError(req, res, 'API cache not found', {id: id, format: format});
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
        valid: r.valid || false,
        avalable: r.available || false
    };

    if (exports.settings.serveInfo) {
        cacheInfo.info = host + id + '/_info';
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

    var typeObj = ds[id];

    log(ds);

    for (var type in typeObj) {

        log(id);
        log(type);

        // If a webserver is used, link to it
        if (r.webserver) {
            var url = r.webserver.url + '/' || 'http://localhost/';
            cacheInfo.entryPoints[type] = url + id + '/' + type + '.json';
        } else {
            cacheInfo.entryPoints[type] = host + id + '/' + type;
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
