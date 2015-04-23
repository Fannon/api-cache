/**
 * Simplifies the ASK JSON result format to a more concise JSON notation
 *
 * @param {{}}  obj
 *
 * @returns {{}}
 */
exports.simpifiedAsk = function(obj) {

    var result = {};

    for (var personName in obj.query.results) {

        var personObj = obj.query.results[personName];

        result[personName] = personObj.printouts;

        for (var propertyName in result[personName]) {

            var property = result[personName][propertyName];

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
