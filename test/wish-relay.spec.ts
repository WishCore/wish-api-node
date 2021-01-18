import { App as WishApp } from '../src/sdk';
var inspect = require('util').inspect;

describe('Wish Relay', function () {
    var app;
    
    before(function (done) {
        app = new WishApp({ name: 'Generic UI', corePort: 9095 });

        app.on('ready', () => {
            done();
        });
    });

    it('should wait for relays to connect', function(done) { setTimeout(done, 300); });
    
    it('should get list of relays', function(done) {
        app.request('relay.list', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("wish-core relays:", err, data);
            done();
        });
    });
    
    it('should add relay server', function(done) {
        var host = '127.0.0.1:37008';
        app.request('relay.add', [host], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            app.request('relay.list', [], function(err, data) { 
                if (err) { return done(new Error(inspect(data))); }

                var found = false;

                for (var i in data) {
                    if (data[i].host === host) {
                        found = true;
                        break;
                    }
                }

                if (found) {
                    done();
                } else {
                    done(new Error('Could not find the added host in relay list.'));
                }
            });
        });
    });
    
    it('should delete relay server', function(done) {
        var host = '127.0.0.1:37008';
        app.request('relay.remove', [host], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            app.request('relay.list', [], function(err, data) { 
                if (err) { return done(new Error(inspect(data))); }

                var found = false;

                for (var i in data) {
                    if (data[i].host === host) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    done();
                } else {
                    console.log('Found the removed host in relay list.');
                    done(new Error('Found the removed host in relay list. '+inspect(data)));
                }
            });
        });
    });
});
