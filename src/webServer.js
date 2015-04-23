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

    ws.get('/', function (req, res) {

        var host = 'http://' + req.get('host') + '/';

        // Get all available entry points
        var entryPoints = [];
        for (var type in ds) {
            var typeObj = ds[type];
            for (var name in typeObj) {
                entryPoints.push(host + type + '/' + name + '.json');
            }
        }

        var caches = Object.keys(ds.raw);
        caches = caches.map(function(name){
            return host + '_info/' + name;
        });

        var debug = ['settings.json', 'dataStore.json', 'requestSettings.json'];
            debug = debug.map(function(name){
            return host + name;
        });

        var json = {
            caches: caches,
            entryPoints: entryPoints,
            debug: debug
        };

        exports.sendJson(req, res, json, true);

    });


    //////////////////////////////////////////
    // Get infos                            //
    //////////////////////////////////////////

    ws.get('/_info/*', function (req, res) {
        var path = req.originalUrl;
        var name = path.replace('/_info/', '');

        if (exports.requestSettings[name]) {
            exports.sendJson(req, res, exports.requestSettings[name]);
        } else {
            exports.sendJsonError(req, res, 'Settings not found', {name: name});
        }

    });


    //////////////////////////////////////////
    // Get full cache                       //
    //////////////////////////////////////////

    ws.get('/*/*.json', function(req, res) {

        var path = req.originalUrl;
        var pathArray = path.split('/');

        var type = pathArray[1];
        var name = pathArray[2].substr(0, pathArray[2].lastIndexOf('.')) || pathArray[2]; // strip file extension

        if (exports.dataStore[type] && exports.dataStore[type][name]) {
            exports.sendJson(req, res, exports.dataStore[type][name]);
        } else {
            exports.sendJsonError(req, res, 'API cache not found', {type: type, name: name});
        }

    });


    //////////////////////////////////////////
    // Debugging output                     //
    //////////////////////////////////////////

    ws.get('/settings.json', function (req, res) {
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(exports.settings, false, 4));
    });

    ws.get('/dataStore.json', function (req, res) {
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(ds, false, 4));
    });

    ws.get('/requestSettings.json', function (req, res) {
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(exports.requestSettings, false, 4));
    });

};

/**
 * Sends the response as JSON
 */
exports.sendJson = function(req, res, json, pretty) {

    log('[i] [' + util.humanDate(new Date()) + '] Served: ' + req.originalUrl);

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
            msg: msg,
            path: req.originalUrl,
            params: params
        }
    };

    log('[W] Invalid request: ' + error.msg);

    if (exports.settings.debug) {
        log(error);
    }

    exports.sendJson(req, res, error, true); // Always send "pretty" errors

};
