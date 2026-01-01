#pragma once

#include <jqutil_v2/jqutil.h>
#include <string>
#include <mutex>
#include <unordered_map>
#include <memory>

using namespace JQUTIL_NS;

class JSUpdate : public JQPublishObject
{
private:
    std::string owner;
    std::string repo;
    std::string downloadPath;
    std::string currentVersion;
    std::string filterPattern;
    
    mutable std::mutex configMutex;
    
    bool versionGreater(const std::string& a, const std::string& b);
    bool downloadFile(const std::string& url, const std::string& savePath);
    std::string execShell(const std::string& cmd);

public:
    JSUpdate();
    ~JSUpdate();
    
    void setRepo(JQFunctionInfo& info);
    void check(JQAsyncInfo& info);
    void download(JQAsyncInfo& info);
    void getConfig(JQAsyncInfo& info);
    void cleanup(JQFunctionInfo& info);
};

extern JSValue createUpdate(JQModuleEnv* env);