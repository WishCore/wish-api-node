
function clear(addon, done) {
    
    function removeIdentity(done) {
        addon.request('identity.list', [], function(err, data) {
            if (err) { return done(new Error(inspect(data))); }
            
            //console.log("removeIdentity has data", data);
            
            var c = 0;
            var t = 0;
            
            for(var i in data) { c++; t++; }            
            
            for(var i in data) {
                (function (uid) {
                    addon.request('identity.remove', [uid], function(err, data) {
                        if (err) { return done(new Error(inspect(data))); }

                        //console.log("Deleted.", err, data);

                        c--;

                        if(c===0) { done(); }
                    });
                })(data[i].uid);
            }
            
            if (t===0) {
                //console.log("Identity does not exist.");
                done();
            }
        });
    }
    
    removeIdentity(function(err) {
        if (err) { return done(err); }
                
        done();
    });
}

function ensureIdentity(addon, alias, cb) {
    var wish = typeof addon.wish === 'object' ? addon.wish : addon;
    
    //console.log("should create identity: getting identity list");
    wish.request('identity.create', [alias], function(err, data) {
        //console.log("identity.create('"+alias+"'): cb", err, data);
        cb(null, data);
    });
}

module.exports = {
    clear: clear,
    ensureIdentity: ensureIdentity };
