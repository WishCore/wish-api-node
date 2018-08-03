#include "AddonWorker.h"
#include "WishGlue.h"
#include "app.h"
#include "wish_core_client.h"
#include "wish_platform.h"
#include "wish_fs.h"
#include "fs_port.h"
#include "bson_visit.h"
#include "bson.h"
#include "utlist.h"

#include <pthread.h>
#include <stdio.h>
#include <string>

using namespace std;

typedef struct input_buffer_s {
    int len;
    int type;
    AddonWorker* worker;
    char* data;
    struct input_buffer_s* next;
} input_buf;

struct wish_app_core_opt {
    AddonWorker* worker;
    pthread_t* thread;
    bool node_api_plugin_kill;
    app_t* app;
    wish_app_t* wish_app;
    char* protocol;
    char* name;
    char* ip;
    int port;
    input_buf* input_queue;
    struct wish_app_core_opt* next;
};

struct wish_app_core_opt* wish_app_core_opts;

pthread_mutex_t comm_mutex = PTHREAD_MUTEX_INITIALIZER;

static AddonWorker* instance_by_app(app_t* app) {
    if (app == NULL) { return NULL; }
    
    struct wish_app_core_opt* opts;
    
    LL_FOREACH(wish_app_core_opts, opts) {
        if(opts->app == app) {
            return opts->worker;
            break;
        }
    }
    
    printf("instance_by_app: Failed finding worker instance. Pointer is: %p\n", app);
    
    return NULL;
}

static AddonWorker* instance_by_wish_app(wish_app_t* app) {
    if (app == NULL) { return NULL; }
    
    struct wish_app_core_opt* opts;
    
    LL_FOREACH(wish_app_core_opts, opts) {
        if(opts->wish_app == app) {
            return opts->worker;
            break;
        }
    }
    
    printf("instance_by_app: Failed finding worker instance. Pointer is: %p\n", app);
    
    return NULL;
}

bool injectMessage(AddonWorker* worker, int type, uint8_t *msg, int len) {
    
    if (pthread_mutex_trylock(&comm_mutex)) {
        //printf("Unsuccessful injection lock.\n");
        return false;
    }

    struct wish_app_core_opt* app;

    bool found = false;
    
    LL_FOREACH(wish_app_core_opts, app) {
        if (app->worker == worker) {
            // got it!
            found = true;
            break;
        }
    }
    
    if (!found) { printf("injectMessage: App not found! Bailing!\n"); pthread_mutex_unlock(&comm_mutex); return false; }

    input_buf* in = (input_buf*) calloc(1, sizeof(input_buf));
    
    char* data = (char*) malloc(len);
    
    memcpy(data, msg, len);
    
    in->data = data;
    in->type = type;
    in->worker = worker;
    in->len = len;
    
    LL_APPEND(app->input_queue, in);

    // release lock   
    pthread_mutex_unlock(&comm_mutex);
    return true;
}

static void wish_response_cb(rpc_client_req* req, void* ctx, const uint8_t* data, size_t data_len) {
    if(ctx == NULL) {
        if (req->passthru_ctx2 != NULL) {
            ctx = req->passthru_ctx2;
        } else {
            //printf("NULL ctx in response going towards node.js. ctx %p\n", ctx);
            //bson_visit("NULL ctx request:", data);
            return;
        }
    }
    
    Message msg("wish", (uint8_t*) data, data_len);
    
    AddonWorker* worker = static_cast<AddonWorker*>(ctx);
    worker->sendToNode(msg);
}

