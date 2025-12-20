#pragma once

#include <string>
#include <functional>
#include <memory>
#include <mutex>
#include <atomic>
#include <vector>
#include <map>

class Shell {
public:
    enum ShellType {
        SHELL_NONE,
        SHELL_POPEN,        // 传统popen方式
        SHELL_INTERACTIVE,  // 交互式pty方式
        SHELL_BACKGROUND    // 后台进程
    };

    enum ShellState {
        STATE_IDLE,
        STATE_RUNNING,
        STATE_WAITING_INPUT,
        STATE_EXITED,
        STATE_ERROR
    };

    struct ShellConfig {
        std::string shellPath = "/bin/bash";
        bool enableColor = true;
        bool enableHistory = true;
        int initialRows = 24;
        int initialCols = 80;
        std::map<std::string, std::string> envVars;
        std::string workingDirectory;
        ShellType type = SHELL_INTERACTIVE;
    };

    struct CommandResult {
        std::string output;
        std::string error;
        int exitCode = 0;
        bool success = false;
        int pid = -1;
        double executionTime = 0.0;
    };

    Shell();
    explicit Shell(const ShellConfig& config);
    ~Shell();

    // 传统的一次性命令执行
    CommandResult exec(const std::string& cmd);
    CommandResult exec(const std::string& cmd, const std::map<std::string, std::string>& env);
    
    // 交互式Shell会话
    bool start();
    bool start(const std::string& shellPath);
    bool restart();
    void stop();
    
    // 向Shell写入输入
    bool writeInput(const std::string& input);
    bool writeInputLine(const std::string& line);
    
    // 输出处理
    void setOutputCallback(std::function<void(const std::string&, bool isError)> callback);
    void setStateCallback(std::function<void(ShellState)> callback);
    
    // 终端控制
    bool resizeTerminal(int rows, int cols);
    void sendSignal(int signal);
    void sendCtrlC();
    void sendCtrlD();
    void sendCtrlZ();
    
    // 会话管理
    ShellState getState() const;
    int getPid() const;
    ShellType getType() const;
    std::string getShellPath() const;
    
    // 历史记录
    std::vector<std::string> getCommandHistory() const;
    void clearCommandHistory();
    
    // 批量执行
    CommandResult execScript(const std::vector<std::string>& commands);
    CommandResult execScriptFile(const std::string& filePath);
    
    // 异步执行
    void execAsync(const std::string& cmd, 
                   std::function<void(const CommandResult&)> callback);
    
    // 流式执行（逐行输出）
    void execStream(const std::string& cmd,
                    std::function<void(const std::string&, bool)> onOutput);
    
private:
    class Impl;
    std::unique_ptr<Impl> impl;
};