#include "ApiWrapper.h"
#include "WishGlue.h"
#include <iostream>

using namespace std;

using Nan::Get;
using Nan::Callback;
using Nan::MaybeLocal;
using Nan::Utf8String;

using v8::Local;
using v8::Value;
using v8::Object;
using v8::String;
using v8::Context;
using v8::Isolate;
using v8::Function;
using v8::FunctionTemplate;

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
ApiWrapper::New(const Nan::FunctionCallbackInfo<Value>& info) {
    Local<Context> context = info.GetIsolate()->GetCurrentContext();
    Isolate* isolate = info.GetIsolate();
    //info.GetReturnValue().Set(Nan::New("world").ToLocalChecked());

    if (info.IsConstructCall()) {
        Callback *data_callback = new Callback(info[0].As<Function>());
        Local<Object> options = info[1]->ToObject(context).ToLocalChecked();
        
        AddonWorker* worker = new AddonWorker(data_callback);
        
        if (options->IsObject()) {
            Local<Value> _nodeName = options->Get(Nan::New("name").ToLocalChecked());
            Local<Value> _protocol = options->Get(Nan::New("protocols").ToLocalChecked());
            Local<Value> _coreIp = options->Get(Nan::New("coreIp").ToLocalChecked());
            Local<Value> _corePort = options->Get(Nan::New("corePort").ToLocalChecked());
            Local<Value> _apiType = options->Get(Nan::New("type").ToLocalChecked());

            if (_nodeName->IsString()) {
                Utf8String name(Nan::To<String>(_nodeName.As<String>()).ToLocalChecked());
                worker->name = *name;
                // worker->name = *Utf8String(_nodeName->ToString(context).ToLocalChecked());
            }

            if (_protocol->IsString()) {
                worker->protocol = *Utf8String(_protocol->ToString(context).ToLocalChecked());
            }

            if (_coreIp->IsString()) {
                worker->coreIp = *Utf8String(_coreIp->ToString(context).ToLocalChecked());
                //cout << "4. a) ApiWrapper constructor: opts: " << coreIp << "\n";
            } else {
                //cout << "4. b) ApiWrapper constructor: opts.core not string\n";
            }

            if (_corePort->IsNumber()) {
                worker->corePort = _corePort->Int32Value(context).FromJust();
            }

            if (_apiType->IsNumber()) {
                worker->apiType = (int) _apiType->Int32Value(context).FromJust();
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
    }
}

void
ApiWrapper::request(const Nan::FunctionCallbackInfo<v8::Value>& info) {
    Local<Context> context = Nan::GetCurrentContext();

    if (info.Length() != 2) {
        Nan::ThrowTypeError("Wrong number of arguments");
        return;
    }

    if (!info[0]->IsString()) {
        Nan::ThrowTypeError("Wrong arguments");
        return;
    }

    if (!info[1]->ToObject(info.GetIsolate())->IsUint8Array()) {
        Nan::ThrowTypeError("Argument 2 is not a Buffer");
        return;
    }
    
    Utf8String name(Nan::To<String>(info[0]).ToLocalChecked());
    
    uint8_t* buf = (uint8_t*) node::Buffer::Data(Nan::To<Object>(info[1]).ToLocalChecked());
    int buf_len = node::Buffer::Length(Nan::To<Object>(info[1]).ToLocalChecked());
    ApiWrapper* obj = Nan::ObjectWrap::Unwrap<ApiWrapper>(info.Holder());
     
    if ( obj->worker == NULL ) {
        //printf("Someone is trying to make requests while the whole thing is already shut down. Ditched. ApiWrapper %p\n", obj);
        return;
    }
    
    obj->worker->fromNode.write(Message(*name, buf, buf_len));
}

void
ApiWrapper::Init(Local<v8::Object> exports) {
    Local<v8::Context> context = exports->CreationContext();
    // Local context = Nan::GetCurrentContext();
    Nan::HandleScope scope;
    addon_init();
    
    Local<v8::FunctionTemplate> tpl = Nan::New<v8::FunctionTemplate>(ApiWrapper::New);
    tpl->SetClassName(Nan::New("WishApi").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(2);

    SetPrototypeMethod(tpl, "request", request);

    constructor.Reset(tpl->GetFunction(context).ToLocalChecked());

    exports->Set(Nan::New("WishApi").ToLocalChecked(), tpl->GetFunction(context).ToLocalChecked());
}

NODE_MODULE(WishApi, ApiWrapper::Init)
