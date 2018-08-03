#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <stdbool.h>
#include <uv.h> 
#include "bson.h"
#include "bson_visit.h"
#include "wish_core_client.h"
#include "wish_fs.h"
#include "fs_port.h"
#include "rb.h"
#include "utlist.h"

#include <time.h>
#include "wish_platform.h"

char app_login_header[100] = {'W', '.', '\x19'};

void on_write_end(uv_write_t *req, int status);

// TODO: Move this login state to wish_core_client_t
bool login = false;

static wish_core_client_t* wish_core_clients = NULL;

typedef struct {
    uv_write_t req;
    uv_buf_t buf;
} write_req_t;

void free_write_req(uv_write_t *req, int status) {
    write_req_t *wr = (write_req_t*) req;
    free(wr->buf.base);
    free(wr);
}

void send_app_to_core(uint8_t* wsid, const uint8_t* data, size_t len) {
    //printf("wish_core_client.c: send_app_to_core datalen: %lu\n", len);
    //bson_visit("wish_core_client.c:", data);
    
    bson b;
    bson_init_with_data(&b, data);
    
    if (len != bson_size(&b)) {
        printf("wish_core_client.c: send_app_to_core datalen: %i, bailing out!\n", (int) len);
        return;
    }
    
    
    /* Handle the following situations:
     *      -login message 
     *      -normal situation */
    
    /* Snatch the "wsid" field from login */
    if (login == false) {
        bson_iterator it;
        
        if (bson_find_from_buffer(&it, data, "wsid") != BSON_BINDATA) {
            bson_visit("Could not snatch wsid from login", data);
            return;
        }
        
        const uint8_t* login_wsid = bson_iterator_bin_data(&it);
        int login_wsid_len = bson_iterator_bin_len(&it);
        
        if (login_wsid_len == WISH_WSID_LEN) {
            memcpy(wsid, login_wsid, WISH_WSID_LEN);
        } else {
            printf("wsid len mismatch");
        }
        login = true;
    }

    
    wish_core_client_t* client = NULL;
    uv_stream_t* tcp_stream = NULL;
    int c = 0;
    
    DL_FOREACH(wish_core_clients, client) {
        c++;
        if ( memcmp(wsid, client->app->wsid, WISH_WSID_LEN) == 0) {
            tcp_stream = client->tcp_stream;
            break;
        }
    }
    
    if (client == NULL) {
        printf("No connection found to this app. Bail!\n");
        return;
    }
    
    if (client->state != CORE_CLIENT_STATE_CONNECTED) {
        printf("wish_core_client: send_app_to_core: not connected! WishApp::name: %s This message is going to /dev/null\n", client->app->name);
        bson_visit("core_client not connected, this is going to /dev/null", data);
        return;
    }
    
    
    // Write the frame (header+message) to the socket
    char hdr[2];
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
    hdr[0] = len & 0xff;
    hdr[1] = len >> 8;
#else 
    hdr[0] = len >> 8;
    hdr[1] = len & 0xff;
#endif    
    
    int buf_len = 2+len;
    char* buf = malloc(buf_len);
    
    memcpy(buf, &hdr, 2);
    memcpy(buf+2, data, len);
    
    write_req_t* write_req = malloc(sizeof(write_req_t));

    write_req->buf = uv_buf_init( buf, buf_len);

    if (tcp_stream != NULL) {
        uv_write((uv_write_t*)write_req, tcp_stream, &write_req->buf, 1, free_write_req);
    } else {
        printf("send_app_to_core: could not find the stream! checked: %i\n", c);
    }
}


#define log(x) printf("%s\n", x);

void on_connect(uv_connect_t *req, int status);
void on_write_end(uv_write_t *req, int status);
void alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf);
void echo_read(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf);


static void on_close(uv_handle_t* handle) {
    //printf("tcp closed.\n");
    
    wish_core_client_t* client;
    uv_stream_t* stream = NULL;
    
    DL_FOREACH(wish_core_clients, client) {
        if (handle == (uv_handle_t*) client->tcp_stream) {
            stream = client->tcp_stream;
            break;
        }
    }
    
    if (stream == NULL) {
        printf("echo_read: could not find the uv_stream!\n");
        return;
    }

    client->state = CORE_CLIENT_STATE_DISCONNECTED;

    if (client->tcp) { free(client->tcp); }
    
    //if (client->connect_req) { free(client->connect_req); }
    
    client->tcp = NULL;
    client->connect_req = NULL;
}

