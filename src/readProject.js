var fs = require('fs');
var path = require('path');

/**
 * Currently supported
 *  * ASK requests
 *
 * @param dir
 * @returns {*}
 */
exports.read = function(dir) {

    var returnObj = {
        requests: {},
        requestSettings: {},
        masterSettings: {}
    };

    var fileList = fs.readdirSync(dir);

    if (fileList && fileList.length > 0) {

        for (var i = 0; i < fileList.length; i++) {
            var fileName = fileList[i];

            if (fileName.indexOf('.ask') > -1) {

                // Read .ask files (containing the requests)
                returnObj.requests[fileName] = fs.readFileSync(path.join(dir, fileName)).toString();

            } else if (fileName.indexOf('.json') > -1) {

                if (fileName === 'sftp-config.json') {
                    continue;
                }

                // Read .json files (containing the settings)
                var strippedFileName = fileName.split('.json').join('');

                try {
                    var fileContent = fs.readFileSync(path.join(dir, fileName));
                    var obj = JSON.parse(fileContent.toString());

                    if (fileName === 'settings.json') {
                        returnObj.masterSettings = obj;
                    } else {
                        obj.name = strippedFileName;
                        returnObj.requestSettings[strippedFileName] = obj;
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