static void online(app_t* app, wish_protocol_peer_t* peer) {
    AddonWorker* worker = instance_by_app(app);
    
    if (worker == NULL) {
        printf("Failed finding worker instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_peer(&bs, "peer", peer);
    bson_finish(&bs);
    
    if (bs.err) { printf("Error producing bson!! %d\n", bs.err); }

    Message msg("online", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    //printf("online to worker: %s\n", worker->name.c_str());
    worker->sendToNode(msg);
    bson_destroy(&bs);
}

static void offline(app_t* app, wish_protocol_peer_t* peer) {
    AddonWorker* worker = instance_by_app(app);
    
    if (worker == NULL) {
        printf("Failed finding worker instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_peer(&bs, "peer", peer);
    bson_finish(&bs);

    Message msg("offline", (uint8_t*) bson_data(&bs), bson_size(&bs));

    //printf("offline to worker: %s\n", worker->name.c_str());
    worker->sendToNode(msg);
    bson_destroy(&bs);
}

static void frame(app_t* app, const uint8_t* payload, size_t payload_len, wish_protocol_peer_t* peer) {
    AddonWorker* worker = instance_by_app(app);
    
    if (worker == NULL) {
        printf("Failed finding worker instance to call write... bailing out!\n");
        return;
    }
    
    bson bs;
    bson_init(&bs);
    bson_append_binary(&bs, "frame", (char*) payload, payload_len);
    bson_append_peer(&bs, "peer", peer);
    bson_finish(&bs);

    if (bs.err) { printf("Error producing bson!! %d\n", bs.err); }
    
    Message msg("frame", (uint8_t*) bson_data(&bs), bson_size(&bs));
    
    //printf("frame to worker: %s\n", worker->name.c_str());
    worker->sendToNode(msg);
    bson_destroy(&bs);
}


static void wish_app_ready_cb(wish_app_t* app, bool ready) {
    AddonWorker* worker = instance_by_wish_app(app);
    
    if (worker == NULL) { WISHDEBUG(LOG_CRITICAL, "wish_app_ready_cb: worker not found!! Cannot continue!"); return; }
    
    bson bs;
    bson_init(&bs);
    bson_append_bool(&bs, "ready", ready);
    bson_append_binary(&bs, "sid", (const char*)&app->wsid, WISH_WSID_LEN);
    bson_finish(&bs);

    Message msg("ready", (uint8_t*) bson_data(&bs), bson_size(&bs));

    worker->sendToNode(msg);
    bson_destroy(&bs);
}

static void wish_periodic_cb_impl(void* ctx) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ctx;

    if (opts->app == NULL) {
        WISHDEBUG(LOG_CRITICAL, "There is no WishApp in wish_periodic here! Broken? opts->app: %p", opts->app);
        return;
    }
    
    if (pthread_mutex_trylock(&comm_mutex)) {
        return;
    }
    
    if(opts->node_api_plugin_kill) {
        //printf("killing loop from within.\n");
        wish_core_client_close(opts->wish_app);
        pthread_mutex_unlock(&comm_mutex);
        return;
    }
    
    input_buf* msg = opts->input_queue;
    
    // check if we can inject a new message, i.e input buffer is consumed by worker
    while (msg != NULL) {

        if(opts->worker != msg->worker) {
            printf("This message is NOT for this instance of worker!! this: %p was for %p\n", opts->worker, msg->worker);
            pthread_mutex_unlock(&comm_mutex);
            return;
        }

        bson_iterator it;
        bson_find_from_buffer(&it, msg->data, "kill");
        
        if (bson_iterator_type(&it) == BSON_BOOL) {
            //printf("kill is bool\n");
            if (bson_iterator_bool(&it)) {
                //printf("kill is true\n");
                opts->node_api_plugin_kill = true;
            }
        } else {
            bson bs;
            bson_init_with_data(&bs, msg->data);
            
            if(msg->type == 1) { // WISH
                bson_iterator it;
                bson_find(&it, &bs, "cancel");

                if (bson_iterator_type(&it) == BSON_INT) {
                    //printf("wish_cancel %i\n", bson_iterator_int(&it));
                    wish_core_request_cancel(opts->wish_app, bson_iterator_int(&it));
                    goto consume_and_unlock;
                }

                wish_app_request_passthru(opts->wish_app, &bs, wish_response_cb, opts->worker);
            }
        }
        
consume_and_unlock:
        
        LL_DELETE(opts->input_queue, msg);
        free(msg->data);
        free(msg);
        
        // TODO: What does this do?
        msg = opts->input_queue;
        
    }

    // release lock   
    pthread_mutex_unlock(&comm_mutex);
}

static void* setupWishApi(void* ptr) {
    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) ptr;
    
    // name used for WishApp
    char* name = (char*) (opts->name != NULL ? opts->name : "WishApi");
    
    app_t* app = opts->app;

    wish_app_t* wish_app = wish_app_create((char*)name);
    
    if (wish_app == NULL) {
        printf("Failed creating wish app\n");
        return NULL;
    }
    
    wish_app->ready = wish_app_ready_cb;
    
    opts->wish_app = wish_app;
    
    if (opts->protocol && strnlen(opts->protocol, 1) != 0) {
        //printf("we have a protocol here.... %s\n", opts->protocol);
        memcpy(app->protocol.protocol_name, opts->protocol, WISH_PROTOCOL_NAME_MAX_LEN);
        wish_app_add_protocol(wish_app, &app->protocol);
    }
    
    app->app = wish_app;

    app->online = online;
    app->offline = offline;
    app->frame = frame;
    
    wish_app->port = opts->port;

    wish_app->periodic = wish_periodic_cb_impl;
    wish_app->periodic_ctx = opts;

    wish_core_client_init(wish_app);
    
    //printf("libuv loop closed and thread ended (setupWishApi)\n");

    // when core_client returns clean up 
    opts->worker = NULL;
    opts->app = NULL;
    
    free(opts->name);
    free(opts->protocol);
    free(opts->ip);
    
    free(opts);
    
    return NULL;
}

void addon_init() {
    // Initialize wish_platform functions
    wish_platform_set_malloc(malloc);
    wish_platform_set_realloc(realloc);
    wish_platform_set_free(free);
    srandom(time(NULL));
    wish_platform_set_rng(random);
    wish_platform_set_vprintf(vprintf);
    wish_platform_set_vsprintf(vsprintf);    
    
    wish_fs_set_open(my_fs_open);
    wish_fs_set_read(my_fs_read);
    wish_fs_set_write(my_fs_write);
    wish_fs_set_lseek(my_fs_lseek);
    wish_fs_set_close(my_fs_close);
    wish_fs_set_rename(my_fs_rename);
    wish_fs_set_remove(my_fs_remove);    
}

void addon_start(AddonWorker* worker) {
    int iret;

    struct wish_app_core_opt* opts = (struct wish_app_core_opt*) wish_platform_malloc(sizeof(struct wish_app_core_opt));
    memset(opts, 0, sizeof(struct wish_app_core_opt));
    
    LL_PREPEND(wish_app_core_opts, opts);
    
    opts->worker = worker;
    
    opts->protocol = strdup(worker->protocol.c_str());
    
    opts->name = strdup(worker->name.c_str());
    opts->ip = strdup(worker->coreIp.c_str());
    opts->port = worker->corePort;
    
    /* Create independent threads each of which will execute function */
    
    // FIXME This is never freed!
    opts->thread = (pthread_t*) wish_platform_malloc(sizeof(pthread_t));
    memset(opts->thread, 0, sizeof(pthread_t));

    if ( worker->apiType == AddonWorker::ApiType::ApiTypeWish ) {
        opts->app = app_init();
        
        if(opts->app == NULL) {
            printf("Failed app_init in addon_start.\n");
            exit(EXIT_FAILURE);
            return;
        }
        
        iret = pthread_create(opts->thread, NULL, setupWishApi, (void*) opts);
    } else {
        printf("addon_start received unrecognized type %i, (expecting 4)\n", worker->apiType);
        exit(EXIT_FAILURE);
    }
    
    if (iret) {
        fprintf(stderr, "Error - pthread_create() return code: %d\n", iret);
        exit(EXIT_FAILURE);
    }
}
