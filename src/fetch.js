//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var _ = require('lodash');
var rp = require('request-promise');
var fs = require('fs-extra');
var path = require('path');
var crypto = require('crypto');
var semlog = require('semlog');
var log = semlog.log;

var transform = require('./transform');


//////////////////////////////////////////
// METHODS                              //
//////////////////////////////////////////

/**
 * Handles Requests, decides how to fetch them
 *
 * @param settings
 * @param dataStore     Data Storage Object (per reference)
 */
exports.request = function(settings, dataStore) {

    if (dataStore) {
        exports.dataStore = dataStore;
    }

    if (settings.http) {
        exports.fetchGeneric(settings, exports.onRetrieval);
    } else if (settings.query && settings.query.ask) {
        exports.fetchAskQuery(settings, exports.onRetrieval);
    } else {
        log('[E] Neither http nor query given!');
    }
};

/**
 * Callback function, on data recieval from the API Request
 *
 * @param err
 * @param data
 * @param settings
 * @param time
 */
exports.onRetrieval = function(err, data, settings, time) {

    var id = settings.id;

    // Overwrite log function to additionally log to file
    log = function(msg) {
        semlog.log(msg);
        exports.writeLog(settings, msg);
    };

    //////////////////////////////////////////
    // SUCCESSFUL REQUEST                   //
    //////////////////////////////////////////


    if (!err && data) {

        //////////////////////////////////////////
        // Statistics / Benchmark               //
        //////////////////////////////////////////

        var size = semlog.byteSize(data);
        if (settings.verbose) {
            log('[S] [' + id + '] Fetched in ' + time + 'ms with size of ' + semlog.prettyBytes(size));
        }

        // Write statistics
        settings.statistics.lastUpdate = semlog.humanDate((new Date()));
        settings.statistics.lastUpdateTimestamp = (new Date()).getTime();
        settings.statistics.runCounter += 1; // Increase counter

        // Log benchmark times
        // Benchmark array should not get bigger than 10 entries to prevent memory leaks
        settings.statistics.benchmark.push(time);
        if (settings.statistics.benchmark.length > settings.benchmarkArraySize) {
            settings.statistics.benchmark.shift();
        }

        // Log benchmark to job specific file
        if (settings.writeBenchmark) {
            exports.writeBenchmark(settings, time, size);
        }

        // Calculate diff through hashes of the raw received data.
        // Only continue updating and transforming data if changes were detected
        var newHash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
        if (settings.hash && settings.hash === newHash) {
            return;
        }
        settings.hash = newHash;

        settings.statistics.lastChange = semlog.humanDate((new Date()));
        settings.statistics.lastChangeTimestamp = (new Date()).getTime();


        //////////////////////////////////////////
        // Raw Data                             //
        //////////////////////////////////////////

        if (settings.webserver) {
            exports.writeWebserverFile(settings, 'raw', data);
        }

        if (settings.raw) {
            exports.dataStore[id].raw = _.cloneDeep(data);
        } else if (settings.webserver) {
            // Neither DIFF nor RAW needs to be saved.
            exports.dataStore[id].raw = true;
        }

        //////////////////////////////////////////
        // Apply Transformer Modules            //
        //////////////////////////////////////////

        if (settings.transformers) {

            for (var transformerName in settings.transformers) {

                if (typeof transform[transformerName] === 'function') {

                    if (!exports.dataStore[id][transformerName]) {
                        exports.dataStore[id][transformerName] = {};
                    }

                    if (!settings.transformers[transformerName]) {
                        settings.transformers[transformerName] = {}; // Fix possible nulls from YAML parser
                    }

                    // Store the transformed data into the dataStore object
                    var dataClone = _.cloneDeep(data); // Make a deep clone, to avoid interference between transformers

                    try {
                        // Do the actual transformation and store it
                        var newTransformedData = transform[transformerName](dataClone, settings);

                        //////////////////////////////////////////
                        //                                      //
                        //////////////////////////////////////////

                        if (settings.diff) {

                            var oldData = exports.dataStore[id][transformerName];
                            var lastDiff = exports.objDiff(settings, oldData, newTransformedData);

                            // Only update the diff if it is the initial diff or changes were introduced
                            if (lastDiff.init || lastDiff.totalChanges > 0) {
                                if (settings.webserver) {
                                    exports.writeWebserverFile(settings, transformerName + '-diff', lastDiff);
                                    exports.dataStore[id][transformerName + '-diff'] = true;
                                } else {
                                    exports.dataStore[id][transformerName + '-diff'] = _.cloneDeep(lastDiff);
                                }
                            }

                            // Save the new transformed object in any case, since it is needed for the next diff.
                            exports.dataStore[id][transformerName] = _.cloneDeep(newTransformedData);
                        }

                        if (settings.webserver) {
                            exports.writeWebserverFile(settings, transformerName, newTransformedData);

                            if (!settings.diff) {
                                exports.dataStore[id][transformerName] = true;
                            }
                        }


                    } catch (e) {
                        log('[E] [' + id + '] Transformer module "' + transformerName + '" failed');
                        log(e.stack);
                    }

                    if (settings.verbose && exports.dataStore[id][transformerName]) {
                        var transformedSize = semlog.byteSize(exports.dataStore[id][transformerName]);
                        log('[i] [' + id + '] Transformer "' + transformerName + '" applied. Resulting size: ' +
                            semlog.prettyBytes(transformedSize));
                    }

                } else {
                    log('[E] Could not find specified transformer module ' + transformerName);
                }
            }
        }

        if (settings.verbose) {
            var now = (new Date().getTime()) - settings.statistics.lastChangeTimestamp;
            log('[i] [' + id + '] Transformed and written data in ' + now + 'ms');
        }

        settings.available = true;

    } else {

        //////////////////////////////////////////
        // FAILED REQUEST                       //
        //////////////////////////////////////////

        log('[E] [' + id + '] Request failed: ' + err.message);
        log(err);
        if (err.stack) {console.error(err.stack);}

        if (!data) {
            log('[W] [' + id + '] No data retreived!');
        }

        // Count / log errors to the request statistics
        settings.statistics.errorCounter += 1;
        if (err.message) {
            if (!settings.statistics.errors[err.message]) {
                settings.statistics.errors[err.message] = 1;
            } else {
                settings.statistics.errors[err.message] += 1;
            }
        }

        // If a retry delay is given, try again.
        // Calculates when the last error has happened and will only trigger a new request
        // if the time difference is bigger than the retry delay
        // This is important to avoid errors times stacking up
        if (settings.retryDelay && settings.valid) {

            var retry = true;
            var timeDiff = false;

            // Calculate diff (only when a timestamp already exists.
            if (settings.statistics.lastErrorTimestamp) {
                timeDiff = (new Date()).getTime() - settings.statistics.lastErrorTimestamp;
            }

            // If a last error was registert, check if it had happened at least the delays time ago
            if (timeDiff && timeDiff < settings.retryDelay * 1000) {
                retry = false;
            }

            if (retry) {
                log('[i] [' + id + '] Previous request failed, trying again with delay of ' + settings.retryDelay + 's');

                // Try again after the retry delay time
                setTimeout(function(s) {
                    exports.request(s);
                }, settings.retryDelay * 1000, settings);

            } else {
                timeDiff = timeDiff || '(unknown)';
                log('[i] [' + id + '] Previous request failed ' + timeDiff + 'ms ago, waiting...');
            }

        }

        settings.statistics.lastErrorTimestamp = (new Date()).getTime();

    }

};

