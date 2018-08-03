#pragma once

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Wish app C99 implementation.
 *
 */

#include "wish_rpc.h"
#include "wish_protocol.h"
#include "wish_acl.h"
//#include "wish_identity.h"

/* Number of Wish applications supported */
#ifndef NUM_WISH_APPS
#define NUM_WISH_APPS   10
#endif  //NUM_WISH_APPS

#define WISH_APP_INDEX_VACANT  0
    
#define WISH_APP_NAME_MAX_LEN 32
#define WISH_APP_MAX_PROTOCOLS 2
#define WISH_APP_MAX_PERMISSIONS 2

#ifndef WISH_ID_LEN
#define WISH_ID_LEN 32
#define WISH_WSID_LEN 32
#define WISH_WHID_LEN 32
#endif
    
struct wish_app_context;
    
typedef void (*ready_cb)(struct wish_app_context* app, bool ready);
typedef void (*wish_app_periodic_cb)(void* ctx);
    
typedef struct wish_app_context {
    /* This field is used for identifying occupied/vacant app contexts.
     * Has value false if context is vacant */
    bool occupied;
    bool ready_state;
    /* The service IF of the app */
    uint8_t wsid[WISH_ID_LEN];
    /* The hostid of the Wish core the app is connected to. */
    uint8_t whid[WISH_WHID_LEN];
    /* Ready signal */
    ready_cb ready;
    /* Ready signal */
    wish_app_periodic_cb periodic;
    void* periodic_ctx;
    /* Human readable name of the app */
    char name[WISH_APP_NAME_MAX_LEN];
    wish_protocol_handler_t *protocols[WISH_APP_MAX_PROTOCOLS];
    size_t num_protocols;
    wish_permission_t *permissions[WISH_APP_MAX_PERMISSIONS];
    size_t num_permissions;
    // client for accessing core api
    rpc_client rpc_client;
    uint16_t port;
} wish_app_t;

typedef struct {
    wish_app_t* app;
    wish_protocol_peer_t* peer;
} app_peer_t;

void wish_app_on_frame(wish_app_t *app, const uint8_t *frame, size_t frame_len);

void wish_app_on_peer(wish_app_t *app, const uint8_t *peer_info_doc);

void wish_app_on_ready(wish_app_t *app);

void wish_app_determine_handler(wish_app_t *app, const uint8_t *data, size_t len);

/** 
 * Create a wish application
 *
 * Returns 0 on success
 */
wish_app_t * wish_app_create(const char *app_name);

void wish_app_login(wish_app_t *app);

void wish_app_add_protocol(wish_app_t *app, wish_protocol_handler_t *handler);

/**
 * Disconnect a Wish app from the core, release app context
 * @param app pointer to app context object to be deleted
 */
void wish_app_destroy(wish_app_t *app);

/**
 * Get WSID correspoinding to app_name, storing it to array wsid
 *
 * Returns 0 on success
 */
int wish_app_get_wsid(const char* app_name, uint8_t wsid[WISH_ID_LEN]);


wish_app_t * wish_app_find_by_wsid(uint8_t wsid[WISH_WSID_LEN]);

/** 
 * Function for sending an App RPC frame. 
 * 
 * Function for sending an App RPC frame. Will in turn call send_app_to_core in the service IPC layer
 *
 * @param app pointer to relevant Wish App struct
 * @param peer the peer (in BSON format)
 * @param peer_len the length of the peer doc
 * @param buffer the data to be sent down
 * @param len the length of the buffer
 * @param cb an optional callback which will be invoked when the RPC
 * request over Service IPC layer to core returns. Can be NULL if no cb
 * is needed
 * @param cb_context pointer to context for callback function
 * @return the RPC id of the message send downwards, or 0 for an error
 */
rpc_id wish_app_send_context(wish_app_t *app, wish_protocol_peer_t* peer, const uint8_t *buffer, size_t len, rpc_client_callback cb, void* cb_context);

/** 
 * Function for sending an App RPC frame. 
 * 
 * Same as wish_app_send_context but with context set to NULL
 */
rpc_id wish_app_send(wish_app_t *app, wish_protocol_peer_t* peer, const uint8_t *buffer, size_t len, rpc_client_callback cb);

rpc_id wish_app_core(wish_app_t *app, const char* op, const uint8_t *buffer, size_t len, rpc_client_callback cb);

rpc_client_req* wish_app_request(wish_app_t* app, bson* req, rpc_client_callback cb, void* cb_ctx);

void wish_app_cancel(wish_app_t *app, rpc_client_req *req);

void wish_app_send_app_to_core(wish_app_t* app, const uint8_t* frame, int frame_len);

wish_protocol_peer_t* wish_protocol_peer_find(wish_protocol_handler_t* protocol, wish_protocol_peer_t* peer);

// Ensures peer exists if not found, or returns NULL on failure
wish_protocol_peer_t* wish_protocol_peer_from_bson(wish_protocol_handler_t* protocol, const uint8_t* buf);

// Tries to find peer but returns NULL on failure
wish_protocol_peer_t* wish_protocol_peer_find_from_bson(wish_protocol_handler_t* protocol, const uint8_t* buf);

bool wish_protocol_peer_populate_from_bson(wish_protocol_peer_t* peer, const uint8_t* buf);

/** 
 * Callback function to be called when the Wish App has successfully connected to the local core.
 * 
 * @param app the Wish app context
 * @param connected true to signal that the connection to core is established, and false to signal that app lost connection to the core.
 */
void wish_app_connected(wish_app_t *app, bool connected);

void wish_app_periodic(wish_app_t *app);

rpc_client_req* wish_app_request_passthru(wish_app_t* app, const bson* req, rpc_client_callback cb, void* ctx);

void wish_core_request_cancel(wish_app_t* app, int id);

#ifdef __cplusplus
}
#endif

