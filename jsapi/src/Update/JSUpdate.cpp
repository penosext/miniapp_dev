#include "JSUpdate.hpp"
#include "Update.hpp"
#include "jqutil_v2/JQFunctionTemplate.h"

using namespace JQUTIL_NS;
using namespace JSAPI;

JSValue createUpdate(JQModuleEnv* env)
{
    auto tpl = JQFunctionTemplate::New(env->tplEnv(), "Update");

    tpl->SetProtoMethod("setRepo", &Update::setRepo);
    tpl->SetProtoMethodPromise("check", &Update::check);

    return tpl->GetFunction();
}
