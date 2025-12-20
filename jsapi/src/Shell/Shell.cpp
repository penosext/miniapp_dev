#include "Shell.hpp"
#include <cstdio>
#include <array>
#include <stdexcept>
#include <sys/wait.h> // 用于 WIFEXITED 和 WEXITSTATUS

std::tuple<std::string, int> Shell::exec(const std::string& cmd)
{
    std::array<char, 256> buffer;
    std::string result;

    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe)
        throw std::runtime_error("popen failed");

    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr)
        result += buffer.data();

    int status = pclose(pipe); // 获取命令退出状态
    int exit_code = WIFEXITED(status) ? WEXITSTATUS(status) : -1;

    return {result, exit_code};
}
