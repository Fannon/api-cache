//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////


var _ = require('lodash');
var rp = require('request-promise');

var transform = require('./transform');
var util = require('./util');
var log = util.log;


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


    if (!err) {

        //////////////////////////////////////////
        // SUCCESSFUL REQUEST                   //
        //////////////////////////////////////////

        log('[S] Fetched "' + settings.id + '" in ' + time + 'ms with size of ' + JSON.stringify(data).length + ' chars');

        // Write statistics
        settings.statistics.lastUpdate = util.humanDate((new Date()));
        settings.statistics.lastUpdateTimestamp = (new Date()).getTime();
        settings.statistics.runCounter += 1; // Increase counter

        // Log benchmark times
        // Benchmark array should not get bigger than 10 entries to prevent memory leaks
        settings.statistics.benchmark.push(time);
        if (settings.statistics.benchmark.length > settings.benchmarkArraySize) {
            settings.statistics.benchmark.shift();
        }

        // Write and transform data
        if (settings.raw) {
            exports.dataStore.raw[settings.id] = data;
            settings.available = true;
        }

        //////////////////////////////////////////
        // Apply Transformer Modules            //
        //////////////////////////////////////////

        if (settings.transformers) {

            for (var transformerName in settings.transformers) {

                if (typeof transform[transformerName] === 'function') {

                    if (!exports.dataStore[transformerName]) {
                        exports.dataStore[transformerName] = {};
                    }

                    if (!settings.transformers[transformerName]) {
                        settings.transformers[transformerName] = {}; // Fix possible nulls from YAML parser
                    }

                    // Store the transformed data into the dataStore object
                    var dataClone = _.cloneDeep(data); // Make a deep clone, to avoid interdependencies between transformers

                    try {
                        // Do the actual transformation and store it
                        exports.dataStore[transformerName][settings.id] = transform[transformerName](dataClone, settings);
                        settings.available = true;

                    } catch (e) {
                        log('[E] Transformer module "' + transformerName + '" failed for module "' + settings.id + '"');
                        log(e);
                    }

                    if (settings.debug) {
                        log('[i] --> Transformed "' + settings.id + '" with "' + transformerName + '" with size of ' +
                            JSON.stringify(exports.dataStore[transformerName][settings.id]).length + ' char');
                    }

                } else {
                    log('[E] Could not find specified transformer module ' + transformerName);
                }
            }
        }

    } else {

        //////////////////////////////////////////
        // FAILED REQUEST                       //
        //////////////////////////////////////////

        log ('[E] Request "' + settings.id + '" failed: ' + err.message);
        log(err);

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
            var diff = false;

            // Calculate diff (only when a timestamp already exists.
            if (settings.statistics.lastErrorTimestamp) {
                diff = (new Date()).getTime() - settings.statistics.lastErrorTimestamp;
            }

            // If a last error was registert, check if it had happened at least the delays time ago
            if (diff && diff < settings.retryDelay * 1000) {
                retry = false;
            }

            if (retry) {
                log('[i] Previous request failed, trying again with delay of ' + settings.retryDelay + 's');

                // Try again after the retry delay time
                setTimeout(function(s) {
                    exports.request(s);
                }, settings.retryDelay * 1000, settings);

            } else {
                diff = diff || '(unknown)';
                log('[i] Previous request failed ' + diff + 'ms ago, waiting...');
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

    var timer = (new Date()).getTime();

    if (!settings.query || !settings.query.url) {
        var e = new Error('No API URL given, cannot execute ASK query "' + settings.id + '"');
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
                    log('[E] ASK API Error for "' + settings.id + '"');
                    log(obj.error);
                    return callback(obj.error, false, settings, (new Date()).getTime() - timer);
                } else {
                    return callback(false, obj, settings, (new Date()).getTime() - timer);
                }

            } catch (e) {
                log('[E] Could not parse JSON for "' + settings.id + '"');
                log(e);
                return callback(e, false, settings, (new Date()).getTime() - timer);
            }

        })
        .catch(function(err) {
            return callback(err, false, settings, (new Date()).getTime() - timer);
        }
    );
};