/**
 * Fetch generic HTTP requests via given URL
 * If the result is parsable JSON it will return an object.
 *
 * @param settings
 * @param callback
 */
exports.fetchGeneric = function(settings, callback) {

    // Overwrite log function to additionally log to file
    log = function(msg) {
        semlog.log(msg);
        exports.writeLog(settings, msg);
    };

    var timer = (new Date()).getTime();

    if (!settings.http || !settings.http.url) {
        var e = new Error('No URL given, cannot execute AJAX request to fetch "' + settings.id + '"');
        settings.valid = false; // Do not try again, because this job will always fail
        return callback(e, false, settings, (new Date()).getTime() - timer);
    }

    var requestOptions = {
        url: settings.http.url,
        timeout: settings.timeout * 1000,
        headers: {
            'User-Agent': 'cacheur/' + settings.version
        }
    };

    if (settings.http.queryString) {
        requestOptions.qs = settings.http.queryString;
    }

    // Do the actual Request
    rp(requestOptions)
        .then(function(result) {

            var data;
            try {
                data = JSON.parse(result);
            } catch (e) {
                data = result;
            }

            return callback(false, data, settings, (new Date()).getTime() - timer);
        })
        .catch(function(err) {
            return callback(err, false, settings, (new Date()).getTime() - timer);
        }
    );
};

