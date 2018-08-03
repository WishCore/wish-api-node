#include "AddonWorker.h"
#include <thread>
#include <chrono>
#include <iostream>
#include "WishGlue.h"
#include "bson_visit.h"
#include "ApiWrapper.h"
#include "bson_visit.h"

using namespace Nan;
using namespace std;

AddonWorker::AddonWorker(Callback *progress) 
: AsyncProgressWorker(progress), progress(progress) {
    _progress = NULL;
    apiWrapper = NULL;
    executeCalled = false;
    
    online_cb = NULL;
    offline_cb = NULL;
}

AddonWorker::~AddonWorker() {
    if (apiWrapper != NULL) {
        apiWrapper->addonDeleted();
    }
}

void
AddonWorker::setWrapper(ApiWrapper* wrapper) {
    apiWrapper = wrapper;
}

void
AddonWorker::sendToNode(Message& message) {
    
    if (_progress == NULL) {
        if (executeCalled) {
            //printf("AddonWorker::sendToNode after addon AddonWorker::Execute has been shut down!!?!\n");
        } else {
            printf("AddonWorker::sendToNode before AddonWorker::Execute has been run!!?!\n");
            bson_visit("AddonWorker::sendToNode before AddonWorker::Execute has been run!!?!", message.msg);
        }
        
        //bson_visit("pre- or postmature  sendToNode", message.msg);
        return;
    }
    
    toNode.write(message);
    _progress->Send(reinterpret_cast<const char*> (&toNode), sizeof (toNode));
}

void
AddonWorker::Execute(const AsyncProgressWorker::ExecutionProgress& progress) {
    _progress = &progress;
    run = true;
    executeCalled = true;

    //std::cout << "AddonWorker::Execute " << this << ", ProgressWorker: " << this->_progress << "\n";
    //printf("AsyncQueueWorker::Execute %s\n", name.c_str());
    
    while ( run ) {
        Message m = fromNode.read();
        
        while (true) {
            int type = 0;
            if (m.name == "kill") {
                //printf("AsyncProgressWorker got the kill signal, waiting for the last injection to be successful.\n");
                run = false;
                _progress = NULL;
                type = 0;
            } else if ( m.name == "wish") {
                type = 1;
            }

            bool success = injectMessage(this, type, m.msg, m.msg_len);

            if(success) { 
                //printf("AsyncQueueWorker::injectMessage %s\n", name.c_str());
                free(m.msg);
                break; 
            } else {
                //printf("Injecting message waiting for my turn. AddonWorker is busy.\n");
                this_thread::sleep_for(chrono::milliseconds(50));
            }
        }
    };

    //printf("AsyncQueueWorker::Execute returning %s\n", name.c_str());
}

void
AddonWorker::HandleProgressCallback(const char *data, size_t size) {
    HandleScope scope;

    //printf("AddonWorker::HandleProgressCallback: drain queue...\n");

    // drain the queue - since we might only get called once for many writes
    std::deque<Message> contents;
    toNode.readAll(contents);
    
    for (Message & msg : contents) {
        v8::Local<v8::Value> argv[] = {
            New<v8::String>(msg.name.c_str()).ToLocalChecked(),
            Nan::NewBuffer((char*) msg.msg, (uint32_t) msg.msg_len).ToLocalChecked()
        };
        
        // TODO: Should catch exception from javascript?
        progress->Call(2, argv);
    }
}