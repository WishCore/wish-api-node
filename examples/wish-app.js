//var WishApp = require('wish-api').WishApp;
var WishApp = require('../index.js').WishApp;
var bson = require('bson-buffer');
var BSON = new bson();

var pkg = require("./../package.json");

"use strict";

console.log("\x1b[33mWelcome to Wish CLI v" + pkg.version + '\x1b[39m');

function App() {
    var self = this;
    var app = new WishApp({ name: process.env.SID || 'MyApp', corePort: parseInt(process.env.CORE) || 9094, protocols: ['test'] });

    var connectTimeout = setTimeout(() => { console.log('Timeout connecting to Wish Core.'); process.exit(0); }, 5000);
    
    var registered = false;

    app.on('ready', function(ready) {
        if (!ready) { console.log('\nDisconnected from Wish Core.'); if(self.repl) { self.repl.displayPrompt(); } return; }

        if(registered) { return; }
        registered = true;

        clearTimeout(connectTimeout);
            
        app.request('version', [], function(err, version) {
            if(err) { return; };
            
            console.log("\x1b[32mConnected to Wish Core "+version+"\x1b[39m");
        });
        
        app.request('methods', [], function(err, methods) {
          // api methods available
        });
    });

    app.on('online', function(peer) {
        console.log('online:', peer);
        app.request('services.send', [peer, BSON.serialize({ all: 'cool' })], () => {});
    });

    app.on('frame', (peer, data) => {
        console.log('frame:', peer, BSON.deserialize(data));
    });
}

var app = new App();
