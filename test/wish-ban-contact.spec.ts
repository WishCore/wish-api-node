import { App as WishApp } from '../src/sdk';
import { DevelopmentEnvironment } from './deps/development-environment';
import { clear, ensureIdentity } from './deps/util';

var name1 = 'Alice';
var name2 = 'Bob';

var aliceApp;
var bobApp;

var aliceIdentity;
var bobIdentity;

var bobWldEntry;

/*
 * Test that contacts can be banned
 * 
 * @returns {undefined}
 */

describe('Wish test ban contact', function () {
    let env: DevelopmentEnvironment;
    var aliceRelayList;
    var newRelayServer = '127.0.0.1:40000';

    before(async function() {
        env = await DevelopmentEnvironment.getInstance();
    });

    before(function(done) {
        console.log('before 1');
         aliceApp = new WishApp({ name: 'app1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

         aliceApp.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        console.log('before 2');
        bobApp = new WishApp({ name: 'app2', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

        bobApp.once('ready', function() {
            done();
        });
    });
    
    before(function(done) {
        clear( aliceApp, done);
    });
    
    before(function(done) {
        clear(bobApp, done);
    }); 
    
    before(function(done) {
        ensureIdentity(aliceApp, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            aliceIdentity = identity;
            done(); 
        });
    });
      
    before(function(done) {
        ensureIdentity( bobApp, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            bobIdentity = identity;
            
            done(); 
        });
    });
    
    
     it('Bob friend requests alice', function(done) {
        this.timeout(1000);
        
        
        /* Start listening for friend request signals on Alice */
        var id = aliceApp.request('signals', [], function(err, data) {
           if (err) { done(new Error('Could not setup signals')); return; }
           console.log('Alice signal:', data);
           
           if (data[0] === 'friendRequest') {
               aliceApp.request('identity.friendRequestAccept', [aliceIdentity.uid, bobIdentity.uid], function (err, data) {
                   if (err) { return; } // done(new Error('Could not wld.friend requests accept.')); console.log('failed accepting:', data); done = () => {}; return; }
                   console.log("Accepting friend req");
                   //aliceApp.cancel(id);
                   aliceApp.request('identity.permissions', [bobIdentity.uid, { banned: true }], function (err, data) {
                       if (err) { done(new Error('Could not identity.permissions')); return; }
                       console.log("perm 1: ", data)
                       done();
                   });
                   
               });
               
               
           }
        });
        
        bobApp.request('wld.list', [], function(err, result) {
            if (err) { done(new Error('Could not wld.list.')); }
            
            for (const item in result) {
                //console.log("Discovery:", result[item]['ruid'], aliceIdentity.uid);

                if (Buffer.compare(result[item]['ruid'], aliceIdentity.uid) === 0) {
                    bobApp.request("wld.friendRequest", [bobIdentity.uid, result[item]['ruid'], result[item]['rhid']], function (err, data) {
                        if (err) { done(new Error('Could not wld.friendRequest.')); }
                    });
                    
                }
            }

        });
    });
    
    it('Bob should be connect and connect:false should be seen in meta', function(done) {
        this.timeout(80000);
        setTimeout(function() {
            bobApp.request('identity.get', [aliceIdentity.uid], function (err, data) {
                if (err) { console.log("Could not identity.get", err); return }
                console.log("identity.get", data)
                if (data.meta.connect === false) {
                    done();
                }
            });
            
        }, 10000);
                   
    });
    
    it('Alice removes banned: true', function(done) {
        aliceApp.request('identity.permissions', [bobIdentity.uid, { banned: null }], function (err, data) {
            if (err) { done(new Error('Could not identity.permissions')); return; }
            console.log("perm 2: ", data)
            
            var sigId = bobApp.request('signals', [], function(err, data) {
                console.log("Bob signals: ", data)
                aliceApp.request('wld.clear', [], function (err, data) {
                    if (err) { done(new Error('Could not wld clear')); return; }
                });
                aliceApp.request('connections.checkConnections', [], function (err, data) {
                    if (err) { done(new Error('Could not check connections')); return; }
                    console.log('Check connections OK');
                    done();
                    bobApp.cancel(sigId);
                });
            });
        }); 
    });

    it('Bob should be connect and should be not be seen in meta', function(done) {
        this.timeout(11000);
        setTimeout(function() {
            bobApp.request('identity.get', [aliceIdentity.uid], function (err, data) {
                if (err) { done(new Error('Could not identity.get')); return; }
                console.log("Bob identity.get alice", data);
                if (typeof data.meta.connect === 'undefined') {
                    done();
                }
            });
        }, 10000);
    });
});