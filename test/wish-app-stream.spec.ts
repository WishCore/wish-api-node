import { App as WishApp } from '../src/sdk';
import { DevelopmentEnvironment } from './deps/development-environment';
import { clear, ensureIdentity } from './deps/util';
var inspect = require('util').inspect;


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

    before('setup PeerTester6', function(done) {
        app1 = new WishApp({ name: 'PeerTester6', protocols: ['test'], corePort: 9095 }); // , protocols: [] });

        app1.once('ready', function() {
            done();
        });
    });
    
    before('setup PeerTester7', function(done) {
        app2 = new WishApp({ name: 'PeerTester7', protocols: ['test'], corePort: 9096 }); // , protocols: [] });

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
        app2.request('identity.import', [BSON.serialize(identity1)], function(err, data) {
            done();
        });
    });
    
    var sendersPeer;
    
    before('should find the remote peer', function(done) {
        this.timeout(5000);
        //console.log('Testing peer');
        app1.onlineCb = function(peer) {
            //console.log('Peer:', peer);
            if ( Buffer.compare(peer.ruid, identity2.uid) === 0 && peer.protocol === 'test') {
                sendersPeer = peer;
                done();
                done = () => {};
            }
        };
        //done();
    });
    
    it('should stream 1 MiB of data', function(done) {
        var Client = require('wish-rpc').Client;
        var Server = require('wish-rpc').Server;
        var inspect = require("util").inspect;
        var bson = require('bson-buffer');
        var BSON = new bson();

        var client = new Client(function(data) { app1.send(sendersPeer, BSON.serialize(data)); });

        function File() {
            var self = this;
            var inBytesCount = 0;

            var server = new Server({
                _send: {},
                send: function(req, res) {
                    //console.log('receiving file:', req.args[0], 'size', req.args[1]);

                    this.data = function(data) {
                        inBytesCount += data.length;
                        //process.stdout.write('.');
                        res.emit(data.length);
                    };

                    this.end = function() {
                        //console.log('last chunk of ', req.args[0], 'received');
                        if (inBytesCount === req.args[1]) {
                            done();
                        } else {
                            done(new Error('Did not receive the expected amount of data' + inBytesCount + ' vs ' + req.args[1]));
                        }
                        
                    };

                    res.emit('ok');
                }
            });

            app1.onlineCb = function(peer) {
                // peer is online
            };

            app1.offlineCb = function(peer) {
                // peer is offline
            };

            app1.frameCb = function(peer, data) {
                var msg = BSON.deserialize(data);

                if (msg.op || msg.push || msg.end) {
                    server.parse(msg, function(data) { app1.send(peer, BSON.serialize(data)); }, {});
                } else {
                    client.messageReceived(msg);
                    return;
                }
            };

            app2.frameCb = function(peer, data) {
                var msg = BSON.deserialize(data);

                if (msg.op || msg.push || msg.end) {
                    server.parse(msg, function(data) { app2.send(peer, BSON.serialize(data)); }, {});
                } else {
                    //client.messageReceived(msg);
                    return;
                }
            };

            this.send = function(bytesCount) {
                var outBytesCount = 0;
                    
                var id = client.request('send', ['theFile.dmg', bytesCount], function(err, data) {

                    if(data ==='ok') {
                        //console.log('got signal to start sending data');
                    }
                    
                    if (outBytesCount < bytesCount) {
                        // all data not sent yet, send next chunk
                        var chunkSize = Math.min(16*1024, bytesCount-outBytesCount);

                        //console.log('sending', chunkSize, ' bytes', outBytesCount, bytesCount);

                        client.send(id, Buffer.alloc(chunkSize, 0));
                        outBytesCount += chunkSize;
                    } else {
                        // all data is sent, end the stream
                        client.end(id);
                    }
                });
            };
        }

        var file = new File();        
        file.send(86*1024);
    });
});