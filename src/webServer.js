//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var express = require('express');

var util = require('./util');
var log = util.log;


//////////////////////////////////////////
// VARIABLES                            //
//////////////////////////////////////////


exports.init = function (settings, dataStore) {

    exports.settings = settings;
    exports.dataStore = dataStore;

    // Create new Webserver
    exports.webserver = express();

    // Register Routes
    exports.registerRoutes();

    // Listen
    exports.webserver.listen(settings.port);
    log(' [i] Serving API caches at localhost:' + settings.port);

};

exports.registerRoutes = function() {

    var ws = exports.webserver;

    // RAW DATA
    ws.get('/raw/*.json', function(req, res) {
        exports.serveData(req, res, 'raw');
    });

    //
    //ws.get('/processed/*.json', function(req, res) {
    //    exports.serveData(req, res, 'processed');
    //});

    // TODO:
    //webserver.get('/processed-entry/*.json', function(req, res) {
    //    serveDataEntry(req, res, 'processed');
    //});

    // INFO ROUTE
    ws.get('/info/*', function (req, res) {
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(dataStore.processed, false, 4));
    });



    // DEBUGGING OUTPUT
    ws.get('/all-raw.json', function (req, res) {
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(dataStore.raw, false, 4));
    });

    ws.get('/all-processed.json', function (req, res) {
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(dataStore.processed, false, 4));
    });


    // MAIN ENTRY POINT
    ws.get('/', function (req, res) {

        var entryPoints = [];

        for (var name in dataStore.raw) {
            entryPoints.push('/raw/' + name + '.json');
        }

        var jsonRespone = {
            availableCaches: Object.keys(dataStore.raw),
            entryPoints: entryPoints,
            debugEntryPoints: [
                '/all-raw.json',
                '/all-processed.json'
            ]
        };

        res.set('Content-Type', 'application/json; charset=utf-8');
        res.send(JSON.stringify(jsonRespone, false, 4));
    });

};


exports.serveData = function(req, res, type) {

    var path = req.originalUrl;

    var name = path.replace('/' + type + '/', '');
    name = name.replace('.json', '');

    res.set('Content-Type', 'application/json; charset=utf-8');

    if (exports.dataStore[type] && exports.dataStore[type][name]) {
        res.json(exports.dataStore[type][name]);
        var date = util.humanDate(new Date());
        log(' [i] [' + date + '] Served: ' + path);
    } else {

        res.json({
            error: 'Cached Query of name ' + name + ' not found.'
        });
    }
};
