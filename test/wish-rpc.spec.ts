import { App as WishApp } from '../src/sdk';
import { DevelopmentEnvironment } from './deps/development-environment';
var inspect = require('util').inspect;

describe('Wish RPC', function () {
    let env: DevelopmentEnvironment;
    var app;

    before(async function() {
        env = await DevelopmentEnvironment.getInstance();
    });
    
    before(function (done) {
        app = new WishApp({ name: 'Generic UI 4', corePort: 9095 });

        app.on('ready', () => {
            done();
        });
    });

    it('should get error on undefined command', function(done) {
        app.request('this-does-not-exist', [], function (err, data) {
            if(err) { if (data.code === 8) { return done(); } }
            
            done(new Error('Not the expected error. '+inspect(data)));
        });
    });

    it('should get error on invalid parameters', function(done) {
        app.request('identity.export', [], function (err, data) {
            if(err) { if (data.code === 8) { return done(); } }
            
            done(new Error('Not the expected error. '+inspect(data)));
        });
    });
    
    it('should get version string', function(done) {
        app.request('version', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("wish-core version string:", err, data);
            done();
        });
    });
    
    it('should get signals', function(done) {
        var signalsId = app.request('signals', [], function(err, data) { 
            if (err) { return done(new Error(inspect(data))); }
            if (data[0] !== 'ok') { return; }
            
            console.log("wish-core signals:", err, data, signalsId);
            app.cancel(signalsId);
            done();
        });
    });
});
