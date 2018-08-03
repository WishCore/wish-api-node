#pragma once

#include "nan.h"
#include "Message.h"
#include "PCQueue.h"
#include <string>

class ApiWrapper;

class AddonWorker : public Nan::AsyncProgressWorker {
public:

    AddonWorker(Nan::Callback *data);

    ~AddonWorker();
    
    enum ApiType {
        ApiTypeWish = 4
    };
    
    void sendToNode(Message& message);
    
    void Execute(const Nan::AsyncProgressWorker::ExecutionProgress& progress);

    void HandleProgressCallback(const char *data, size_t size);
    
    void setWrapper(ApiWrapper*);

    PCQueue<Message> fromNode;

    int apiType = ApiType::ApiTypeWish;
    std::string protocol = "";
    std::string name = "Node";
    std::string coreIp = "127.0.0.1";
    int corePort = 9094;

    void* online_cb;
    void* offline_cb;
    
private:
    bool run;
    bool executeCalled;
    const Nan::AsyncProgressWorker::ExecutionProgress* _progress;
    Nan::Callback *progress;
    PCQueue<Message> toNode;
    ApiWrapper* apiWrapper;
};
