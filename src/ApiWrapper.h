#pragma once

#include "nan.h"
#include "AddonWorker.h"

class ApiWrapper : public Nan::ObjectWrap {
public:

    static void Init(v8::Local<v8::Object> exports);
    
    void addonDeleted();

private:

    explicit ApiWrapper(AddonWorker* worker);

    ~ApiWrapper();

    static void New(const Nan::FunctionCallbackInfo<v8::Value>& info);
    
    static void request(const Nan::FunctionCallbackInfo<v8::Value>& info);
    
    static Nan::Persistent<v8::Function> constructor;

    AddonWorker* worker;
};

