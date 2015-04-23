/**
 * Simplifies the ASK JSON result format to a more concise JSON notation
 *
 * @param {{}}  obj
 *
 * @returns {{}}
 */
exports.simplifiedAsk = function(obj) {

    var result = {};

    for (var personName in obj.query.results) {

        var personObj = obj.query.results[personName];

        result[personName] = personObj.printouts;

        for (var propertyName in result[personName]) {

            var property = result[personName][propertyName];

            // Simplify / flatten page objects to arrays
            if (property[0] && typeof property[0] === 'object' && property[0].fulltext) {

                var simplifiedArray = [];

                for (var i = 0; i < property.length; i++) {
                    var propertyObj = property[i];
                    simplifiedArray.push(propertyObj.fulltext);
                }

                result[personName][propertyName] = simplifiedArray;
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
exports.simplifiedAskCollection = function(obj) {

    var result = [];
    var index = 0;

    for (var personName in obj.query.results) {

        result[index] = obj.query.results[personName].printouts;
        result[index]['$id'] = [personName];

        for (var propertyName in result[index]) {

            var property = result[index][propertyName];

            // Simplify / flatten page objects to arrays
            if (property[0] && typeof property[0] === 'object' && property[0].fulltext) {

                var simplifiedArray = [];

                for (var i = 0; i < property.length; i++) {
                    var propertyObj = property[i];
                    simplifiedArray.push(propertyObj.fulltext);
                }

                result[index][propertyName] = simplifiedArray;
            }
        }

        index += 1;

    }

    return result;
};
