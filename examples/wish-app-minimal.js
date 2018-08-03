//var WishApp = require('wish-api').WishApp;
var WishApp = require('../index.js').WishApp;

function App() {
    var app = new WishApp({ name: process.env.SID || 'MyApp', corePort: parseInt(process.env.CORE) || 9094, protocols: ['test'] });

    app.on('ready', (ready) => {
        app.request('identity.create', ['Aaron S.'], (err, data) => {
            if (err && data.code === 304) { return console.log('Using existing identity'); }
            console.log('Identity created:', err, data);
        });
    });

    app.on('online', (peer) => {
        // console.log('online:', peer);
        app.request('services.send', [peer, new Buffer('Permissionless innovation!')], (err, data) => {
            // sent or not?
        });
    });

    app.on('frame', (peer, data) => {
        // console.log('frame:', peer, data.toString());
        app.request('identity.get', [peer.ruid], function(err, user) {
            console.log(user.alias, '('+peer.rsid.toString('hex').substr(0, 8)+')', 'says:', data.toString());
        });
    });
}

var app = new App();
