#shutdown-sequence
[![build status](https://secure.travis-ci.org/SLaks/shutdown-sequence.png)](http://travis-ci.org/SLaks/shutdown-sequence)

`shutdown-sequence` allows composable applications to automatically shut down any services that were created during the application's lifetime.  It is intended to be used with IoC / dependency injection, where the application entry point does not know which services will be created and need to be shut down.

##Usage
To use, call `require('shutdown-sequence').create()` in the entry-point application to create a shutdown manager, and export it in your IoC framework.  Components that need to run shutdown logic should import this `shutdown` instance and call `add(function)` to add a shutdown method.  If the shutdown is asynchronous, it can return a promise, and the sequence will wait for the promise to resolve before continuing.

By default, shutdown callbacks are called in the reverse order that they were registered.  This way, if component A uses component B, A will not be shutdown until after B is, so that it does not end up using a destroyed dependency.

If your application has further requirements for shutdown ordering, you can call `setHeadOrder("A", "B")` or `setTailOrder("A", "B")` to set an ordering of shutdown methods to call before or after all other shutdown methods, respectively.  The names correspond to the intrinsic names of the shutdown functions; alternatively, you can explicitly pass a name before the function when calling `add()`.

If any errors are thrown during shutdown (or if a shutdown method returns a failed promise), the shutdown object's `error` event will be raised, passing the error object and the name of the failed shutdown method.  The event will be raised during the shutdown sequence, and subsequent shutdown methods will still run afterwards.  (if there are no handlers for the `error` event, `EventEmitter`'s default behavior will [terminate the process](http://nodejs.org/api/events.html#events_class_events_eventemitter), unless in a domain)

The `shutdownStarted` and `shutdownFinished` events will also be raised before and after a shutdown, respectively.

##Example

_app.js_
```js
var shutdown = require('shutdown-sequence').create();

shutdown.setTailOrder("log");

// Pass shutdown to your IoC container
```

_logger.js_
```js
module.exports = function(shutdown) {
	shutdown.add("log", function() {  console.log("3"); });
};
```

_database.js_
```js
module.exports = function(shutdown) {
	shutdown.add(function() { console.log("2"); });
	shutdown.add(function() { console.log("1"); });
};
```

Calling `shutdown.shutdown()` after creating both modules will print `1 2 3`.