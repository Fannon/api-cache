//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var packageJson  = require('./../package.json');
var semlog = require('semlog');


/**
 * Default Settings
 */
module.exports = {


    //////////////////////////////////////////
    // INTERNAL PARAMETERS                  //
    //////////////////////////////////////////

    /** Current Working Directory */
    cwd: process.cwd(),

    /** Current cacheur version */
    version: packageJson.version,

    /** Time apich started */
    startTime: semlog.humanDate((new Date())),

    /** ID of the request, including file extension */
    id: undefined,

    /** Job is valid and will be executed */
    valid: true,

    /** Cache is available and can be fetched */
    available: false,

    /** Statistics about the request */
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


    //////////////////////////////////////////
    // ADJUSTABLE PARAMETERS                //
    //////////////////////////////////////////

    /** Port apich serves the API caches */
    port: 1337,

    /** Size of the internal log archive */
    logSize: 128,

    /** MediaWiki API URL (e.g. http://en.wikipedia.org/w/api.php), used for ASK queries */
    mwApiUrl: undefined,

    /** Timeout for API Request (in seconds) */
    timeout: 60,

    /** If a request failes, the retry delay defines how long to wait until cacheur tries again. (in seconds) */
    retryDelay: 10,

    /** Time after the cache will be fetched anew (in seconds) */
    fetchInterval: 3 * 60,

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

    /** Writes job-specific benchmark to a .csv file */
    writeBenchmark: false,

    /** Writes job-specific log to a .json file */
    writeLog: false,

    /** Serve '/_debug/*' routes */
    serveDebug: true,

    /** Serve '/_detail/*' routes */
    serveDetail: true,

    /** Serve main '/' route */
    serveMain: true,

    writeUTF8BOM: true
};
