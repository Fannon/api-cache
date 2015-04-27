#!/usr/bin/env node
'use strict';

/**
 * Cacheuer
 * A modular HTTP / API result cacher and transformer that runs as a CLI application
 *
 * @author Simon Heimler <heimlersimon@gmail.com>
 *
 * SHORT-TERM:
 * TODO: Move default settings to /src/defaultSettings.yaml and annotate them
 * TODO: Write tests, more examples and test / mock various error conditions
 * TODO: Test and watch memory usage
 * TODO: Refactor loggin to own NPM module (semlog)
 * TODO: GlobalLogObject will become a memory leak
 * TODO: Make code testable, move application code (and main namespace?) from cli.js to /src/main.js
 * TODO: settings.writeBenchmark to write/append time, timestamp, measured_time and received_chars to <jobname>.csv
 * TODO: settings.writeLog to write job specific errors and actions to <jobname>.log
 *
 * LONG-TERM:
 * TODO: Scriptable / programmatic transformers (_transformer.js)
 * TODO: Add a true caching database, cacheur does only the job managing in this mode.
 */

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

/** Object containing all running intervals */
exports.intervals = {};

/** Default Settings */
exports.settings = {

    // INTERNAL PARAMETERS

    /** Current Working Directory */
    cwd: process.cwd(),

    /** Current cacheur version */
    version: packageJson.version,

    /** Time apich started */
    startTime: util.humanDate((new Date())),

    /** ID of the request, including file extension */
    id: undefined,

    /** Job is valid and will be executed */
    valid: true,

    /** statistics about the request */
    statistics: {
        lastUpdate: undefined,
        lastUpdateTimestamp: undefined,
        lastErrorTimestamp: undefined,
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

    /** If a request failes, the retry delay defines how long to wait until cacheur tries again. (in seconds) */
    retryDelay: 10,

    /** Time after Cache expires and is fetched anew (in seconds) */
    cacheExpiration: 3 * 60,

    /** Object of transformers to apply on the data. Key is the transformer name, value is an optional object of options */
    transformers: {},

    /** Store the raw fetched data as it is */
    raw: true,

    /** More verbose logging */
    debug: false,

    /** Outputs pretty printed JSON, formatted with whitespaces and indentations */
    prettyJson: false,

    /** Benchmark Array Size (number of the last time measures kept) */
    benchmarkArraySize: 16,

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
    exports.settings.cwd = path.normalize(argv.dir);
}

// Enable debugging
if (argv.debug) {
    exports.settings.debug = true;
}

//////////////////////////////////////////
// Read project directory               //
//////////////////////////////////////////

// Read files from (current) project directory
var projectFiles = readProject.read(exports.settings.cwd);

if (projectFiles) {

    // Apply settings inheritance

    requestSettings = projectFiles.requestSettings;

    // Merge global settings into default settings
    _.merge(exports.settings, projectFiles.masterSettings);

    if (exports.settings.debug) {
        log('[i] Project folder: ' + exports.settings.cwd);
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
    var specificSettings = _.cloneDeep(exports.settings);
    specificSettings = _.merge(specificSettings, givenSettings);

    // Save the extended request settings back to the global requestSettings object
    requestSettings[specificSettings.id] = specificSettings;

    // Run the query for the first time
    fetch.request(specificSettings, dataStore); // Runs async

    if (specificSettings.cacheExpiration) {

        // Run the query in the interval that is specified in the cacheExpiration setting
        // Inject the specificSettings as requestSettings to avoid mutation problems
        exports.intervals[specificSettings.id] = setInterval(function(requestSettings, interval) {

            if (requestSettings.valid === false) {
                log('Stopping interval!');
                clearInterval(interval);
                requestSettings.retryDelay = false;
            }

            fetch.request(requestSettings, dataStore);

        }, specificSettings.cacheExpiration * 1000, specificSettings, exports.intervals[requestSettings.id]);

    } else {
        log('[i] No interval given for ' + requestName);
    }

}

// List all jobs that have been found
for (var jobName in requestSettings) {
    var jobSettings = requestSettings[jobName];
    log('[i] Added Job "' + jobSettings.id + '" with interval of ' + jobSettings.cacheExpiration + 's');
    if (jobSettings.debug) {
        log(jobSettings);
    }
}

// Start Webserver and give a reference to the data store object
webServer.init(exports.settings, dataStore, requestSettings);
