#!/usr/bin/env node
'use strict';

// Access:
// http://localhost:1337/raw/<requestName>.json                       -> Original ASK result
// http://localhost:1337/raw/<requestName>/<pageName>.json            -> Original ASK result
// http://localhost:1337/processed/<requestName>.json                 -> Simplified ASK result
// http://localhost:1337/processed/<requestName>/<pageName>.json      -> Simplified ASK result

//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var _ = require('lodash');
var express = require('express');

var readProject = require('./src/readProject');
var fetch = require('./src/fetch');

var util = require('./src/util');
var log = util.log;


//////////////////////////////////////////
// VARIABLES                            //
//////////////////////////////////////////

/** Default Settings */
var settings = {

    // INTERNAL PARAMETERS

    /** Current Working Directory */
    cwd: process.cwd(),

    /** Time apich started */
    startTime: (new Date()).getTime(),

    /** ID of the request, including file extension */
    id: undefined,

    /** Name of the request, excluding file extension */
    name: undefined,

    /** Request Query / URL */
    request: undefined,


    // ADJUSTABLE PARAMETERS

    /** More verbose logging */
    debug: true,

    /** Port apich serves the API caches */
    port: 1337,

    /** MediaWiki API URL (e.g. http://en.wikipedia.org/w/api.php), used for ASK queries */
    mwApiUrl: undefined,

    /** Timeout for API Request (in seconds) */
    timeout: 3,

    /** Time after Cache expires and is fetched anew (in seconds) */
    cacheExpiration: 5 * 60
};

var requests = {};
var requestSettings = {};
var statistics = {};

// Global dataStore object
var dataStore = {
    raw: {}
};


//////////////////////////////////////////
// Read project directory               //
//////////////////////////////////////////

// Read files from (current) project directory
var projectFiles = readProject.read(settings.cwd);

if (projectFiles) {
    requests = projectFiles.requests;
    requestSettings = projectFiles.requestSettings;

    // Merge global settings into default settings
    _.merge(settings, projectFiles.masterSettings);

} else {
    log(' [E]Could not read project directory. Aborting.');
    process.exit();
}


//////////////////////////////////////////
// Processing requests                  //
//////////////////////////////////////////

for (var requestName in requests) {

    var request = requests[requestName];

    // Calculate project specific settings
    var specificSettings = _.cloneDeep(settings);
    specificSettings.id = requestName;
    specificSettings.name = requestName.substr(0, requestName.lastIndexOf('.')) || requestName;
    specificSettings.request = request;


    // If the request has specific settings (.json with the same name): inherit them.
    if (requestSettings[requestName]) {
        specificSettings = _.merge(specificSettings, requestSettings[requestName]);
    }


    // Run the query for the first time
    fetch.request(specificSettings, dataStore); // Runs async

    // Run the query in the interval that is specified in the cacheExpiration setting
    //setInterval(function() {
    //    runQuery(request, specificSettings, requestName);
    //}, specificSettings.cacheExpiration * 1000);

}




//console.log();
//console.log();
//console.log(JSON.stringify(settings, false, 4));
//console.log();
//console.log(JSON.stringify(requests, false, 4));
//console.log();
//console.log(JSON.stringify(requestSettings, false, 4));
//console.log();



////////////////////////////////////////////
//// Web Server                           //
////////////////////////////////////////////

var webserver = express();

var serveData = function(req, res, type) {

    var path = req.originalUrl;

    var name = path.replace('/' + type + '/', '');
    name = name.replace('.json', '');

    res.set('Content-Type', 'application/json; charset=utf-8');

    if (dataStore[type] && dataStore[type][name]) {
        res.json(dataStore[type][name]);
        var date = util.humanDate(new Date());
        log(' [i] [' + date + '] Served: ' + path);
    } else {

        res.json({
            error: 'Cached Query of name ' + name + ' not found.'
        });
    }
};

/**
 * TODO: Serve single entry
 *
 * @param req
 * @param res
 * @param type
 */
var serveDataEntry = function(req, res, type) {
    var path = req.originalUrl;

    var name = path.replace('/' + type + '/', '');
    name = name.replace('.json', '');

    res.set('Content-Type', 'application/json; charset=utf-8');

    res.json(name);
};


// RAW DATA
webserver.get('/raw/*.json', function(req, res) {
    serveData(req, res, 'raw');
});


webserver.get('/processed/*.json', function(req, res) {
    serveData(req, res, 'processed');
});

// TODO:
//webserver.get('/processed-entry/*.json', function(req, res) {
//    serveDataEntry(req, res, 'processed');
//});



// DEBUGGING OUTPUT
webserver.get('/all-raw.json', function (req, res) {
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(dataStore.raw, false, 4));
});

webserver.get('/all-processed.json', function (req, res) {
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(dataStore.processed, false, 4));
});


// MAIN ENTRY POINT
webserver.get('/', function (req, res) {

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

webserver.listen(settings.port);
log(' [i] Serving API caches at localhost:' + settings.port);
