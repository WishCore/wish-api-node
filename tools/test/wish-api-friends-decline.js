var WishApp = require('../../index.js').WishApp;
var Sandboxed = require('../../index.js').Sandboxed;

var BsonParser = require('bson-buffer');
var BSON = new BsonParser();
var util = require('./deps/util.js');

var inspect = require('util').inspect;

// run ../node_modules/mocha/bin/mocha test/wish-friends.js

describe('Wish Friends', function () {
    var app;
    var bob;
    var aliceIdentity;
    var aliceAlias = 'Alice';
    var bobAlias = 'Bob';
    var bobIdentity;
    var bobWldEntry;
    
    before('setup manager', function (done) {
        app = new WishApp({ name: 'FriendManager', corePort: 9095 });

        app.on('ready', function() {
            console.log('done here...');
            done();
        });
    });

    it('should get bob', function(done) {
        bob = new WishApp({ name: 'BobsFriendManager', coreIp: '127.0.0.1', corePort: 9096 });

        bob.on('ready', function(err, data) {
            done();
            
            // subscribe to signals from core and automatically accept friend request from Alice
            bob.wish.request('signals', [], function(err, data) {
                if (data[0] && data[0] === 'friendRequest') {
                    bob.wish.request('identity.friendRequestList', [], function(err, data) {
                        for (var i in data) {
                            if( Buffer.compare(data[i].luid, bobIdentity.uid) === 0 
                                    && Buffer.compare(data[i].ruid, aliceIdentity.uid) === 0 ) 
                            {
                                console.log("declining request.");
                                bob.wish.request('identity.friendRequestDecline', [data[i].luid, data[i].ruid], function(err, data) {
                                    console.log("Declined friend request from Alice:", err, data);
                                });
                                break;
                            }
                        }
                    });
                }
            });
            
        });
    });



    before(function(done) {
        app1 = new WishApp({ name: 'PeerTester1', protocols: ['test'], corePort: 9095 }); // , protocols: [] });
        app1.once('ready', () => { done(); });
    });
    
    before(function(done) {
        app2 = new WishApp({ name: 'PeerTester2', protocols: ['test'], corePort: 9096 }); // , protocols: [] });
        app2.once('ready', () => { done(); });
    });

    before(function(done) {
        util.clear(app1, done);
    });

    before(function(done) {
        util.clear(app2, done);
    });
    
    before('wait', function(done) { setTimeout(done, 200); })

    var name1 = 'Alice';
    
    before(function(done) {
        util.ensureIdentity(app1, name1, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            aliceIdentity = identity;
            done(); 
        });
    });
    
    var name2 = 'Bob';
    
    before(function(done) {
        util.ensureIdentity(app2, name2, function(err, identity) {
            if (err) { done(new Error('util.js: Could not ensure identity.')); }
            bobIdentity = identity;
            done(); 
        });
    });

    
    
    
    it('should find alice in wld', function(done) {
        this.timeout(35000);
        
        function poll() {
            app.request('wld.list', [], function(err, data) {
                if (err) { return done(new Error(inspect(data))); }

                //console.log("Bobs wld", err, data);
                
                for (var i in data) {
                    if ( Buffer.compare(data[i].ruid, bobIdentity.uid) === 0) {
                        bobWldEntry = data[i];
                        done();
                        return;
                    }
                }
                
                setTimeout(poll, 1000);
            });
        };
        
        setTimeout(poll, 100);
    });
    
    it('should be declined friendRequest sent to Bob', function(done) {
        //console.log("Friend request params:", [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid]);
        app.request('wld.friendRequest', [aliceIdentity.uid, bobWldEntry.ruid, bobWldEntry.rhid], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            console.log("Bobs cert", err, data);
            
            setTimeout(function() {
                app.request('identity.list', [], function(err, data) {
                    if (err) { return done(new Error(inspect(data))); }

                    //console.log("Alice's identity.list", err,data);
                    done();
                });
            }, 250);
        });
    });
});
