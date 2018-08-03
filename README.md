# Wish Api

A native node.js plugin for building Wish applications. Currently working with Linux x86_64 and nodejs v6.x only. To get it working you need to run a Wish Core on the same host.

## Install 

```sh
npm install wish-api
```

## Example

```js
var WishApp = require('wish-api').WishApp;

function App() {
    var app = new WishApp({ 
        name: process.env.SID || 'MyApp',
        corePort: parseInt(process.env.CORE) || 9094,
        protocols: ['test'] });

    app.on('ready', (ready) => {
        app.request('identity.create', ['John Doe'], (err, data) => {
            if (err && data.code === 304) { return console.log('Using existing identity'); }
            console.log('Identity created:', err, data);
        });
    });

    app.on('online', (peer) => {
        app.request('services.send', [peer, new Buffer('Permissionless innovation!')], (err, data) => {
            // sent or not?
        });
    });

    app.on('frame', (peer, data) => {
        app.request('identity.get', [peer.ruid], function(err, user) {
            console.log(user.alias, 'says:', data.toString());
        });
    });
}

var app = new App();
```
