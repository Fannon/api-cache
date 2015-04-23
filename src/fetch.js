
var rp = require('request-promise');

var transform = require('./transform');
var util = require('./util');
var log = util.log;

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

    if (settings.query && settings.query.ask) {
        exports.ask(settings, exports.onRetrieval);
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

    if (err) {

        log (' [E] Request "' + settings.id + '" failed!');
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
        if (settings.retryDelay) {

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


    } else {

        log('[S] Fetched "' + settings.id + '" -> time: ' + time + 'ms, size: ' + JSON.stringify(data).length + ' chars');

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
        exports.dataStore.raw[settings.id] = data;

        // Call specified transformer modules
        if (settings.transformers && settings.transformers.length > 0) {
            for (var i = 0; i < settings.transformers.length; i++) {

                var transformerName = settings.transformers[i];

                if (typeof transform[transformerName] === 'function') {

                    if (!exports.dataStore[transformerName]) {
                        exports.dataStore[transformerName] = {};
                    }

                    // Store the transformed data into the dataStore object
                    exports.dataStore[transformerName][settings.id] = transform[transformerName](data, settings);

                    if (settings.debug) {
                        log('[i] -> Transformed "' + settings.id + '" with "' + transformerName + '"');
                    }

                } else {
                    log('[E] Could not find specified transformer module ' + transformerName);
                }
            }
        }
    }
};

/**
 * Fetches ASK Queries from Semantic MediaWiki APIs
 *
 * @param settings
 * @param callback
 * @returns {*}
 */
exports.ask = function(settings, callback) {

    var timer = (new Date()).getTime();

    if (!settings.query || !settings.query.url) {
        var e = new Error('No API URL given, cannot execute ASK query "' + settings.id + '"');
        log('[E] ' + e.message);
        log(e);
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
        timeout: settings.timeout * 1000
    };

    // Do the actual Request
    rp(requestOptions)
        .then(function(result) {
            var obj = JSON.parse(result);
            return callback(false, obj, settings, (new Date()).getTime() - timer);
        })
        .catch(function(err) {
            return callback(err, false, settings, (new Date()).getTime() - timer);
        }
    );
};
