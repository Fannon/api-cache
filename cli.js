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
var path = require('path');
var argv = require('minimist')(process.argv.slice(2));

var readProject = require('./src/readProject');
var fetch = require('./src/fetch');
var webServer = require('./src/webServer');
var packageJson  = require('./package.json');

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

    /** Current api-cache version */
    version: packageJson.version,

    /** Time apich started */
    startTime: util.humanDate((new Date())),

    /** ID of the request, including file extension */
    id: undefined,

    /** Name of the request, excluding file extension */
    name: undefined,

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

    /** Port apich serves the API caches */
    port: 1337,

    /** MediaWiki API URL (e.g. http://en.wikipedia.org/w/api.php), used for ASK queries */
    mwApiUrl: undefined,

    /** Timeout for API Request (in seconds) */
    timeout: 60,

    /** If a request failes, the retry delay defines how long to wait until api-cache tries again. (in seconds) */
    retryDelay: 10,

    /** Time after Cache expires and is fetched anew (in seconds) */
    cacheExpiration: 5 * 60,

    /** Array of transformers to apply on the data */
    transformers: [],

    /** More verbose logging */
    debug: false,

    /** Outputs pretty printed JSON, formatted with whitespaces and indentations */
    prettyJson: false,

    /** Benchmark Array Size (number of the last time measures kept) */
    benchmarkArraySize: 10,

    /** Serve '/_debug/*' routes */
    serveDebug: true,

    /** Serve '/_info/*' routes */
    serveInfo: true,

    /** Serve main '/' route */
    serveMain: true
};

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
if (argv.dir) {
    settings.cwd = path.normalize(argv.dir);
}

// Enable debugging
if (argv.debug) {
    settings.debug = true;
}

//////////////////////////////////////////
// Read project directory               //
//////////////////////////////////////////

// Read files from (current) project directory
var projectFiles = readProject.read(settings.cwd);

if (projectFiles) {

    // Apply settings inheritance

    requestSettings = projectFiles.requestSettings;

    // Merge global settings into default settings
    _.merge(settings, projectFiles.masterSettings);

    if (settings.debug) {
        log('[i] Project folder: ' + settings.cwd);
        log(projectFiles.fileList);
    }


} else {
    log('[E] Could not read project directory. Aborting.');
    process.exit();
}


//////////////////////////////////////////
// Processing requests                  //
//////////////////////////////////////////

// Iterate over all requests, calculate their settings and run them in the defined intervals
for (var requestName in requestSettings) {

    var givenSettings = requestSettings[requestName];

    // Inherit project specific settings
    var specificSettings = _.cloneDeep(settings);
    specificSettings = _.merge(specificSettings, givenSettings);

    // Save the extended request settings back to the global requestSettings object
    requestSettings[specificSettings.id] = specificSettings;

    // Run the query for the first time
    fetch.request(specificSettings, dataStore); // Runs async

    if (specificSettings.cacheExpiration) {

        // Run the query in the interval that is specified in the cacheExpiration setting
        // Inject the specificSettings as requestSettings to avoid mutation problems
        setInterval(function(requestSettings) {
            fetch.request(requestSettings, dataStore);
        }, specificSettings.cacheExpiration * 1000, specificSettings);
    } else {
        log('[i] No interval given for ' + requestName);
    }

}

// List all jobs that have been found
for (var jobName in requestSettings) {
    var jobSettings = requestSettings[jobName];
    log('[i] Added Job "' + jobSettings.id + '"');
    if (jobSettings.debug) {
        log(jobSettings);
    }
}

// Start Webserver and give a reference to the data store object
webServer.init(settings, dataStore, requestSettings);
