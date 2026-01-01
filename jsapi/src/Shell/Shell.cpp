#include "Shell.hpp"
#include <cstdio>
#include <array>
#include <stdexcept>
#include <thread>
#include <utility>
#include <memory>
#include <functional>

// 同步执行命令
std::string Shell::exec(const std::string& cmd) {
    std::array<char, 256> buffer;
    std::string result;

    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) {
        throw std::runtime_error("popen failed");
    }

    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
        result += buffer.data();
    }

    int status = pclose(pipe);
    return result;
}

// 带环境变量的同步执行
std::string Shell::exec(const std::string& cmd, const std::string& env) {
    // 如果有环境变量，先设置环境变量再执行命令
    std::string fullCmd;
    if (!env.empty()) {
        fullCmd = env + " " + cmd;
    } else {
        fullCmd = cmd;
    }
    return exec(fullCmd);
}

// 带状态码的执行
std::pair<std::string, int> Shell::execWithStatus(const std::string& cmd) {
    std::array<char, 256> buffer;
    std::string result;

    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) {
        throw std::runtime_error("popen failed");
    }

    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
        result += buffer.data();
    }

    int status = pclose(pipe);
    return {result, status};
}

// 异步执行（带回调）
void Shell::execAsync(const std::string& cmd, 
                     std::function<void(const std::string&)> onOutput) {
    std::thread([cmd, onOutput]() {
        std::array<char, 256> buffer;
        std::string result;

        FILE* pipe = popen(cmd.c_str(), "r");
        if (!pipe) {
            if (onOutput) onOutput("popen failed");
            return;
        }

        while (fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
            std::string output(buffer.data());
            if (onOutput) onOutput(output);
        }

        pclose(pipe);
    }).detach();
}