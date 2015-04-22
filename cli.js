#!/usr/bin/env node
'use strict';

// Access:
// http://localhost:1337/raw/<queryname>.json                       -> Original ASK result
// http://localhost:1337/raw/<queryname>/<pageName>.json            -> Original ASK result
// http://localhost:1337/processed/<queryname>.json                 -> Simplified ASK result
// http://localhost:1337/processed/<queryname>/<pageName>.json      -> Simplified ASK result

//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var _ = require('lodash');
var express = require('express');

var readProject = require('./src/readProject');
var askQuery = require('./src/askQuery');
var transform = require('./src/transform');

var util = require('./src/util');
var log = util.log;

//////////////////////////////////////////
// VARIABLES                            //
//////////////////////////////////////////

/** Default Settings */
var settings = {
    cwd: process.cwd(),
    startTime: (new Date()).getTime(),
    cacheExpiration: 5 * 60
};

var queries = {};
var querySettings = {};

// Global dataStore object
var dataStore = {
    raw: {},
    processed: {}
};

// Set global log object
global.moboLogObject = [];



//////////////////////////////////////////
// Read project directory               //
//////////////////////////////////////////

// Read files from (current) project directory
var projectFiles = readProject.read(settings.cwd);

if (projectFiles) {
    queries = projectFiles.queries;
    querySettings = projectFiles.querySettings;
    _.merge(settings, projectFiles.masterSettings);

} else {
    console.log();
    console.error('Could not read project directory. Aborting.');
    process.exit();
}

if (!settings.apiUrl) {
    console.log();
    console.error('No valid settings found! Aborting.');
    process.exit();
}

//////////////////////////////////////////
// Fetching Query Results               //
//////////////////////////////////////////

var runQuery = function(query, specificSettings) {
    askQuery.exec(query, specificSettings, function(err, data, name, time) {
        if (err) {

            log(' [E] Error while querying!');
            log(err);

        } else {
            var dataSize = JSON.stringify(data).length;
            var date = util.humanDate(new Date());
            log(' [S] [' + date + '] Queried "' + name + '" | time: ' + time + 'ms | interval: ' +
                specificSettings.cacheExpiration + 's | size: ' + dataSize + ' Chars');

            dataStore.raw[name]       = data;
            dataStore.processed[name] = transform.simplifyAskJson(data);
        }

    });
};

for (var queryName in queries) {

    var query = queries[queryName];
    var specificSettings = _.cloneDeep(settings);

    if (querySettings[queryName]) {
        specificSettings = _.merge(specificSettings, querySettings[queryName]);
    }

    // Run the query for the first time
    runQuery(query, specificSettings);

    // Run the query in the interval that is specified in the cacheExpiration setting
    setInterval(function() {
        runQuery(query, specificSettings);
    }, specificSettings.cacheExpiration * 1000);

}




//console.log();
//console.log();
//console.log(JSON.stringify(settings, false, 4));
//console.log();
//console.log(JSON.stringify(queries, false, 4));
//console.log();
//console.log(JSON.stringify(querySettings, false, 4));
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
webserver.get('/raw.json', function (req, res) {
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(dataStore.raw, false, 4));
});

webserver.get('/processed.json', function (req, res) {
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(dataStore.processed, false, 4));
});


// MAIN ENTRY POINT
webserver.get('/', function (req, res) {

    var entryPoints = [];

    for (var name in dataStore.processed) {
        entryPoints.push('/raw/' + name + '.json');
        entryPoints.push('/processed/' + name + '.json');
    }

    var jsonRespone = {
        availableCaches: Object.keys(dataStore.processed),
        entryPoints: entryPoints,
        debugEntryPoints: [
            '/raw.json',
            '/processed.json'
        ]
    };

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(jsonRespone, false, 4));
});

webserver.listen(1337);

