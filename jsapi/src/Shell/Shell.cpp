// Shell.cpp
#include "Shell.hpp"
#include <cstdio>
#include <memory>
#include <array>
#include <stdexcept>
#include <thread>
#include <atomic>
#include <mutex>
#include <condition_variable>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/select.h>
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <vector>
#include <sstream>

class Shell::Impl {
private:
    struct PipeSet {
        int read_fd{-1};
        int write_fd{-1};
        
        ~PipeSet() {
            if (read_fd != -1) close(read_fd);
            if (write_fd != -1) close(write_fd);
        }
    };
    
    std::unique_ptr<std::thread> workerThread;
    std::atomic<bool> running{false};
    std::atomic<bool> interactive{false};
    std::atomic<int> lastExitCode{0};
    
    int stdin_pipe[2]{-1, -1};
    int stdout_pipe[2]{-1, -1};
    int stderr_pipe[2]{-1, -1};
    
    pid_t childPid{-1};
    std::mutex mtx;
    
    OutputCallback outputCallback;
    ExitCallback exitCallback;
    ErrorCallback errorCallback;
    
    std::vector<std::pair<std::string, std::string>> envVars;
    
public:
    Impl() = default;
    
    ~Impl() {
        terminate();
    }
    
    // 同步执行 - 保持简单兼容
    std::string exec(const std::string& cmd) {
        std::array<char, 256> buffer;
        std::string result;
        
        FILE* pipe = popen(cmd.c_str(), "r");
        if (!pipe) {
            throw std::runtime_error("popen failed: " + std::string(strerror(errno)));
        }
        
        // 读取输出
        while (fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
            result += buffer.data();
        }
        
        int status = pclose(pipe);
        lastExitCode = WEXITSTATUS(status);
        return result;
    }
    
    // 异步执行命令
    void execAsync(const std::string& cmd,
                  OutputCallback outputCb,
                  ExitCallback exitCb,
                  ErrorCallback errorCb) {
        terminate(); // 确保之前的进程已结束
        
        outputCallback = std::move(outputCb);
        exitCallback = std::move(exitCb);
        errorCallback = std::move(errorCb);
        
        workerThread = std::make_unique<std::thread>([this, cmd]() {
            this->runAsyncCommand(cmd);
        });
    }
    
    // 启动交互式shell会话
    void startInteractive(OutputCallback outputCb,
                         ExitCallback exitCb,
                         ErrorCallback errorCb) {
        terminate();
        
        outputCallback = std::move(outputCb);
        exitCallback = std::move(exitCb);
        errorCallback = std::move(errorCb);
        interactive = true;
        
        workerThread = std::make_unique<std::thread>([this]() {
            this->runInteractiveShell();
        });
    }
    
    // 向交互式shell写入输入
    void writeToInteractive(const std::string& input) {
        if (!running || childPid <= 0) return;
        
        std::lock_guard<std::mutex> lock(mtx);
        if (stdin_pipe[1] != -1) {
            write(stdin_pipe[1], input.c_str(), input.size());
            write(stdin_pipe[1], "\n", 1);
        }
    }
    
    // 发送信号
    void sendSignal(int signal) {
        if (childPid > 0) {
            kill(childPid, signal);
        }
    }
    
