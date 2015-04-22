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

var fs = require('fs');
var path = require('path');

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
var rawData = {};
var processedData = {};

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

            rawData[name]       = data;
            processedData[name] = transform.simplifyAskJson(data);
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

//webserver.get('/', function (req, res) {
//    res.send('Hello World')
//});

webserver.get('/rawData.json', function (req, res) {
    res.json(rawData);
});

webserver.get('/processedData.json', function (req, res) {
    res.json(processedData);
});

webserver.listen(1337);



//////////////////////////////////////////
// HELPER FUNCTIONS                     //
//////////////////////////////////////////

/**
 * Returns an array with date / time information
 * Starts with year at index 0 up to index 6 for milliseconds
 *
 * @param {Date=} date   Optional date object. If falsy, will take current time.
 * @returns {[]}
 */
exports.getDateArray = function(date) {
    date = date || new Date();
    return [
        date.getFullYear(),
        exports.pad(date.getMonth() + 1, 2),
        exports.pad(date.getDate(), 2),
        exports.pad(date.getHours(), 2),
        exports.pad(date.getMinutes(), 2),
        exports.pad(date.getSeconds(), 2),
        exports.pad(date.getMilliseconds(), 2)
    ];
};

/**
 * Returns nicely formatted date-time
 * @example 2015-02-10 16:01:12
 *
 * @param {object} date
 * @returns {string}
 */
exports.humanDate = function(date) {
    date = date || new Date();
    var d = exports.getDateArray(date);
    return d[0] + '-' + d[1] + '-' + d[2] + ' ' + d[3] + ':' + d[4] + ':' + d[5];
};
