"use strict";

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');

module.exports = function () { return new ShutdownSequence(); };
module.exports.create = module.exports;

function ShutdownSequence() {
	EventEmitter.call(this);

	this.fns = [];
	this.headOrder = [];
	this.tailOrder = [];

	// Convenience shortcut to allow promise.then(shutdown.shutdown)
	this.shutdown = this.shutdown.bind(this);
}
util.inherits(ShutdownSequence, EventEmitter);

ShutdownSequence.prototype.add = function (name, fn) {
	if (arguments.length === 1) {
		fn = name;
		name = name.name || ('unnamed-shutdown-function-' + this.fns.length);
	}
	this.fns.push({ index: this.fns.length, fn: fn, name: name });
};

ShutdownSequence.prototype.setHeadOrder = function (ordering) {
	if (!Array.isArray(ordering))
		ordering = Array.prototype.slice.call(arguments);
	this.headOrder = ordering;
};
ShutdownSequence.prototype.setTailOrder = function (ordering) {
	if (!Array.isArray(ordering))
		ordering = Array.prototype.slice.call(arguments);
	this.tailOrder = ordering;
};

ShutdownSequence.prototype.shutdown = function () {
	var self = this;

	// Ordering:
	// All functions in headOrder, other functions, all functions in tailOrder
	// In the head & tail orderings, functions are ordered by the index within
	// the respective array. If two functions have the same name, order by the
	// reverse registration order.
	// For functions not in the orderings, always use the reverse registration
	// order, and completely ignore names
	this.fns.sort(function (a, b) {
		// Resolve name conflicts in head & tail; for other functions, this is
		// also the correct ordering.
		if (a.name === b.name)
			return b.index - a.index;

		return getSectionIndex(self, a) - getSectionIndex(self, b)		// If they're in different sections, compare section index
			|| arrayCompare(self.headOrder, a, b)						// If both are in head, compare their order
			|| arrayCompare(self.tailOrder, a, b)						// If both are in tail, compare their order
			|| b.index - a.index;										// Otherwise, use reverse insertion order
	});

	this.emit('shutdownStarted');
	return this.fns.reduce(function (promise, fn) {
		return promise
			.then(function () { return fn.fn(); })
			.fail(function (err) { self.emit("error", err, fn.name); });
	}, Q.resolve())
		.then(function () { self.emit('shutdownFinished'); });
};

/**
 * Compares the position of two objects within an array of names.
 */
function arrayCompare(arr, a, b) {
	// Since we already know that the names are distinct, these will only be equal if they're both -1.
	var ai = arr.indexOf(a.name);
	var bi = arr.indexOf(b.name);

	return ai - bi;
}
/**
 * Gets which section an object belongs in.
 * 
 * @returns -1 if object is in head array, zero if it's in neither, or 1 if it's in tail array.
 */
function getSectionIndex(s, obj) {
	var inHead = s.headOrder.indexOf(obj.name) >= 0;
	var inTail = s.tailOrder.indexOf(obj.name) >= 0;

	if (inHead)
		return -1;
	if (inTail)
		return 1;
	return 0;
}