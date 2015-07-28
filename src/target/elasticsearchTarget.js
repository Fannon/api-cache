var elasticsearch = require('elasticsearch');
var semlog = require('semlog');
var log = semlog.log;

exports.client = undefined;

exports.init = function(settings, callback) {

    var elSettings = {
        host: settings.elasticsearch.host || 'localhost:9200'
    };

    if (settings.verbose) {
        log('[i] ElasticSearch initializing new index: cacheur_' + settings.id);
    }

    if (settings.debug) {
        elSettings.log = 'trace';
    }

    exports.client = elasticsearch.Client(elSettings);

    exports.client.indices.delete({
        index: 'cacheur_' + settings.id
    }, function(err, resp) {

        if (err) {
            log('[E] Error while deleting the ElasticSearch index: cacheur_' + settings.id);
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
            index: 'cacheur_' + settings.id,
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

    if (settings.verbose) {
        log('[i] ElasticSearch syncing index: cacheur_' + settings.id);
    }

    if (!exports.client) {
        exports.init(settings);
    }

    // Remove Documents
    for (i = 0; i < diff.removed.length; i++) {
        id = diff.removed[i];
        bulkJobs += '{ "delete" : { "_index" : "cacheur_' + settings.id + '", "_type" : "cacheur", "_id" : "' + id + '" } }\n';
    }

    // Create Documents
    for (i = 0; i < diff.added.length; i++) {
        var add = diff.added[i];
        id = add[settings.diff.id];

        bulkJobs += '{ "create" : { "_index" : "cacheur_' + settings.id + '", "_type" : "cacheur", "_id" : "' + id + '" } }\n';
        bulkJobs += JSON.stringify(add) + '\n';
    }

    // Change Documents
    for (i = 0; i < diff.changed.length; i++) {
        var change = diff.changed[i];
        id = change[settings.diff.id];
        bulkJobs += '{ "index" : { "_index" : "cacheur_' + settings.id + '", "_type" : "cacheur", "_id" : "' + id + '" } }\n';
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
