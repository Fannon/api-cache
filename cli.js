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

for (var queryName in queries) {

    var query = queries[queryName];
    var specificSettings = _.cloneDeep(settings);

    if (querySettings[queryName]) {
        specificSettings = _.merge(specificSettings, querySettings[queryName]);
    }

    setInterval(function() {

        askQuery.exec(query, specificSettings, function(err, data, name, time) {
            if (err) {
                console.log();
                console.error('Error while querying!');
                console.error(err);
            } else {
                console.log('Successfully queried "' + name + '" in ' + time + 'ms (Interval: ' + specificSettings.cacheExpiration + 's).');

                rawData[name]       = data;
                processedData[name] = transform.simplifyAskJson(data);
            }

        });

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
