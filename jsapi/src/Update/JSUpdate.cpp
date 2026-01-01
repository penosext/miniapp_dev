#include "Update.hpp"
#include "jqutil_v2/JQFunctionTemplate.h"

using namespace jqutil_dist;
using namespace JSAPI;

void RegisterUpdate(JQTemplateEnvRef env) {
    auto tpl = JQFunctionTemplate::New(env, "Update");

    tpl->SetProtoMethod("setRepo", &Update::setRepo);
    tpl->SetProtoMethodPromise("check", &Update::check);

    env->exports()->Set("update", tpl->GetFunction());
}
