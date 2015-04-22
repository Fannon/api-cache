#!/usr/bin/env node
'use strict';
//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var request = require('request-promise');
var express = require('express');


//////////////////////////////////////////
// VARIABLES                            //
//////////////////////////////////////////

var startTime = (new Date()).getTime();

var finalObject;

// Access:
// http://localhost:1337/raw/<queryname>.json                             -> Original ASK result
// http://localhost:1337/raw/<queryname>/<pageName>.json                 -> Original ASK result
// http://localhost:1337/processed/<queryname>.json                    -> Simplified ASK result
// http://localhost:1337/processed/<queryname>/<pageName>.json      -> Simplified ASK result


//////////////////////////////////////////
// Fetch DATA                           //
//////////////////////////////////////////


var transformRawJson = function(obj) {

    var result = {};

    for (var personName in obj.results) {
        var personObj = obj.results[personName];
        console.log(personName);
        result[personName] = personObj.printouts;

        for (var propertyName in result[personName]) {

            var property = result[personName][propertyName];
            console.log(' - ' + propertyName);

            if (property[0] && typeof property[0] === 'object' && property[0].fulltext) {

                var simplifiedArray = [];

                for (var i = 0; i < property.length; i++) {
                    var propertyObj = property[i];
                        console.log();
                        console.log(propertyObj);
                        console.log();
                        simplifiedArray.push(propertyObj.fulltext)

                };

                result[personName][propertyName] = simplifiedArray;

            }
        }

    }

    return result;
};


request('http://10.248.8.1/wiki/index.php/Spezial:Semantische_Suche/-5B-5Bcategory:Person-5D-5D/-3F%3DLink-23/-3FAnrede/-3FName/-3FVorname/-3FAdresse/-3FKontaktFestnetz/-3FKontaktMobil/-3FKontaktEmail/-3FKontaktFax/-3FPersonenKategorie/-3F-2DMitarbeiter/-3F-2DMandant/-3FDatevBeraterNummer/format%3Djson/limit%3D64000/mainlabel%3DLink/searchlabel%3DDownload-20as-20JSON/prettyprint%3Dtrue/offset%3D0')
    .then(function(result) {

        var json = JSON.parse(result);

        finalObject = transformRawJson(json);
    })
    .catch(console.error);



//////////////////////////////////////////
// Web Server                           //
//////////////////////////////////////////


var webserver = express();

webserver.get('/', function (req, res) {
    res.send('Hello World')
});

webserver.get('/Personen.json', function (req, res) {
    res.json(finalObject)
});

webserver.listen(1337);
