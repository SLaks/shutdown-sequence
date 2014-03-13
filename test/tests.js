"use strict";

var Q = require('q');
var assert = require('assert');
require('mocha-as-promised')();

var ShutdownSequence = require('../shutdown-sequence.js');

describe('ShutdownSequence', function () {
	it('should execute callbacks in reverse order', function () {
		var shutdown = new ShutdownSequence();

		var results = [];

		shutdown.add(results.push.bind(results, 3));
		shutdown.add(results.push.bind(results, 2));
		shutdown.add(results.push.bind(results, 1));

		return shutdown.shutdown().then(function () {
			assert.deepEqual(results, [1, 2, 3]);
		});
	});
	it('should execute callbacks with explicit ordering', function () {
		var shutdown = new ShutdownSequence();

		var results = [];

		shutdown.add(results.push.bind(results, 6));
		shutdown.add(results.push.bind(results, 5));
		shutdown.add(results.push.bind(results, 4));

		shutdown.add('a', results.push.bind(results, 1));

		shutdown.add('b', results.push.bind(results, 3));
		shutdown.add('b', results.push.bind(results, 2));

		shutdown.add('y', results.push.bind(results, 9));
		shutdown.add('x', results.push.bind(results, 7));
		shutdown.add('y', results.push.bind(results, 8));

		shutdown.setHeadOrder('a', 'b');
		shutdown.setTailOrder('x', 'y');

		return shutdown.shutdown().then(function () {
			assert.deepEqual(results, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
		});
	});
	it('should wait for promises from callbacks', function () {
		var shutdown = new ShutdownSequence();

		var results = [];

		shutdown.add(results.push.bind(results, 2));
		shutdown.add(function () { return Q.delay(200).then(function () { results.push(1); }); });

		return shutdown.shutdown().then(function () {
			assert.deepEqual(results, [1, 2]);
		});
	});
	it('should report errors & proceed with shutdown', function () {
		var shutdown = new ShutdownSequence();

		var results = [];

		shutdown.add(results.push.bind(results, 3));
		shutdown.add('func2', function () { throw 2; });
		shutdown.add('func1', Q.reject.bind(null, 1));

		shutdown.addListener('error', function (err, name) {
			assert.equal(name, "func" + err);
			results.push(err);
		});

		return shutdown.shutdown().then(function () {
			assert.deepEqual(results, [1, 2, 3]);
		});
	});
});