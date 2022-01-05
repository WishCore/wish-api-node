import { Peer } from '../src/peer';
import { App as WishApp } from '../src/sdk';
import { DevelopmentEnvironment } from './deps/development-environment';
import { clear, ensureIdentity } from './deps/util';

const BSON = new (require('bson-buffer'))();

var app1;
var app2;

var identity1;
var identity2;

describe('WishApp Peers', function () {
    let env: DevelopmentEnvironment;

    before(async function() {
        env = await DevelopmentEnvironment.getInstance();
    });

    before(function(done) {
        console.log('before 1');
        app1 = new WishApp({ name: 'PeerTester4', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        app1.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        console.log('before 2');
        app2 = new WishApp({ name: 'PeerTester5', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        app2.once('ready', function() {
            done();
        });
    });

    before(function(done) {
        clear(app1, done);
    });

    before(function(done) {
        clear(app2, done);
    });

    var name1 = 'Alice';
    
    before(function(done) {
        ensureIdentity(app1, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            identity1 = identity;
            done(); 
        });
    });
    
    var name2 = 'Bob';
    
    before(function(done) {
        ensureIdentity(app2, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            identity2 = identity;
            done(); 
        });
    });
    
    before(function(done) {
        app1.request('identity.import', [BSON.serialize(identity2)], function(err, data) {
            done();
        });
    });
    
    before(function(done) {
        app1.request('identity.list', [], function(err, data) {
            console.log('identity.list:', err, data);
            done();
        });
    });
    
    before(function(done) {
        app2.request('identity.import', [BSON.serialize(identity1)], function(err, data) {
            done();
        });
    });
    
    it('should find the remote peer', function(done) {
        this.timeout(5000);

        app1.online((peer: Peer) => {
            if ( Buffer.compare(peer.ruid, identity2.uid) === 0 && peer.protocol === 'test') {
                done();
            }
        });
    });
});