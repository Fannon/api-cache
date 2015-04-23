
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

    exports.dataStore = dataStore;

    if (settings.debug) {
        log(' [i] Request ' + settings.id + ' received with following settings: ');
        log(settings);
    }

    if (settings.id.indexOf('.ask') > -1) {
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
        log (' [E] Request ' + settings.id + ' failed!');
        log(err);
    } else {

        log(' [S] Request ' + settings.id + ' | time: ' + time + 'ms | size: ' + JSON.stringify(data).length + ' Chars');

        // Write statistics
        settings.statistics.lastUpdate = Math.floor(Date.now() / 1000); // UNIX Timestamp
        settings.statistics.lastUpdateNice = util.humanDate(); // "Nicer" date string
        settings.statistics.benchmark.push(time); // Write benchmark times
        // Benchmark array should not get bigger than 10 entries to prevent memory leaks
        if (settings.statistics.benchmark.push.length > 10) {
            settings.statistics.benchmark.shift();
        }

        // Write and transform data
        exports.dataStore.raw[settings.name] = data;

        // Call specified transformer modules
        if (settings.transformers && settings.transformers.length > 0) {
            for (var i = 0; i < settings.transformers.length; i++) {
                var func = settings.transformers[i];
                if (typeof transform[func] === 'function') {
                    exports.dataStore[func] = transform[func](data, settings);
                    if (settings.debug) {
                        log(' [i] --> Applied transformer module "' + func + '" to "' + settings.id + '"');
                    }
                } else {
                    log(' [E] Could not find specified transformer module ' + func);
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

    if (!settings.mwApiUrl) {
        var e = new Error('No API URL given, cannot execute ASK query ' + settings.id);
        log(e);
        return callback(e, false);
    }

    var timer = (new Date()).getTime();

    // Remove all Whitespace
    var escapedQuery = settings.request.replace(/ +?/g, '');

    var requestOptions = {
        url: settings.mwApiUrl,
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
            callback(false, obj, settings, (new Date()).getTime() - timer);
        })
        .catch(function(err) {
            callback(err, false, settings, (new Date()).getTime() - timer);
        }
    );
};
