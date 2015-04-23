/**
 * Simplifies the ASK JSON result format to a more concise JSON notation
 *
 * @param {{}}  obj
 *
 * @returns {{}}
 */
exports.simplifiedAsk = function(obj, settings) {

    var result = {};
    var transformSettings = settings.transformers.simplifiedAsk;

    for (var id in obj.query.results) {

        var personObj = obj.query.results[id];

        result[id] = personObj.printouts;

        for (var propertyName in result[id]) {

            var property = result[id][propertyName];

            // Simplify / flatten page objects to arrays
            if (property[0] && typeof property[0] === 'object' && property[0].fulltext) {

                var simplifiedArray = [];

                for (var i = 0; i < property.length; i++) {
                    var propertyObj = property[i];
                    simplifiedArray.push(propertyObj.fulltext);
                }

                result[id][propertyName] = simplifiedArray;
            }

            // Rename properties
            if (transformSettings.rename) {
                if (transformSettings.rename[propertyName]) {
                    var newName = transformSettings.rename[propertyName];
                    // http://stackoverflow.com/a/14592469
                    Object.defineProperty(result[id], newName, Object.getOwnPropertyDescriptor(result[id], propertyName));
                    delete result[id][propertyName];
                }
            }
        }

    }

    return result;
};

/**
 * Simplifies the ASK JSON result format to a more concise JSON notation
 *
 * @param {{}}  obj
 *
 * @returns {{}}
 */
exports.simplifiedAskCollection = function(obj, settings) {

    var result = [];
    var index = 0;
    var transformSettings = settings.transformers.simplifiedAskCollection;

    for (var personName in obj.query.results) {

        result[index] = obj.query.results[personName].printouts;
        result[index]['ID'] = [personName];

        for (var propertyName in result[index]) {

            var property = result[index][propertyName];

            // Simplify / flatten page objects to arrays
            if (property[0] && typeof property[0] === 'object' && property[0].fulltext) {

                var simplifiedArray = [];

                for (var i = 0; i < property.length; i++) {
                    var propertyObj = property[i];
                    simplifiedArray.push(propertyObj.fulltext);
                }

                property = simplifiedArray;
            }

            // Rename properties
            if (transformSettings.rename) {
                if (transformSettings.rename[propertyName]) {
                    var newName = transformSettings.rename[propertyName];
                    // http://stackoverflow.com/a/14592469
                    Object.defineProperty(result[index], newName, Object.getOwnPropertyDescriptor(result[index], propertyName));
                    delete result[index][propertyName];
                }
            }
        }

        index += 1;

    }

    return result;
};
