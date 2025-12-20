#pragma once
#include <string>
#include <tuple>

class Shell {
public:
    // 返回值：<stdout, exit_code>
    std::tuple<std::string, int> exec(const std::string& cmd);
};
