{
    "targets": [
        {
            "target_name": "WishApi",
            "sources": [ "src/AddonWorker.cc", "src/Message.cc", "src/ApiWrapper.cc", "src/WishGlue.cc",
                "deps/wish/app.c",
                "deps/wish_app/wish_app.c",
                "deps/wish_app/wish_protocol.c",
                "deps/wish_app_deps/rb.c",
                "deps/wish_app_deps/wish_core_client.c",
                "deps/wish_app_deps/wish_debug.c",
                "deps/wish_app_deps/wish_platform.c",
                "deps/wish_app_deps/wish_fs.c",
                "deps/wish_app_deps/wish_utils.c",
                "deps/wish_app_port_deps/unix/fs_port.c",
                "deps/wish-rpc-c99/src/wish_rpc.c",
                "deps/bson/bson.c",
                "deps/bson/bson_visit.c",
                "deps/bson/encoding.c",
                "deps/mbedtls/library/sha256.c",
            ],
            "cflags": [ "-O2" ],
            "cflags_cc": [ "-O2" ],
            "ldflags": [ ],
            "include_dirs" : [
                "src",
                "<!(node -e \"require('nan')\")",
                "deps/wish_app_deps",
                "deps/wish_app_port_deps/unix",
                "deps/wish_app",
                "deps/wish",
                "deps/bson",
                "deps/wish-rpc-c99/src",
                "deps/mbedtls/include"
            ],
            "conditions": [
                [ 'OS!="win"', {
                    "cflags+": [ "-std=gnu89" ],
                    "cflags_cc+": [ "-std=c++11" ],
                }],
                [ 'OS=="mac"', {
                    "xcode_settings": {
                      "OTHER_CPLUSPLUSFLAGS" : [ "-std=c++11" ],
                      "OTHER_LDFLAGS": [ ],
                      "MACOSX_DEPLOYMENT_TARGET": "10.11"
                    },
                }],
            ],
        }
    ],
}
