#include "Update.hpp"
#include "Fetch.hpp"
#include "nlohmann/json.hpp"

using namespace JSAPI;
using json = nlohmann::json;

Update::Update() {}

void Update::setRepo(jqutil_dist::JQFunctionInfo& info) {
    if (info.Length() < 1) return;

    auto ctx = info.GetContext();
    auto obj = info[0];

    owner = jq_get_string(ctx, JS_GetPropertyStr(ctx, obj, "owner"));
    repo  = jq_get_string(ctx, JS_GetPropertyStr(ctx, obj, "repo"));
}

bool Update::versionGreater(const std::string& a, const std::string& b) {
    std::stringstream sa(a), sb(b);
    while (sa.good() || sb.good()) {
        int va = 0, vb = 0;
        char dot;
        sa >> va; sb >> vb;
        if (va != vb) return va > vb;
        sa >> dot; sb >> dot;
    }
    return false;
}

void Update::check(jqutil_dist::JQAsyncInfo& info) {
    std::string currentVersion = info[0].stringValue();

    std::string url =
        "https://api.github.com/repos/" + owner + "/" + repo + "/releases/latest";

    Fetch::get(url, [info, currentVersion](const std::string& body) mutable {
        json j = json::parse(body);

        std::string tag = j["tag_name"];
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
    });
}
