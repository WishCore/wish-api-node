import { App as WishApp } from '../src/sdk';
import { DevelopmentEnvironment } from './deps/development-environment';
import { ensureIdentity } from './deps/util';
var inspect = require('util').inspect;

describe('Wish Local Discovery', function () {
    let env: DevelopmentEnvironment;

    var app;
    var name = 'Alice';
    var aliceIdentity;

    before(async function() {
        env = await DevelopmentEnvironment.getInstance();
    });
    before(function (done) {
        app = new WishApp({ name: ' 3', corePort: 9095 });

        app.on('ready', () => {
            ensureIdentity(app, name, function(err, identity) {
                if (err) { done(new Error('util.js: Could not ensure identity.')); }
                aliceIdentity = identity;
                done(); 
            });
        });
    });

    it('should get a localdiscovery signal', function(done) {
        this.timeout(10000);
        app.request('signals', [], function (err, data) {
            if (err) { return done(new Error('Signals returned error.')); }
            
            if(data[0] && data[0] === 'ok') {
                app.request('wld.announce', [], function(err, data) {
                    if (err) { if (data.code === 8) { done(new Error('wld.announce does not exist')); } }
                    
                    console.log("Announce returned:", err, data);
                });
            }
            
            if (data[0] && data[0] === 'localDiscovery') {
                done();
            }
            
            //done(new Error('Not the expected error.'));
        });
    });

    xit('should disconnect all connections', function(done) {
        app.request('connections.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            if(data.length === 0) {
                return done(new Error('Expected there to be at least one connection, before testing disconnectAll'));
            }
            
            app.request('connections.disconnectAll', [], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }
                
                if (data !== true) { return done(new Error('expected "true", but got unexpected return value: '+inspect(data))); }

                app.request('connections.list', [], function(err, data) {
                    if (err) { return done(new Error(inspect(data))); }
                    
                    if (data.length > 0) {
                        return done(new Error('Not expecting a connection to be present.'));
                    }
                    
                    done();
                });
            });
        });
    });
});
