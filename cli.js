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
var argv = require('minimist')(process.argv.slice(2));

var readProject = require('./src/readProject');
var fetch = require('./src/fetch');
var webServer = require('./src/webServer');

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
    startTime: util.humanDate((new Date())),

    /** ID of the request, including file extension */
    id: undefined,

    /** Name of the request, excluding file extension */
    name: undefined,

    /** Request Query / URL */
    request: undefined,

    /** statistics about the request */
    statistics: {
        lastUpdate: undefined,
        benchmark: [],
        runCounter: 0,
        fetchedCounter: 0,
        errorCounter: 0,
        errors: {}
    },


    // ADJUSTABLE PARAMETERS

    /** More verbose logging */
    debug: false,

    /** Outputs pretty printed JSON, formatted with whitespaces and indentations */
    prettyJson: false,

    /** Benchmark Array Size (number of the last time measures kept) */
    benchmarkArraySize: 10,

    /** Port apich serves the API caches */
    port: 1337,

    /** MediaWiki API URL (e.g. http://en.wikipedia.org/w/api.php), used for ASK queries */
    mwApiUrl: undefined,

    /** Timeout for API Request (in seconds) */
    timeout: 3,

    /** Time after Cache expires and is fetched anew (in seconds) */
    cacheExpiration: 5 * 60,

    /** Array of transformers to apply on the data */
    transformers: []
};

var requests = {};
var requestSettings = {};

// Global dataStore object
var dataStore = {
    raw: {}
};

//////////////////////////////////////////
// CLI COMMANDS                         //
//////////////////////////////////////////

// Allows to specify the workign directory manually
// If not given, the current directory is used by default
log(argv);
if (argv.d || argv.dir) {
    settings.cwd = argv.d || argv.dir;
}


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

// Iterate over all requests, calculate their settings and run them in the defined intervals
for (var requestName in requests) {

    var request = requests[requestName];

    // Calculate project specific settings
    var specificSettings = _.cloneDeep(settings);
    specificSettings.id = requestName;
    specificSettings.name = requestName.substr(0, requestName.lastIndexOf('.')) || requestName;
    specificSettings.request = request;

    // If the request has specific settings (.json with the same name): inherit them.
    if (requestSettings[specificSettings.name]) {
        specificSettings = _.merge(specificSettings, requestSettings[specificSettings.name]);
    }

    // Save the extended request settings back to the global requestSettings object
    requestSettings[specificSettings.name] = specificSettings;

    // Run the query for the first time
    fetch.request(specificSettings, dataStore); // Runs async

    if (specificSettings.cacheExpiration) {

        // Run the query in the interval that is specified in the cacheExpiration setting
        setInterval(function() {
            fetch.request(specificSettings, dataStore);
        }, specificSettings.cacheExpiration * 1000);
    }

}

// Start Webserver and give a reference to the data store object
webServer.init(settings, dataStore, requestSettings);
