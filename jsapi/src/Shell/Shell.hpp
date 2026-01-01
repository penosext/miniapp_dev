#pragma once

#include <string>
#include <functional>
#include <memory>
#include <cstdio>
#include <array>
#include <stdexcept>
#include <thread>
#include <utility>

class Shell
{
public:
    Shell() = default;
    ~Shell() = default;

    // 同步执行命令
    static std::string exec(const std::string& cmd);
    
    // 带环境变量的同步执行
    static std::string exec(const std::string& cmd, const std::string& env);
    
    // 带状态码的执行
    static std::pair<std::string, int> execWithStatus(const std::string& cmd);
    
    // 异步执行（带回调）
    static void execAsync(const std::string& cmd, 
                         std::function<void(const std::string&)> onOutput = nullptr);
};