var elasticsearch = require('elasticsearch');
var semlog = require('semlog');
var log = semlog.log;

exports.client = undefined;

exports.init = function(settings, callback) {
    log('[i] elasticsearch init index: cacheur_' + settings.id);
    exports.client = elasticsearch.Client({
        //log: 'trace',
        host: settings.elasticsearch.host || 'localhost:9200'
    });

    exports.client.indices.delete({
        index: 'cacheur_' + settings.id
    }, function(err, resp) {

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

    log('ElasticSearch SYNC');

    if (!exports.client) {
        exports.init(settings);
    }

    var i, id;

    for (i = 0; i < diff.removed.length; i++) {
        var remove = diff.removed[i];

        exports.client.delete({
            index: 'cacheur_' + settings.id,
            type: 'cacheur',
            id: remove
        }, function(error, response) {
        });
    }

    for (i = 0; i < diff.added.length; i++) {
        var add = diff.added[i];
        id = add[settings.diff.id];

        exports.client.create({
            index: 'cacheur_' + settings.id,
            type: 'cacheur',
            id: id,
            body: add
        }, function(error, response) {
        });
    }

    for (i = 0; i < diff.changed.length; i++) {
        var change = diff.changed[i];
        id = change[settings.diff.id];

        exports.client.update({
            index: 'cacheur_' + settings.id,
            type: 'cacheur',
            id: id,
            body: {
                // put the partial document under the `doc` key
                doc: change
            }
        }, function(error, response) {
        });
    }



    //exports.client.bulk({
    //    body: bulkJobs
    //}).then(function(body) {
    //    log(body);
    //}, function(error) {
    //    console.trace(error.message);
    //});

    //
    //
    //exports.client.bulk({
    //    body: bulkJobs
    //}, function(err, resp) {
    //    log(err);
    //    log(resp);
    //});


    //'// action description
    //{ index:  { _index: 'myindex', _type: 'mytype', _id: 1 } },
    //// the document to index
    //{ title: 'foo' },
    //// action description
    //{ update: { _index: 'myindex', _type: 'mytype', _id: 2 } },
    //// the document to update
    //{ doc: { title: 'foo' } },
    //// action description
    //{ delete: { _index: 'myindex', _type: 'mytype', _id: 3 } },
    //// no document needed for this delete'
};
