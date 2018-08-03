
var Plugin = {
    emits: ['online', 'offline', 'frame', 'wish', 'done'],
    request: fn(['kill', 'wish'], BSON(args))
};

var WishApp = {
    type: 4,
    emits: ['ready', 'online', 'offline', 'frame', 'wish'],
    request: fn(op, args, cb), // 'wish', BSON({ op, args, id })
    requestBare: fn(op, args, cbBare),
    requestCancel: fn(id),
    cancel: fn(id),
    send: fn(peer, payload),
    broadcast: fn(payload),
    disconnect: fn(),
    shutdown: fn()
};