static void parse(wish_core_client_t* client) {
    int available;
    
again:

    available = ring_buffer_length(client->rb);
    
    switch(client->frame_state) {
        case 0:
            if(available < 2) { /*printf("waiting for header\n");*/ return; }
            // got the frame header
            
            uint8_t hdr_s[2];
            uint8_t* hdr = hdr_s;
            
            ring_buffer_read(client->rb, hdr, 2);
            
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
            client->frame_expect = (((uint16_t)hdr[1]) << 8) + (hdr[0] & 0xff);
#else
            client->frame_expect = (((uint16_t)hdr[1]) & 0xff) + (hdr[0] << 8);
#endif
            client->frame_state = 1;
            goto again;
            break;
        case 1:
            if(available < client->frame_expect) { printf("waiting for more data: available %i expecting %i\n", available, client->frame_expect); return; }
            
            uint8_t data_s[65535];
            uint8_t* data = data_s;
            ring_buffer_read(client->rb, data, client->frame_expect);

            wish_app_determine_handler(client->app, data, client->frame_expect);
            client->frame_expect = 2;
            client->frame_state = 0;
            goto again;
            break;
        default:
            //printf("We expect a frame body with length: %i, but got %i data \n", expect, (int)available);
            break;
    }
}

void echo_read(uv_stream_t *stream, ssize_t nread, const uv_buf_t *buf) {
    wish_core_client_t* client;
    uv_stream_t* tcp_stream = NULL;
    
    DL_FOREACH(wish_core_clients, client) {
        if (stream == client->tcp_stream) {
            tcp_stream = client->tcp_stream;
            break;
        }
    }
    
    if (tcp_stream == NULL) {
        printf("echo_read: could not find the stream!\n");
        return;
    }

    if (nread <= 0) {
        //printf("connection closed\n");
        
        //fprintf(stderr, "error echo_read %i \n", (int)nread);
        uv_read_stop(stream);
        // stream is a subclass of handle
        uv_close((uv_handle_t*)stream, on_close);
        // clear out ring buffer
        ring_buffer_skip(client->rb, 65535);
        // set state to disconnected
        client->state = CORE_CLIENT_STATE_DISCONNECTED;
        // inform wish_app of lost connection to core
        wish_app_connected(client->app, false);

        return;
    }
    
    //printf("echo_read: Found the correct stream %p and app %p\n", tcp_stream, elt->app);
    
    int wrote = ring_buffer_write(client->rb, buf->base, nread);
    
    if (wrote == nread) {
        // all ok, we wrote the whole thing
        parse(client);
    } else {
        printf("Failed to write everything to buffer got %i wrote %i, closing connection.\n", (int)nread, (int)wrote);
        uv_read_stop(stream);
        // stream is a subclass of handle
        uv_close((uv_handle_t*)stream, on_close);
        // clear out ring buffer
        ring_buffer_skip(client->rb, 65535);
        client->state = CORE_CLIENT_STATE_DISCONNECTED;
        wish_app_connected(client->app, false);
    }
    
    if(buf->base != NULL) {
        free(buf->base);
    }
}

void alloc_buffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
  buf->base = malloc(suggested_size);
  buf->len = suggested_size;
}

void on_write_end(uv_write_t *req, int status) {
    if (status == -1) {
        //fprintf(stderr, "error on_write_end");
        return;
    }
    free(req);
}

void on_connect(uv_connect_t *req, int status) {
    wish_core_client_t* client;
    uv_connect_t* tcp_req = NULL;
    
    DL_FOREACH(wish_core_clients, client) {
        if (req == client->connect_req) {
            tcp_req = client->connect_req;
            break;
        }
    }
    
    if (tcp_req == NULL) {
        printf("echo_read: could not find the tcp_req!\n");
        return;
    }

    // register the handler
    client->tcp_stream = req->handle;
    
    if (status < 0) {
        //printf("core_client error on_connect, %i\n", status);
        client->state = CORE_CLIENT_STATE_DISCONNECTED;
        uv_close((uv_handle_t*)req->handle, on_close);
        //free(client->tcp);
        free(client->connect_req);
        
        client->tcp = NULL;
        client->connect_req = NULL;
        return;
    }
    
    //printf("echo_read: Found the correct tcp_req %p and app %p\n", tcp_req, elt->app);

    //printf("We are connected.\n");
    
    client->state = CORE_CLIENT_STATE_CONNECTED;
    
    //printf("Connected to code. rq set to %p\n", rq);
    
    uv_buf_t buf = uv_buf_init(app_login_header, sizeof (app_login_header));
    buf.len = 3;
    
    uv_write_t* write_req = malloc(sizeof(uv_write_t));

    int buf_count = 1;
    uv_write(write_req, client->tcp_stream, &buf, buf_count, on_write_end);
    uv_read_start(client->tcp_stream, alloc_buffer, echo_read);
    
    free(req);
    /* Note: call to wish_app_login is hidden inside wish_app_connected() */
    wish_app_connected(client->app, true);
}

