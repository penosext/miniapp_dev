#include "Update.hpp"
#include "Fetch.hpp"
#include "nlohmann/json.hpp"
#include <sstream>

using namespace JSAPI;
using json = nlohmann::json;

Update::Update()
{
    owner = "octocat";
    repo  = "Hello-World";
}

void Update::setRepo(JQUTIL_NS::JQFunctionInfo& info)
{
    if (info.Length() < 1) return;

    auto ctx = info.GetContext();
    JSValue obj = info[0];

    JSValue o = JS_GetPropertyStr(ctx, obj, "owner");
    JSValue r = JS_GetPropertyStr(ctx, obj, "repo");

    if (!JS_IsUndefined(o)) owner = JS_ToCString(ctx, o);
    if (!JS_IsUndefined(r)) repo  = JS_ToCString(ctx, r);

    JS_FreeValue(ctx, o);
    JS_FreeValue(ctx, r);
}

bool Update::versionGreater(const std::string& a, const std::string& b)
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

void Update::check(JQUTIL_NS::JQAsyncInfo& info)
{
    if (info.Length() < 1) {
        info.postError("currentVersion required");
        return;
    }

    std::string currentVersion = info[0].stringValue();

    std::string url =
        "https://api.github.com/repos/" + owner + "/" + repo + "/releases/latest";

    Fetch::get(
        url,
        [info, currentVersion](const std::string& body) mutable {
            json j = json::parse(body);

            std::string tag = j["tag_name"].get<std::string>();
            bool hasUpdate = versionGreater(tag, currentVersion);

            json res = {
                {"hasUpdate", hasUpdate},
                {"latestVersion", tag},
                {"name", j["name"]},
                {"body", j["body"]},
                {"url", j["html_url"]}
            };

            info.postJSON(res.dump());
        },
        [info](const std::string& err) mutable {
            info.postError(err);
        }
    );
}