/**
 * Fetches ASK Queries from Semantic MediaWiki APIs
 *
 * @param settings
 * @param callback
 * @returns {*}
 */
exports.fetchAskQuery = function(settings, callback) {

    var id = settings.id;

    // Overwrite log function to additionally log to file
    log = function(msg) {
        semlog.log(msg);
        exports.writeLog(settings, msg);
    };

    var timer = (new Date()).getTime();

    // Overwrite log function to additionally log to file
    log = function(msg) {
        semlog.log(msg);
        exports.writeLog(settings, msg);
    };

    if (!settings.query || !settings.query.url) {
        var e = new Error('No API URL given, cannot execute ASK query "' + id + '"');
        settings.valid = false;
        return callback(e, false, settings, (new Date()).getTime() - timer);
    }

    // Remove all Whitespace
    var escapedQuery = settings.query.ask.replace(/ +?/g, '');

    var requestOptions = {
        url: settings.query.url,
        qs: {
            action: 'ask',
            query: escapedQuery,
            format: 'json'
        },
        timeout: settings.timeout * 1000,
        headers: {
            'User-Agent': 'cacheur/' + settings.version
        }
    };

    // Do the actual Request
    rp(requestOptions)
        .then(function(result) {

            try {
                var obj = JSON.parse(result);

                if (obj.error) {
                    log('[E] ASK API Error for "' + id + '"');
                    log(obj.error);
                    return callback(obj.error, false, settings, (new Date()).getTime() - timer);
                } else {
                    return callback(false, obj, settings, (new Date()).getTime() - timer);
                }

            } catch (e) {
                log('[E] Could not parse JSON for "' + id + '"');
                log(e);
                return callback(e, false, settings, (new Date()).getTime() - timer);
            }

        })
        .catch(function(err) {
            return callback(err, false, settings, (new Date()).getTime() - timer);
        }
    );
};


//////////////////////////////////////////
// Helper Functions                     //
//////////////////////////////////////////

/**
 * Calculates the DIFF between two Objects.
 * It returns an object, containing all added, removed and changed subobjects.
 *
 * @param settings
 * @param oldData
 * @param newData
 */
