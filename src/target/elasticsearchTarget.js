var elasticsearch = require('elasticsearch');
var semlog = require('semlog');
var log = semlog.log;

exports.client = undefined;

exports.init = function(settings, callback) {

    var indexId = 'cacheur_' + settings.id.toLowerCase();

    var elSettings = {
        host: settings.elasticsearch.host || 'localhost:9200'
    };

    if (settings.verbose) {
        log('[i] ElasticSearch initializing new index: ' + indexId);
    }

    if (settings.debug) {
        elSettings.log = 'trace';
    }

    exports.client = elasticsearch.Client(elSettings);

    exports.client.indices.delete({
        index: indexId
    }, function(err, resp) {

        if (err) {
            log('[E] Error while deleting the ElasticSearch index: ' + indexId);
            log(err);
        }

        var indexSettings = settings.elasticsearch.indexsettings || {
            mappings: {
                cacheur: {
                    _timestamp: {
                        enabled: true
                    }
                }
            }
        };

        exports.client.indices.create({
            index: indexId,
            body: indexSettings
        }, callback);
    });
};

/**
 * Syncs changes to a remote elasticsearch server
 * @param settings
 * @param diff
 */
exports.sync = function(settings, diff) {

    var i;
    var id;
    var bulkJobs = '';
    var indexId = 'cacheur_' + settings.id.toLowerCase();

    if (settings.verbose) {
        log('[i] ElasticSearch syncing index: ' + indexId);
    }

    if (!exports.client) {
        exports.init(settings);
    }

    // Remove Documents
    for (i = 0; i < diff.removed.length; i++) {
        id = diff.removed[i];
        bulkJobs += '{ "delete" : { "_index" : "' + indexId + '", "_type" : "cacheur", "_id" : "' + id + '" } }\n';
    }

    // Create Documents
    for (i = 0; i < diff.added.length; i++) {
        var add = diff.added[i];
        id = add[settings.diff.id];

        bulkJobs += '{ "create" : { "_index" : "' + indexId + '", "_type" : "cacheur", "_id" : "' + id + '" } }\n';
        bulkJobs += JSON.stringify(add) + '\n';
    }

    // Change Documents
    for (i = 0; i < diff.changed.length; i++) {
        var change = diff.changed[i];
        id = change[settings.diff.id];
        bulkJobs += '{ "index" : { "_index" : "' + indexId + '", "_type" : "cacheur", "_id" : "' + id + '" } }\n';
        bulkJobs += JSON.stringify(change) + '\n';
    }

    exports.client.bulk({
        body: bulkJobs
    }, function(err, resp) {

        if (err) {
            log('[E] Error while using the ElasticSearch bulk upload');
            log(err);
        }
    });

};
