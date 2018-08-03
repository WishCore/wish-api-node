var Addon = require('./addon.js').Addon;
var WishAppInner = require('./wish-app-inner.js').WishAppInner;

function copy(that) {
    var copy = {};
    
    for(var i in that) { copy[i] = that[i]; }
    
    return copy;
}

function WishApp(opts) {
    if (typeof opts === 'string') { opts = { name: opts }; }
    if (!opts) { opts = {}; }
    opts = copy(opts);    
    
    // force type to WishApp
    opts.type = 4;

    if ( Array.isArray(opts.protocols) ) {
        if (opts.protocols.length === 1) {
            opts.protocols =  opts.protocols[0];
        } else if (opts.protocols.length === 0) {
            delete opts.protocols;
        } else {
            throw new Error('WishApp requires 0 or one protocols (multiple not yet supported)');
        }
    } else if (!opts.protocols) {
        // fine
    } else {
        throw new Error('WishApp protocols must be array or non-existing.');
    }

    if (process.env.CORE && opts.corePort) { console.log('Failed setting WishCore port from env, already set in options!'); }
    if (process.env.CORE && !opts.corePort) { opts.corePort = parseInt(process.env.CORE); }
    
    var addon = new Addon(opts);

    var wish = new WishAppInner(addon);
    
    wish.opts = opts;
    
    return wish;
}

module.exports = {
    WishApp: WishApp };


