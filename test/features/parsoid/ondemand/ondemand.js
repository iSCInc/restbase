'use strict';

// mocha defines to avoid JSHint breakage
/* global describe, it, before, beforeEach, after, afterEach */

// These tests are derived from https://phabricator.wikimedia.org/T75955,
// section 'On-demand generation of HTML and data-parsoid'

var assert = require('../../../utils/assert.js');
var server = require('../../../utils/server.js');
var preq   = require('preq');
var fs     = require('fs');

var revA = '45451075';
var revB = '623616192';
var revC = '645915794';
var title = 'LCX';
var pageUrl = server.config.bucketURL;

describe('on-demand generation of html and data-parsoid', function() {
    this.timeout(20000);

    before(function () { return server.start(); });

    it('should transparently create revision A via Parsoid', function () {
        var slice = server.config.logStream.slice();
        return preq.get({
            uri: pageUrl + '/data-parsoid/' + title + '/' + revA,
        })
        .then(function (res) {
            slice.halt();
            assert.contentType(res,
              'application/json;profile=mediawiki.org/specs/data-parsoid/0.0.1');
            assert.deepEqual(typeof res.body, 'object');
            assert.localRequests(slice, false);
            assert.remoteRequests(slice, true);
        });
    });

    it('should transparently create revision B via Parsoid', function () {
        var slice = server.config.logStream.slice();
        return preq.get({
            uri: pageUrl + '/html/' + title + '/' + revB,
        })
        .then(function (res) {
            slice.halt();
            assert.contentType(res,
              'text/html;profile=mediawiki.org/specs/html/1.0.0');
            assert.deepEqual(typeof res.body, 'string');
            assert.localRequests(slice, false);
            assert.remoteRequests(slice, true);
        });
    });

    it('should retrieve html revision B from storage', function () {
        var slice = server.config.logStream.slice();
        return preq.get({
            uri: pageUrl + '/html/' + title + '/' + revB,
        })
        .then(function (res) {
            slice.halt();
            assert.contentType(res,
              'text/html;profile=mediawiki.org/specs/html/1.0.0');
            assert.deepEqual(typeof res.body, 'string');
            assert.localRequests(slice, true);
            assert.remoteRequests(slice, false);
        });
    });

    it('should retrieve data-parsoid revision B from storage', function () {
        var slice = server.config.logStream.slice();
        return preq.get({
            uri: pageUrl + '/data-parsoid/' + title + '/' + revB,
        })
        .then(function (res) {
            slice.halt();
            assert.contentType(res,
              'application/json;profile=mediawiki.org/specs/data-parsoid/0.0.1');
            assert.deepEqual(typeof res.body, 'object');
            assert.localRequests(slice, true);
            assert.remoteRequests(slice, false);
        });
    });

    it('should pass (stored) html revision B to Parsoid for cache-control:no-cache',
    function () {
        // Start watching for new log entries
        var slice = server.config.logStream.slice();
        return preq.get({
            uri: pageUrl + '/html/' + title + '/' + revB,
            headers: {
                'cache-control': 'no-cache'
            },
        })
        .then(function (res) {
            // Stop watching for new log entries
            slice.halt();
            assert.contentType(res,
              'text/html;profile=mediawiki.org/specs/html/1.0.0');
            assert.deepEqual(typeof res.body, 'string');
            assert.localRequests(slice, false);
            assert.remoteRequests(slice, true);
        });
    });

    it('should pass (stored) revision B content to Parsoid for template update',
    function () {
        // Start watching for new log entries
        var slice = server.config.logStream.slice();
        return preq.get({
            uri: pageUrl + '/data-parsoid/' + title + '/' + revB,
            headers: {
                'cache-control': 'no-cache',
                'x-restbase-mode': 'templates'
            },
        })
        .then(function (res) {
            // Stop watching for new log entries
            slice.halt();
            assert.contentType(res,
              'application/json;profile=mediawiki.org/specs/data-parsoid/0.0.1');
            assert.deepEqual(typeof res.body, 'object');
            assert.localRequests(slice, false);
            assert.remoteRequests(slice, true);
            var parsoidRequest = assert.findParsoidRequest(slice);
            assert.deepEqual(parsoidRequest.method, 'post');
            var prBody = parsoidRequest.body;
            assert.deepEqual(prBody.update, 'templates');
            assert.deepEqual(prBody.original.revid, revB);
            if (!prBody.original.html.body) {
                throw new Error('Missing original html body in parsoid request');
            }
            if (!prBody.original['data-parsoid'].body) {
                throw new Error('Missing original html body in parsoid request');
            }
        });
    });

    it('should pass (stored) revision B content to Parsoid for image update',
    function () {
        // Start watching for new log entries
        var slice = server.config.logStream.slice();
        return preq.get({
            uri: pageUrl + '/html/' + title + '/' + revB,
            headers: {
                'cache-control': 'no-cache',
                'x-restbase-mode': 'images'
            },
        })
        .then(function (res) {
            // Stop watching for new log entries
            slice.halt();
            assert.contentType(res,
              'text/html;profile=mediawiki.org/specs/html/1.0.0');
            if (!/<html/.test(res.body)) {
                throw new Error("Expected html content!");
            }
            assert.localRequests(slice, false);
            assert.remoteRequests(slice, true);
            var parsoidRequest = assert.findParsoidRequest(slice);
            assert.deepEqual(parsoidRequest.method, 'post');
            var prBody = parsoidRequest.body;
            assert.deepEqual(prBody.update, 'images');
            assert.deepEqual(prBody.original.revid, revB);
            if (!prBody.original.html.body) {
                throw new Error('Missing original html body in parsoid request');
            }
            if (!prBody.original['data-parsoid'].body) {
                throw new Error('Missing original html body in parsoid request');
            }
        });
    });

    it('should pass (stored) revision B content to Parsoid for edit update',
    function () {
        // Start watching for new log entries
        var slice = server.config.logStream.slice();
        return preq.get({
            uri: pageUrl + '/html/' + title + '/' + revC,
            headers: {
                'cache-control': 'no-cache',
                'x-restbase-parentrevision': revB
            },
        })
        .then(function (res) {
            // Stop watching for new log entries
            slice.halt();
            assert.contentType(res,
              'text/html;profile=mediawiki.org/specs/html/1.0.0');
            if (!/<html/.test(res.body)) {
                throw new Error("Expected html content!");
            }
            assert.localRequests(slice, false);
            assert.remoteRequests(slice, true);
            var parsoidRequest = assert.findParsoidRequest(slice);
            assert.deepEqual(parsoidRequest.method, 'post');
            var prBody = parsoidRequest.body;
            assert.deepEqual(prBody.update, undefined);
            assert.deepEqual(prBody.previous.revid, revB);
            if (!prBody.previous.html.body) {
                throw new Error('Missing original html body in parsoid request');
            }
            if (!prBody.previous['data-parsoid'].body) {
                throw new Error('Missing original html body in parsoid request');
            }
        });
    });


});
