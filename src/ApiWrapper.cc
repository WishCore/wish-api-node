#include "ApiWrapper.h"
#include "WishGlue.h"
#include <iostream>

using namespace std;
using namespace Nan;

Nan::Persistent<v8::Function> ApiWrapper::constructor;

ApiWrapper::ApiWrapper(AddonWorker* worker) {
    this->worker = worker;
    worker->setWrapper(this);
}

ApiWrapper::~ApiWrapper() {
    cout << "Destroying ApiWrapper" << "\n";
}

void
ApiWrapper::addonDeleted() {
    //cout << "ApiWrapper lost the actual instance (Deleted by Nan).\n";
    worker = NULL;
}

void
ApiWrapper::New(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    //info.GetReturnValue().Set(Nan::New("world").ToLocalChecked());

    if (info.IsConstructCall()) {

        Callback *data_callback = new Callback(info[0].As<v8::Function>());
        v8::Local<v8::Object> options = info[1].As<v8::Object>();
        
        AddonWorker* worker = new AddonWorker(data_callback);
        
        if (options->IsObject()) {
            v8::Local<v8::Value> _nodeName = options->Get(Nan::New<v8::String>("name").ToLocalChecked());
            v8::Local<v8::Value> _protocol = options->Get(Nan::New<v8::String>("protocols").ToLocalChecked());
            v8::Local<v8::Value> _coreIp = options->Get(Nan::New<v8::String>("coreIp").ToLocalChecked());
            v8::Local<v8::Value> _corePort = options->Get(Nan::New<v8::String>("corePort").ToLocalChecked());
            v8::Local<v8::Value> _apiType = options->Get(Nan::New<v8::String>("type").ToLocalChecked());

            if (_nodeName->IsString()) {
                worker->name = string(*v8::String::Utf8Value(_nodeName->ToString()));
            }

            if (_protocol->IsString()) {
                worker->protocol = string(*v8::String::Utf8Value(_protocol->ToString()));
            }

            if (_coreIp->IsString()) {
                worker->coreIp = string(*v8::String::Utf8Value(_coreIp->ToString()));
                //cout << "4. a) ApiWrapper constructor: opts: " << coreIp << "\n";
            } else {
                //cout << "4. b) ApiWrapper constructor: opts.core not string\n";
            }

            if (_corePort->IsNumber()) {
                worker->corePort = (int) _corePort->NumberValue();
            }

            if (_apiType->IsNumber()) {
                worker->apiType = (int) _apiType->NumberValue();
            }
        }

        // Start the C library
        addon_start(worker);

        ApiWrapper *apiWrapper = new ApiWrapper(worker);
        
        apiWrapper->Wrap(info.This());
        info.GetReturnValue().Set(info.This());

        // start the worker
        AsyncQueueWorker(apiWrapper->worker);
        //data_callback->Call(0, 0);
        //printf("AsyncQueueWorker started\n");
    }
}

void
ApiWrapper::request(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    
    if (info.Length() != 2) {
        Nan::ThrowTypeError("Wrong number of arguments");
        return;
    }

    if (!info[0]->IsString()) {
        Nan::ThrowTypeError("Wrong arguments");
        return;
    }

    if (!info[1]->ToObject()->IsUint8Array()) {
        Nan::ThrowTypeError("Argument 2 is not a Buffer");
        return;
    }
    
    v8::String::Utf8Value name(info[0]->ToString());
    
    uint8_t* buf = (uint8_t*) node::Buffer::Data(info[1]->ToObject());
    int buf_len = node::Buffer::Length(info[1]->ToObject());
    ApiWrapper* obj = Nan::ObjectWrap::Unwrap<ApiWrapper>(info.Holder());
     
    if ( obj->worker == NULL ) {
        //printf("Someone is trying to make requests while the whole thing is already shut down. Ditched. ApiWrapper %p\n", obj);
        return;
    }
    
    obj->worker->fromNode.write(Message(*name, buf, buf_len));
}

void
ApiWrapper::Init(v8::Local<v8::Object> exports) {
    addon_init();
    
    v8::Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(ApiWrapper::New);
    tpl->SetClassName(Nan::New("WishApi").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(2);

    SetPrototypeMethod(tpl, "request", request);

    constructor.Reset(tpl->GetFunction());
    
    exports->Set(Nan::New("WishApi").ToLocalChecked(), tpl->GetFunction());
}

NODE_MODULE(WishApi, ApiWrapper::Init)
