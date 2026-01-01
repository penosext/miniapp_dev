#pragma once
#include <string>
#include "jqutil_v2/JQBaseObject.h"
#include "jqutil_v2/JQFuncDef.h"

namespace JSAPI {

class Update : public JQUTIL_NS::JQBaseObject {
public:
    Update();

    void setRepo(JQUTIL_NS::JQFunctionInfo& info);
    void check(JQUTIL_NS::JQAsyncInfo& info);

private:
    std::string owner;
    std::string repo;

    static bool versionGreater(const std::string& a, const std::string& b);
};

}
