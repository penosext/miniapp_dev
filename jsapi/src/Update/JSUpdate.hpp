#pragma once

#include <jqutil_v2/jqutil.h>
#include <string>
#include <mutex>
#include <filesystem>

namespace fs = std::filesystem;

using namespace JQUTIL_NS;

class JSUpdate : public JQPublishObject
{
private:
    struct UpdateConfig {
        std::string owner = "octocat";
        std::string repo = "Hello-World";
        std::string downloadPath = "/userdisk/downloads";
        std::string currentVersion = "1.0.0";
        std::string filterPattern = ".*\\.(tar\\.gz|zip|apk|bin)$";
    };
    
    UpdateConfig config;
    mutable std::mutex configMutex;
    
    // 获取配置的线程安全方法
    UpdateConfig getConfig();
    void setConfig(const UpdateConfig& newConfig);
    
    // 版本比较函数
    static bool versionGreater(const std::string& a, const std::string& b);
    
    // 下载文件
    bool downloadFile(const std::string& url, const std::string& savePath);
    
    // 执行shell命令并获取结果
    std::string execShell(const std::string& cmd);

public:
    JSUpdate();
    ~JSUpdate();
    
    void setRepo(JQFunctionInfo& info);
    void check(JQFunctionInfo& info);
    void download(JQAsyncInfo& info);
    void getCurrentConfig(JQFunctionInfo& info);  // 重命名避免冲突
    void cleanup(JQFunctionInfo& info);
};

extern JSValue createUpdate(JQModuleEnv* env);