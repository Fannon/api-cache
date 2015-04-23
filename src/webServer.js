//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var express = require('express');

var util = require('./util');
var log = util.log;


//////////////////////////////////////////
// VARIABLES                            //
//////////////////////////////////////////


exports.init = function (settings, dataStore, requestSettings) {

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

        ws.get('/', function (req, res) {

            var host = 'http://' + req.get('host') + '/';

            // Get all available entry points
            var entryPoints = [];
            for (var type in ds) {
                var typeObj = ds[type];
                for (var name in typeObj) {
                    entryPoints.push(host + type + '/' + name);
                }
            }

            var caches = Object.keys(ds.raw);
            caches = caches.map(function(name){
                return host + '_info/' + name;
            });

            var debug = ['settings', 'dataStore', 'requestSettings'];
            debug = debug.map(function(name){
                return host + '_debug/' + name;
            });

            // Global statistics
            var globalStatistics = {
                startTime: exports.settings.startTime,
                errorCounter: 0,
                runCounter: 0,
                fetchedCounter: 0
            };

            for (var requestName in exports.requestSettings) {
                var requestStatistics = exports.requestSettings[requestName].statistics;
                globalStatistics.errorCounter += requestStatistics.errorCounter;
                globalStatistics.runCounter += requestStatistics.runCounter;
                globalStatistics.fetchedCounter += requestStatistics.fetchedCounter;
            }

            var json = {
                caches: caches,
                entryPoints: entryPoints,
                debug: debug,
                '@meta': {
                    generator: 'api-cache',
                    version: exports.settings.version,
                    globalStatistics: globalStatistics,
                    url: 'https://github.com/Fannon/api-cache'
                }
            };

            exports.sendJson(req, res, json, true);

        });
    }



    //////////////////////////////////////////
    // Get infos                            //
    //////////////////////////////////////////

    if (exports.settings.serveInfo) {
        ws.get('/_info/*', function (req, res) {
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
        ws.get('/_debug/settings', function (req, res) {
            exports.sendJson(req, res, exports.settings, true);
        });

        ws.get('/_debug/dataStore', function (req, res) {
            exports.sendJson(req, res, ds, true);
        });

        ws.get('/_debug/requestSettings', function (req, res) {
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
