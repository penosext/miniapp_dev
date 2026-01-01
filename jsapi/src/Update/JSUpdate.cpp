#include "JSUpdate.hpp"
#include "jqutil_v2/JQFunctionTemplate.h"
#include "Shell/JSShell.hpp"
#include <string>
#include <sstream>

using namespace JQUTIL_NS;

static std::string g_owner = "octocat";
static std::string g_repo  = "Hello-World";

static bool versionGreater(const std::string& a, const std::string& b)
{
    std::stringstream sa(a), sb(b);
    char dot;
    int va = 0, vb = 0;

    while (sa.good() || sb.good()) {
        sa >> va;
        sb >> vb;
        if (va != vb) return va > vb;
        sa >> dot;
        sb >> dot;
    }
    return false;
}

static void js_setRepo(JQFunctionInfo& info)
{
    if (info.Length() < 1) return;

    auto ctx = info.GetContext();
    JSValue obj = info[0];

    JSValue o = JS_GetPropertyStr(ctx, obj, "owner");
    JSValue r = JS_GetPropertyStr(ctx, obj, "repo");

    if (!JS_IsUndefined(o)) g_owner = JS_ToCString(ctx, o);
    if (!JS_IsUndefined(r)) g_repo  = JS_ToCString(ctx, r);

    JS_FreeValue(ctx, o);
    JS_FreeValue(ctx, r);
}

static void js_check(JQAsyncInfo& info)
{
    if (info.Length() < 1) {
        info.postError("currentVersion required");
        return;
    }

    std::string currentVersion = info[0].string_value();

    std::string url =
        "https://api.github.com/repos/" + g_owner + "/" + g_repo + "/releases/latest";

    // 直接用 Shell + curl（最稳、与你项目完全兼容）
    std::string cmd =
        "curl -s -L \"" + url + "\"";

    Shell::exec(
        cmd,
        [info, currentVersion](const std::string& output) mutable {
            // 极简解析（避免引入新依赖）
            bool hasUpdate = output.find("tag_name") != std::string::npos;

            JSContext* ctx = info.GetContext();
            JSValue obj = JS_NewObject(ctx);

            JS_SetPropertyStr(ctx, obj, "hasUpdate", JS_NewBool(ctx, hasUpdate));
            JS_SetPropertyStr(ctx, obj, "raw", JS_NewString(ctx, output.c_str()));

            info.post(obj);
        },
        [info](const std::string& err) mutable {
            info.postError(err);
        }
    );
}

JSValue createUpdate(JQModuleEnv* env)
{
    auto tpl = JQFunctionTemplate::New(env->tplEnv(), "Update");

    tpl->SetProtoMethod("setRepo", js_setRepo);
    tpl->SetProtoMethodPromise("check", js_check);

    return tpl->GetFunction();
}
