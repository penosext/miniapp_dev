#pragma once

#include <jqutil_v2/jqutil.h>
#include <memory>
#include <mutex>

using namespace JQUTIL_NS;

class JSUpdate : public JQPublishObject
{
private:
    struct UpdateConfig;
    UpdateConfig getConfig();
    void setConfig(const UpdateConfig& newConfig);
    static bool versionGreater(const std::string& a, const std::string& b);
    bool downloadFile(const std::string& url, const std::string& savePath);
    std::string execShell(const std::string& cmd);
    
    struct UpdateConfig* config;
    mutable std::mutex configMutex;

public:
    JSUpdate();
    ~JSUpdate();
    
    void setRepo(JQFunctionInfo& info);
    void check(JQFunctionInfo& info);
    void download(JQAsyncInfo& info);
    void getConfig(JQFunctionInfo& info);
    void cleanup(JQFunctionInfo& info);
};

extern JSValue createUpdate(JQModuleEnv* env);