exports.objDiff = function(settings, oldData, newData) {

    var diff = {
        startTime: settings.startTime,
        lastChange: settings.statistics.lastChange || null,
        lastDiff: settings.statistics.lastDiff || null,
        init: false,
        totalChanges: 0,
        added: [],
        changed: [],
        removed: []
    };

    settings.statistics.lastDiff = semlog.humanDate((new Date()));

    if (!oldData || Object.keys(oldData).length === 0) {
        diff.init = true;
        return diff;
    }

    var oldDataObj = {};
    var newDataObj = {};

    if (_.isArray(newData)) {

        if (!settings.diff || !settings.diff.id) {
            log('[E] Cannot apply a diff to an object collection (array) without id parameter!');
            return;
        }

        for (var i = 0; i < newData.length; i++) {
            var newObj = newData[i];
            var newId = newObj[settings.diff.id];
            newDataObj[newId] = newObj;
        }

        if (oldData) {
            for (i = 0; i < oldData.length; i++) {
                var oldObj = oldData[i];
                var oldId = oldObj[settings.diff.id];
                oldDataObj[oldId] = oldObj;
            }
        }

    } else if (_.isObject(newData)) {
        oldDataObj = oldData;
        newDataObj = newData;
    } else {
        log('[E] Received data is neither array nor object');
        return;
    }

    // Calculate removed
    for (var oldObjName in oldDataObj) {
        if (!newDataObj[oldObjName]) {
            diff.removed.push(oldObjName);
            diff.totalChanges += 1;
        }
    }

    // Calculate added / changed
    for (var newObjName in newDataObj) {
        var obj = newDataObj[newObjName];

        if (!oldDataObj[newObjName]) {
            // Added
            diff.added.push(obj);
            diff.totalChanges += 1;

        } else if (JSON.stringify(oldDataObj[newObjName]) !== JSON.stringify(newDataObj[newObjName])) {
            // Changed
            diff.changed.push(obj);
            diff.totalChanges += 1;
        }
    }

    if (settings.verbose) {
        log('[i] Diff calculated: ' + diff.removed.length + ' removed, ' +
            Object.keys(diff.added).length + ' added, ' +
            Object.keys(diff.changed).length + ' changed.');
    }

    return diff;

};

/**
 * If the filestystem / webserver is enabled as a target, this will store the entrypoints as files.
 *
 * @param settings
 * @param fileName
 * @param obj
 */
exports.writeWebserverFile = function(settings, fileName, obj) {

    var id = settings.id;

    if (settings.webserver && settings.webserver.path) {
        var filePath = path.join(settings.webserver.path, '/' + settings.id + '/' + fileName + '.json');
        var fileContent;

        try {
            if (settings.prettyJson) {
                fileContent = JSON.stringify(obj, null, 4);
            } else {
                fileContent = JSON.stringify(obj);
            }
        } catch (e) {
            fileContent = obj;
        }

        if (settings.writeUTF8BOM) {
            fileContent = '\ufeff' + fileContent;
        }

        fs.outputFile(filePath, fileContent, function(e) {
            if (e) {
                log('[E] [' + id + '] Could not write file: ' + filePath);
                log(e);
            } else if (settings.verbose) {
                log('[i] [' + id + '] Written file: ' + filePath);
            }
        });

    } else {
        log('[E] No webserver.path given, cannot write to file: ' + settings.id);
    }
};

/**
 * Writes benchmark information to a .csv file
 *
 * @param {{}}      settings
 * @param {number}  time
 * @param {string}  size
 */
exports.writeBenchmark = function(settings, time, size) {
    try {
        var benchmarkFile = path.join(settings.cwd, '/' + settings.id + '.csv');

        // Create new benchmark CSV file if it doesn't exist yet
        if (!fs.existsSync(benchmarkFile)) {
            log('[i] Creating new benchmark CSV file: ' + benchmarkFile);
            fs.writeFileSync(benchmarkFile, 'time;size\n');
        }

        // Append benchmark content
        var content = [time, size];
        fs.appendFile(benchmarkFile, content.join(';') + '\n', function(err) {
            if (err) {
                log('[W] Could not append to benchmark file: ' + benchmarkFile);
                log(err);
            }
        });

    } catch (e) {
        log('[E] Error while writing benchmark file for job ' + settings.id);
        log(e);
    }
};

/**
 * Writes and appends to a logfile.
 * Every cache will get its own logfile.
 *
 * This must be activated through a settings (settings.writeLog)
 *
 * @param settings
 * @param msg
 */
exports.writeLog = function(settings, msg) {
    try {
        if (settings.writeLog) {
            var logFile = path.join(settings.cwd, '/' + settings.id + '.log');

            var logMsg = semlog.humanDate() + ' ' + msg + '\n';

            fs.appendFile(logFile, logMsg, function(err) {
                if (err) {
                    log('[W] Could not write / append to logfile: ' + logFile);
                    log(err);
                }
            });
        }

    } catch (e) {
        log('[E] Error while writing log file for job ' + settings.id);
        log(e);
    }
};
