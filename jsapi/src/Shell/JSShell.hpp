#pragma once

#include "Shell.hpp"
#include <jqutil_v2/jqutil.h>
#include <memory>
#include <mutex>
#include <string>
#include <functional>
#include <map>
#include <vector>

using namespace JQUTIL_NS;

class JSShell : public JQPublishObject
{
public:
    struct JSShellConfig {
        std::string shellType = "interactive";
        std::string shellPath = "/bin/bash";
        bool enableColor = true;
        int rows = 24;
        int cols = 80;
        JQValue env;
    };

    JSShell();
    ~JSShell();

    // Shell管理
    void initialize(JQFunctionInfo& info);
    void create(JQFunctionInfo& info);
    
    // 命令执行
    void exec(JQAsyncInfo& info);
    void execScript(JQAsyncInfo& info);
    void execFile(JQAsyncInfo& info);
    
    // 交互式Shell控制
    void start(JQFunctionInfo& info);
    void stop(JQFunctionInfo& info);
    void restart(JQFunctionInfo& info);
    void write(JQFunctionInfo& info);
    void sendSignal(JQFunctionInfo& info);
    void sendCtrlC(JQFunctionInfo& info);
    void sendCtrlD(JQFunctionInfo& info);
    void sendCtrlZ(JQFunctionInfo& info);
    
    // 终端控制
    void resize(JQFunctionInfo& info);
    
    // 信息查询
    void getState(JQFunctionInfo& info);
    void getPid(JQFunctionInfo& info);
    void getHistory(JQFunctionInfo& info);
    void clearHistory(JQFunctionInfo& info);
    
    // 交互式程序执行
    void execInteractive(JQAsyncInfo& info);
    
private:
    std::unique_ptr<Shell> shell;
    std::mutex shellMutex;
    JSShellConfig config;
    bool isInitialized;
    
    // Shell事件回调
    void onShellOutput(const std::string& output, bool isError);
    void onShellStateChange(Shell::ShellState state);
    
    // 辅助方法
    Shell::ShellType stringToShellType(const std::string& typeStr);
    
    // 活动shell管理
    static std::map<int, JSShell*> activeShells;
    static std::mutex activeShellsMutex;
};

JSValue createShell(JQModuleEnv* env);