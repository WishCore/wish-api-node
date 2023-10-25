import { App as WishApp } from '../src/sdk';
import { DevelopmentEnvironment } from './deps/development-environment';
import { clear, ensureIdentity } from './deps/util';

const BSON = new (require('bson-buffer'))();

var app1;

var identity1;

xdescribe('WishApp Peers', function () {
    let env: DevelopmentEnvironment;

    before(async function() {
        env = await DevelopmentEnvironment.getInstance();
    });

    before('setup PeerTester3', function(done) {
        app1 = new WishApp({ name: 'PeerTester3', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        app1.once('ready', function() {
            done();
        });
    });

    before(function(done) {
        clear(app1, done);
    });

    var name1 = 'Alice';
    
    before(function(done) {
        ensureIdentity(app1, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            identity1 = identity;
            done(); 
        });
    });
    
    it('should stream 1 MiB of data', function(done) {
        var t0 = Date.now();
        var cnt = 0;
        
        function req() {
            app1.request('identity.list', [], (err, data) => {
                cnt++;
                if (Date.now() - t0 > 1000) { console.log('Request count', cnt); return done(); }

                setTimeout(req, 0);
            });
            //app1.request('identity.list', [], (err, data) => { cnt++; });
        }
        
        req();
    });
});