static void wish_core_client_connect(wish_core_client_t* client) {
    if (client->tcp != NULL) { printf("Core client tcp connection was not cleaned up on connection attempt! Memory leaking?!\n"); }
    if (client->connect_req != NULL) { printf("Core client connect_req was not cleaned up on connection attempt! Memory leaking?!\n"); }
    
    // Initialize the core tcp connection
    client->tcp = wish_platform_malloc(sizeof(uv_tcp_t));
    memset(client->tcp, 0, sizeof(uv_tcp_t));
    uv_tcp_init(client->loop, client->tcp);

    struct sockaddr_in req_addr;
    if (client->app->port != 0) {
        //printf("got a port %d\n", client->app->port);
        uv_ip4_addr("127.0.0.1", client->app->port, &req_addr);
    } else {
        //printf("using default port\n");
        uv_ip4_addr("127.0.0.1", 9094, &req_addr);
    }

    client->connect_req = wish_platform_malloc(sizeof(uv_connect_t));
    memset(client->connect_req, 0, sizeof(uv_connect_t));
    
    //printf("connect_req pointer %p", client->connect_req);

    client->state = CORE_CLIENT_STATE_CONNECTING;
    uv_tcp_connect(client->connect_req, client->tcp, (const struct sockaddr*) &req_addr, on_connect);
}

static void periodic(uv_timer_t* handle) {
    
    wish_core_client_t* client;
    uv_timer_t* timeout = NULL;
    
    DL_FOREACH(wish_core_clients, client) {
        if (handle == client->timeout) {
            timeout = client->timeout;
            break;
        }
    }
    
    if (timeout != NULL) {
        //printf("echo_read: Found the correct tcp_req %p and app %p\n", timeout, elt->app);
        wish_app_periodic(client->app);
    } else {
        printf("echo_read: could not find the tcp_req!\n");
        return;
    }
    
    //printf("Try consuming data from above.\n");
    
    switch (client->state) {
        case CORE_CLIENT_STATE_INITIAL:
            wish_core_client_connect(client);
            break;
        case CORE_CLIENT_STATE_DISCONNECTED:
            
            if(client->wait_counter >= 150) {
                //printf("Reconnect.\n");
                client->wait_counter = 0;
                wish_core_client_connect(client);
            } else {
                client->wait_counter++;
            }
            
            break;
        case CORE_CLIENT_STATE_CONNECTING:
            //printf("Is connecting doing nothing\n");
            break;
        case CORE_CLIENT_STATE_CONNECTED:
            //printf("Is connected doing nothing\n");
            break;
    }
}

void wish_core_client_init(wish_app_t *wish_app) {
    wish_core_client_t* client = wish_platform_malloc(sizeof(wish_core_client_t));
    memset(client, 0, sizeof(wish_core_client_t));
    
    DL_APPEND(wish_core_clients, client);
    
    client->state = CORE_CLIENT_STATE_INITIAL;
    client->app = wish_app;
    
    int len = 60*1024;
    //int len = 1024;
    char* inbuf = wish_platform_malloc(len);
    client->rb = wish_platform_malloc(sizeof(ring_buffer_t));
    ring_buffer_init(client->rb, inbuf, len);

    // Initialize libuv loop
    client->loop = wish_platform_malloc(sizeof(uv_loop_t));
    uv_loop_init(client->loop);

    client->timeout = wish_platform_malloc(sizeof(uv_timer_t));
    
    uv_timer_init(client->loop, client->timeout);

    uv_timer_start(client->timeout, periodic, 100, 20);
    
    uv_run(client->loop, UV_RUN_DEFAULT);
    //printf("This loop is now terminated. App: %p\n", client->app);
    
    wish_core_client_t* elt;
    wish_core_client_t* tmp;
    
    DL_FOREACH_SAFE(wish_core_clients, elt, tmp) {
        if (elt == client) {
            DL_DELETE(wish_core_clients, elt);
        }
    }
    
    wish_platform_free(client);
}

void wish_core_client_close(wish_app_t* app) {
    wish_core_client_t* elt;
    DL_FOREACH(wish_core_clients, elt) {
        if (app == elt->app) {
            //printf("Stopping loop %p %s.\n", elt, app->name);
            uv_stop(elt->loop);
            break;
        }
    }
}
