var fs = require('fs');
var path = require('path');

exports.read = function(dir) {

    var returnObj = {
        queries: {},
        querySettings: {},
        masterSettings: {}
    };

    var fileList = fs.readdirSync(dir);

    if (fileList && fileList.length > 0) {

        for (var i = 0; i < fileList.length; i++) {
            var fileName = fileList[i];
            var strippedFileName;

            if (fileName.indexOf('.ask') > -1) {

                // Read .ask files (containing the queries)
                strippedFileName = fileName.split('.ask').join('');
                returnObj.queries[strippedFileName] = fs.readFileSync(path.join(dir, fileName)).toString();

            } else if (fileName.indexOf('.json') > -1) {

                // Read .json files (containing the settings)
                strippedFileName = fileName.split('.json').join('');

                try {
                    var fileContent = fs.readFileSync(path.join(dir, fileName));
                    var obj = JSON.parse(fileContent.toString());

                    if (fileName === 'settings.json') {
                        returnObj.masterSettings = obj;
                    } else {
                        returnObj.querySettings[strippedFileName] = obj;
                    }

                } catch(e) {
                    console.log(' [E] Could not read / parse ' + fileName + '!');
                    console.dir(e);
                    return false;
                }
            }
        }
    }

    return returnObj;
};
