//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////


var _ = require('lodash');
var fs = require('fs-extra');
var path = require('path');
var semlog = require('semlog');
var log = semlog.log;

var readProject = require('./readProject');
var fetch = require('./fetch');
var webServer = require('./webServer');

//////////////////////////////////////////
// Variables                            //
//////////////////////////////////////////


/** Object containing all running intervals */
exports.intervals = {};

/** Global settings object */
exports.settings = {};

/** Map containing all request specific settings */
exports.requestSettings = {};

// Global dataStore object
exports.dataStore = {};

//////////////////////////////////////////
// Bootstrap                            //
//////////////////////////////////////////

exports.bootstrap = function(settings) {

    exports.settings = settings;

    // Read the current (or given) project directory
    exports.readProject(settings.cwd);

    // Update the semlogger config, depending on the settings
    semlog.updateConfig({
        historySize: settings.logSize
    });

    if (settings.webserver) {

        if (!settings.webserver.url) {
            settings.webserver.url = 'http://localhost';
        }

        if (!settings.webserver.path) {
            settings.webserver.path = '/var/www/cacheur';
        }
    }

    exports.processRequests(exports.requestSettings);

    // Start Webserver and give a reference to the data store object
    webServer.init(exports.settings, exports.dataStore, exports.requestSettings);

};


/**
 * Reads project from directory
 * @param dir
 */
exports.readProject = function(dir) {

    // Read files from (current) project directory
    var projectFiles = readProject.read(dir);

    if (projectFiles) {

        exports.requestSettings = projectFiles.requestSettings;

        // Merge global settings into default settings
        _.merge(exports.settings, projectFiles.masterSettings);

        if (exports.settings.debug) {
            log('[i] Project folder: ' + exports.settings.cwd);
            log(projectFiles.fileList);
        }

        return exports.requestSettings;


    } else {
        log('[E] Could not read project directory. Aborting.');
        process.exit();
    }


};



//////////////////////////////////////////
// Processing requests                  //
//////////////////////////////////////////
exports.processRequests = function(requestSettings) {

    // Iterate over all requests, calculate their settings and run them in the defined intervals
    for (var requestName in requestSettings) {


        //////////////////////////////////////////
        // Settings Inheritance                 //
        //////////////////////////////////////////

        var givenSettings = requestSettings[requestName];

        // Inherit project specific settings
        var specificSettings = _.cloneDeep(exports.settings);
        specificSettings = _.merge(specificSettings, givenSettings);

        // Save the extended request settings back to the global requestSettings object
        requestSettings[specificSettings.id] = specificSettings;

        // Init dataStore for this cache job
        exports.dataStore[specificSettings.id] = {};

        log('[i] Added Job "' + specificSettings.id + '" with an interval of ' + specificSettings.fetchInterval + 's');
        if (specificSettings.verbose) {
            log(specificSettings);
        }

        if (specificSettings.webserver) {
            var webserverPath = path.join(specificSettings.webserver.path, '/' + specificSettings.id);

            if (specificSettings.verbose) {
                log('[i] Emptying path: ' + webserverPath);
            }

            try {
                fs.emptyDirSync(webserverPath);
            } catch (e) {
                log('[W] Could not empty path: ' + webserverPath);
                log(e);
            }
        }


        //////////////////////////////////////////
        // Run caching jobs                     //
        //////////////////////////////////////////

        // Run the query for the first time
        fetch.request(specificSettings, exports.dataStore); // Runs async

        // Run the query in the interval that is specified in the cacheExpiration setting
        // Inject the specificSettings as requestSettings to avoid mutation problems
        if (specificSettings.fetchInterval) {

            exports.intervals[specificSettings.id] = setInterval(function(requestSettings, interval) {

                if (requestSettings.valid === false) {
                    log('Stopping interval!');
                    clearInterval(interval);
                    requestSettings.retryDelay = false;
                }

                fetch.request(requestSettings, exports.dataStore);

            }, specificSettings.fetchInterval * 1000, specificSettings, exports.intervals[requestSettings.id]);

        } else {
            log('[i] No interval given for ' + requestName + '. Job will run only once.');
        }
    }

};
