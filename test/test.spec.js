/*global describe,it*/
'use strict';

//////////////////////////////////////////
// REQUIREMENTS                         //
//////////////////////////////////////////

var expect = require('chai').expect;

var cli = require('../cli.js');


//////////////////////////////////////////
// TESTS                                //
//////////////////////////////////////////

describe('CLI ', function() {

    it('has a version number', function() {
        expect(cli.settings.version).to.contain('.');
    });

});
