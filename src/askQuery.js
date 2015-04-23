var request = require('request-promise');

exports.exec = function(query, settings, queryName, callback) {

    var timer = (new Date()).getTime();

    // Remove all Whitespace
    var escapedQuery = query.replace(/ +?/g, '');

    //console.log();
    //console.log(query);
    //console.log();
    //console.log(JSON.stringify(settings, false, 4));

    var url = settings.apiUrl;
    url += '?action=ask&query=' + escapedQuery + '&format=json';

    //console.log();
    //console.log(url);

    request(url)
        .then(function(result) {
            var json = JSON.parse(result);
            callback(false, json, queryName, (new Date()).getTime() - timer);
        })
        .catch(function(err) {
            callback(err, false, queryName, (new Date()).getTime() - timer);
        }
    );
};
