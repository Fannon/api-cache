#!/usr/bin/env node
'use strict';

/**
 * Cacheuer
 * A modular HTTP / API result cacher and transformer that runs as a CLI application
 *
 * @author Simon Heimler <heimlersimon@gmail.com>
 *
 * SHORT-TERM:
 * TODO: Write tests, more examples and test / mock various error conditions
 * TODO: Test and watch memory usage
 * TODO: Make code testable, move application code (and main namespace?) from cli.js to /src/main.js
 * TODO: settings.writeBenchmark to write/append time, timestamp, measured_time and received_chars to <jobname>.csv
 * TODO: settings.writeLog to write job specific errors and actions to <jobname>.log
 *
 * LONG-TERM:
 * TODO: Scriptable / programmatic transformers (_transformer.js)
 * TODO: Add a true caching database, cacheur does only the job managing in this mode.
 * TODO: Modular Serializer (cocoon project)
 */

//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var _ = require('lodash');
var path = require('path');
var argv = require('minimist')(process.argv.slice(2));
var semlog = require('semlog');
var log = semlog.log;

var readProject = require('./src/readProject');
var fetch = require('./src/fetch');
var webServer = require('./src/webServer');

var defaultSettings = require('./src/defaultSettings');


//////////////////////////////////////////
// VARIABLES                            //
//////////////////////////////////////////

/** Object containing all running intervals */
exports.intervals = {};

/** Global settings object */
exports.settings = defaultSettings;

/** Map containing all request specific settings */
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
// Bootstrap                            //
//////////////////////////////////////////

semlog.updateConfig({
    historySize: exports.settings.logSize
});


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