    // 终止进程
    void terminate() {
        running = false;
        
        if (childPid > 0) {
            // 发送SIGTERM，然后SIGKILL
            kill(childPid, SIGTERM);
            
            // 等待进程结束
            int status;
            for (int i = 0; i < 10; i++) { // 最多等1秒
                if (waitpid(childPid, &status, WNOHANG) == childPid) {
                    break;
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            
            // 如果还在运行，强制结束
            if (waitpid(childPid, &status, WNOHANG) != childPid) {
                kill(childPid, SIGKILL);
                waitpid(childPid, &status, 0);
            }
            
            childPid = -1;
        }
        
        // 关闭管道
        closePipes();
        
        // 等待线程结束
        if (workerThread && workerThread->joinable()) {
            workerThread->join();
            workerThread.reset();
        }
    }
    
    bool isRunning() const {
        return running;
    }
    
    void setEnv(const std::string& key, const std::string& value) {
        envVars.push_back({key, value});
    }
    
    int getLastExitCode() const {
        return lastExitCode;
    }
    
private:
    void runAsyncCommand(const std::string& cmd) {
        running = true;
        
        try {
            // 创建管道
            if (pipe(stdin_pipe) == -1 || pipe(stdout_pipe) == -1 || pipe(stderr_pipe) == -1) {
                throw std::runtime_error("pipe creation failed: " + std::string(strerror(errno)));
            }
            
            childPid = fork();
            if (childPid == -1) {
                closePipes();
                throw std::runtime_error("fork failed: " + std::string(strerror(errno)));
            }
            
            if (childPid == 0) { // 子进程
                // 关闭不需要的管道端
                close(stdin_pipe[1]);  // 关闭父进程写入端
                close(stdout_pipe[0]); // 关闭父进程读取端
                close(stderr_pipe[0]); // 关闭父进程读取端
                
                // 重定向标准输入输出
                dup2(stdin_pipe[0], STDIN_FILENO);
                dup2(stdout_pipe[1], STDOUT_FILENO);
                dup2(stderr_pipe[1], STDERR_FILENO);
                
                // 关闭所有管道（已重定向）
                close(stdin_pipe[0]);
                close(stdout_pipe[1]);
                close(stderr_pipe[1]);
                
                // 设置环境变量
                for (const auto& env : envVars) {
                    setenv(env.first.c_str(), env.second.c_str(), 1);
                }
                
                // 执行命令
                execl("/bin/sh", "sh", "-c", cmd.c_str(), (char*)NULL);
                
                // 如果execl失败
                exit(127);
            } else { // 父进程
                // 关闭子进程端
                close(stdin_pipe[0]);
                close(stdout_pipe[1]);
                close(stderr_pipe[1]);
                
                // 设置为非阻塞
                setNonBlocking(stdout_pipe[0]);
                setNonBlocking(stderr_pipe[0]);
                
                // 读取子进程输出
                readChildOutput();
                
                // 等待子进程结束
                int status;
                waitpid(childPid, &status, 0);
                
                if (WIFEXITED(status)) {
                    lastExitCode = WEXITSTATUS(status);
                    if (exitCallback) {
                        exitCallback(lastExitCode);
                    }
                } else if (WIFSIGNALED(status)) {
                    lastExitCode = 128 + WTERMSIG(status);
                    if (exitCallback) {
                        exitCallback(lastExitCode);
                    }
                }
                
                running = false;
            }
        } catch (const std::exception& e) {
            running = false;
            if (errorCallback) {
                errorCallback(e.what());
            }
        }
    }
    
    void runInteractiveShell() {
        running = true;
        
        try {
            // 创建管道
            if (pipe(stdin_pipe) == -1 || pipe(stdout_pipe) == -1 || pipe(stderr_pipe) == -1) {
                throw std::runtime_error("pipe creation failed: " + std::string(strerror(errno)));
            }
            
            childPid = fork();
            if (childPid == -1) {
                closePipes();
                throw std::runtime_error("fork failed: " + std::string(strerror(errno)));
            }
            
            if (childPid == 0) { // 子进程
                // 设置环境变量
                for (const auto& env : envVars) {
                    setenv(env.first.c_str(), env.second.c_str(), 1);
                }
                
                // 设置TERM环境变量
                setenv("TERM", "xterm-256color", 1);
                
                // 重定向标准输入输出
                close(stdin_pipe[1]);  // 关闭父进程写入端
                close(stdout_pipe[0]); // 关闭父进程读取端
                close(stderr_pipe[0]); // 关闭父进程读取端
                
                dup2(stdin_pipe[0], STDIN_FILENO);
                dup2(stdout_pipe[1], STDOUT_FILENO);
                dup2(stderr_pipe[1], STDERR_FILENO);
                
                // 关闭所有管道（已重定向）
                close(stdin_pipe[0]);
                close(stdout_pipe[1]);
                close(stderr_pipe[1]);
                
                // 启动交互式shell
                execl("/bin/sh", "sh", "-i", (char*)NULL); // -i 表示交互模式
                
                // 如果execl失败
                exit(127);
            } else { // 父进程
                // 关闭子进程端
                close(stdin_pipe[0]);
                close(stdout_pipe[1]);
                close(stderr_pipe[1]);
                
                // 设置为非阻塞
                setNonBlocking(stdout_pipe[0]);
                setNonBlocking(stderr_pipe[0]);
                
                // 发送初始提示符或消息
                if (outputCallback) {
                    outputCallback("Interactive shell started. Type 'exit' to quit.\n");
                }
                
                // 读取子进程输出
                readChildOutput();
                
                // 等待子进程结束
                int status;
                waitpid(childPid, &status, 0);
                
                if (WIFEXITED(status)) {
                    lastExitCode = WEXITSTATUS(status);
                    if (exitCallback) {
                        exitCallback(lastExitCode);
                    }
                }
                
                running = false;
                
                if (outputCallback) {
                    outputCallback("\nShell session ended.\n");
                }
            }
        } catch (const std::exception& e) {
            running = false;
            if (errorCallback) {
                errorCallback(e.what());
            }
        }
    }
    
    void readChildOutput() {
        char buffer[4096];
        fd_set readfds;
        int max_fd = std::max(stdout_pipe[0], stderr_pipe[0]);
        
        while (running) {
            FD_ZERO(&readfds);
            FD_SET(stdout_pipe[0], &readfds);
            FD_SET(stderr_pipe[0], &readfds);
            
            struct timeval timeout = {0, 100000}; // 100ms
            
            int ret = select(max_fd + 1, &readfds, nullptr, nullptr, &timeout);
            if (ret > 0) {
                // 读取stdout
                if (FD_ISSET(stdout_pipe[0], &readfds)) {
                    ssize_t bytesRead = read(stdout_pipe[0], buffer, sizeof(buffer) - 1);
                    if (bytesRead > 0) {
                        buffer[bytesRead] = '\0';
                        if (outputCallback) {
                            outputCallback(std::string(buffer, bytesRead));
                        }
                    } else if (bytesRead == 0) {
                        // EOF
                        close(stdout_pipe[0]);
                        stdout_pipe[0] = -1;
                    }
                }
                
                // 读取stderr
                if (FD_ISSET(stderr_pipe[0], &readfds)) {
                    ssize_t bytesRead = read(stderr_pipe[0], buffer, sizeof(buffer) - 1);
                    if (bytesRead > 0) {
                        buffer[bytesRead] = '\0';
                        if (outputCallback) {
                            outputCallback(std::string(buffer, bytesRead));
                        }
                    } else if (bytesRead == 0) {
                        // EOF
                        close(stderr_pipe[0]);
                        stderr_pipe[0] = -1;
                    }
                }
            } else if (ret == -1 && errno != EINTR) {
                break; // 错误
            }
            
            // 检查子进程是否还在运行
            if (stdout_pipe[0] == -1 && stderr_pipe[0] == -1) {
                break;
            }
            
            // 检查子进程状态
            int status;
            pid_t result = waitpid(childPid, &status, WNOHANG);
            if (result == childPid) {
                break; // 子进程已结束
            }
        }
    }
    
    void setNonBlocking(int fd) {
        int flags = fcntl(fd, F_GETFL, 0);
        fcntl(fd, F_SETFL, flags | O_NONBLOCK);
    }
    
    void closePipes() {
        if (stdin_pipe[0] != -1) { close(stdin_pipe[0]); stdin_pipe[0] = -1; }
        if (stdin_pipe[1] != -1) { close(stdin_pipe[1]); stdin_pipe[1] = -1; }
        if (stdout_pipe[0] != -1) { close(stdout_pipe[0]); stdout_pipe[0] = -1; }
        if (stdout_pipe[1] != -1) { close(stdout_pipe[1]); stdout_pipe[1] = -1; }
        if (stderr_pipe[0] != -1) { close(stderr_pipe[0]); stderr_pipe[0] = -1; }
        if (stderr_pipe[1] != -1) { close(stderr_pipe[1]); stderr_pipe[1] = -1; }
    }
};

// Shell类实现
Shell::Shell() : pImpl(std::make_unique<Impl>()) {}
Shell::~Shell() = default;

std::string Shell::exec(const std::string& cmd) {
    return pImpl->exec(cmd);
}

void Shell::execAsync(const std::string& cmd,
                     OutputCallback outputCallback,
                     ExitCallback exitCallback,
                     ErrorCallback errorCallback) {
    pImpl->execAsync(cmd, std::move(outputCallback), 
                     std::move(exitCallback), std::move(errorCallback));
}

void Shell::startInteractive(OutputCallback outputCallback,
                           ExitCallback exitCallback,
                           ErrorCallback errorCallback) {
    pImpl->startInteractive(std::move(outputCallback),
                          std::move(exitCallback),
                          std::move(errorCallback));
}

void Shell::writeToInteractive(const std::string& input) {
    pImpl->writeToInteractive(input);
}

void Shell::sendSignal(int signal) {
    pImpl->sendSignal(signal);
}

void Shell::terminate() {
    pImpl->terminate();
}

bool Shell::isRunning() const {
    return pImpl->isRunning();
}

void Shell::setEnv(const std::string& key, const std::string& value) {
    pImpl->setEnv(key, value);
}

int Shell::getLastExitCode() const {
    return pImpl->getLastExitCode();
}