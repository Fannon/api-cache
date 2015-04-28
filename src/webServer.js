//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var express = require('express');
var prettysize = require('prettysize');
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

            var jobs = {};
            for (var requestName in exports.requestSettings) {

                var r = exports.requestSettings[requestName];

                var requestStatus = {};

                if (exports.settings.serveInfo) {
                    requestStatus.info = host + '_info/' + requestName;
                }

                requestStatus.valid = r.valid || false;
                requestStatus.available = r.available || false;

                if (r.statistics.lastUpdate) {
                    requestStatus.lastUpdate = r.statistics.lastUpdate;
                }

                if (r.statistics.lastErrorTimestamp) {
                    requestStatus.lastError = semlog.humanDate(new Date(r.statistics.lastErrorTimestamp));
                    requestStatus.errors = r.statistics.errors;
                }

                if (r.transformers && typeof r.transformers === 'object' && Object.keys(r.transformers).length > 0) {
                    requestStatus.transformers = Object.keys(r.transformers);
                }

                jobs[requestName] = requestStatus;
            }


            //////////////////////////////////////////
            // Available caches entry points        //
            //////////////////////////////////////////

            var entryPoints = {};
            for (var type in ds) {

                var typeObj = ds[type];

                for (var name in typeObj) {

                    if (!entryPoints[name]) {
                        entryPoints[name] = {};
                    }

                    entryPoints[name][type] = host + type + '/' + name;
                }
            }


            //////////////////////////////////////////
            // Debug entry points                   //
            //////////////////////////////////////////

            var debug = ['ok', 'settings', 'dataStore', 'requestSettings'];
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
                    rss: prettysize(memUsage.rss),
                    heapTotal: prettysize(memUsage.heapTotal),
                    heapUsed: prettysize(memUsage.heapUsed)
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
                jobs: jobs,
                entryPoints: entryPoints,
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
    // Get infos                            //
    //////////////////////////////////////////

    if (exports.settings.serveInfo) {
        ws.get('/_info/*', function(req, res) {
            var path = req.originalUrl;
            var name = path.replace('/_info/', '');

            if (exports.requestSettings[name]) {
                exports.sendJson(req, res, exports.requestSettings[name]);
            } else {
                exports.sendJsonError(req, res, 'Settings not found', {name: name});
            }

        });
    }


    //////////////////////////////////////////
    // Debugging output                     //
    //////////////////////////////////////////

    if (exports.settings.serveDebug) {
        ws.get('/_debug/ok', function(req, res) {
            var status = true;

            for (var requestName in exports.requestSettings) {
                var r = exports.requestSettings[requestName];
                if (r.valid === false || r.available === false) {
                    status = false;
                }
            }
            exports.sendJson(req, res, status, true);
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
    // Get full cache                       //
    //////////////////////////////////////////

    ws.get('/*/*', function(req, res) {

        var path = req.originalUrl;
        var pathArray = path.split('/');

        var type = pathArray[1];
        var name = pathArray[2]; // strip file extension

        // Write statistics
        if (exports.requestSettings[name] && exports.requestSettings[name].statistics) {
            exports.requestSettings[name].statistics.fetchedCounter += 1;
        }

        if (exports.dataStore[type] && exports.dataStore[type][name]) {
            exports.sendJson(req, res, exports.dataStore[type][name]);
        } else {
            exports.sendJsonError(req, res, 'API cache not found', {type: type, name: name});
        }

    });

};

/**
 * Sends the response as JSON
 */
exports.sendJson = function(req, res, json, pretty) {

    if (exports.settings.debug) {
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
