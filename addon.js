if (!process.version.substr(0, 3) === 'v6.') {
    console.log('WishApi is a native addon, which is not supported by Node.js version ('+process.version+'), requires v6.x.x., tested on v6.9.2.');
    process.exit(1);
}

var EventEmitter = require("events").EventEmitter;
var inherits = require('util').inherits;

var bson = require('bson-buffer');
var BSON = new bson();

var WishApi = null;

if (process.env.DEBUG) {
    WishApi = require('./build/Debug/WishApi.node').WishApi;
} else {
    if(process.env.BUILD) {
        WishApi = require('./build/Release/WishApi.node').WishApi;
    } else {
        var arch = process.arch;
        var platform = process.platform;
        var version = process.version;
        
        try {
            WishApi = require('./bin/WishApi-'+arch+'-'+platform+'.node').WishApi;
        } catch (e) {
            console.log('WishApi is a native addon, which is not supported or currently not bundled for your arch/platform or version ('+arch+'/'+platform+' '+version+').', e);
            process.exit(1);
        }
    }
}

// instances of native Addons, used for shutting them down
var instances = [];

function Addon(opts) {
    //console.log('new Addon instance:', opts.name);
    var self = this;
    this.sharedRequestId = 0;
    
    var id = this.sharedRequestId;
    
    /*setInterval(function() {
        if (id !== self.sharedRequestId) {
            console.log('sharedRequestId changed:', self.sharedRequestId, opts.name);
            id = self.sharedRequestId;
        }
    }, 50);
    */
    
    this.api = new WishApi(function (event, data) {
        if (!event && !data) {
            // seems to be HandleOKCallback from nan
            // nan.h: AsyncWorker::WorkComplete(): callback->Call(0, NULL);
            return;
        }
        
        if (event === 'done') {
            // Streaming worker is done and has shut down
            return;
        }

        var msg = null;

        try {
            msg = BSON.deserialize(data);
        } catch(e) {
            return console.log('Warning! Non BSON message from plugin.', arguments, event, data);
        }
        
        if (event === 'ready') {
            self.emit('ready', msg.ready, msg.sid);
            if (typeof self.readyCb === 'function') { self.readyCb(msg.ready, msg.sid); }
            
            return;
        }

        if (event === 'online') {
            msg.peer.online = true;
            self.emit('online', msg.peer);
            if (typeof self.onlineCb === 'function') { self.onlineCb(msg.peer); }
            
            return;
        }

        if (event === 'offline') {
            self.emit('offline', msg.peer);
            if (typeof self.offlineCb === 'function') { self.offlineCb(msg.peer); }

            return;
        }

        if (event === 'frame') {
            msg.peer.online = true;
            self.emit('frame', msg.peer, msg.frame);
            if (typeof self.frameCb === 'function') { self.frameCb(msg.peer, msg.frame); }

            return;
        }

        if (event === 'wish') {
            self.emit('wish', msg);
            return;
        }
        
        console.log('Received an event from native addon which was unhandled.', event, msg);
    }, opts);
    
    // keep track of instances to shut them down on exit.
    instances.push(this);
}

inherits(Addon, EventEmitter);

Addon.prototype.request = function(target, payload) {
    if (Buffer.isBuffer(payload)) { console.log('A buffer was sent to Addon', new Error().stack); }
    if (typeof payload === 'object') { payload = BSON.serialize(payload); }

    this.api.request(target, payload);
};

Addon.prototype.shutdown = function() {
    this.request("kill", { kill: true });
};


process.on('exit', function() {
    for(var i in instances) {
        try { instances[i].shutdown(); } catch(e) { console.log('WishApi instance '+i+' shutdown() command failed.', e); }
    }
});


module.exports.Addon = Addon;
