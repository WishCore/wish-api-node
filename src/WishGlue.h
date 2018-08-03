#pragma once

#include <nan.h>
#include "AddonWorker.h"

extern "C" {
    void addon_init();
    void addon_start(AddonWorker* addonWorker);
    bool injectMessage(AddonWorker* addonWorker, int type, uint8_t* msg, int msg_len);
}

