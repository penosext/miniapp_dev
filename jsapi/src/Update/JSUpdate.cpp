#include "JSUpdate.hpp"
#include "Fetch.hpp"
#include <Exceptions/AssertFailed.hpp>
#include <Exceptions/NetworkError.hpp>
#include <iostream>
#include <sstream>
#include <regex>
#include <filesystem>
#include <fstream>
#include <sys/stat.h>
#include <unistd.h>

namespace fs = std::filesystem;

using namespace JQUTIL_NS;

JSUpdate::JSUpdate() {
    // 初始化默认下载路径
    UpdateConfig cfg;
    cfg.downloadPath = "/userdisk/downloads";
    cfg.currentVersion = "1.0.0";
    setConfig(cfg);
    
    // 创建下载目录
    fs::create_directories(cfg.downloadPath);
}

JSUpdate::~JSUpdate() = default;

UpdateConfig JSUpdate::getConfig() {
    std::lock_guard<std::mutex> lock(configMutex);
    return config;
}

void JSUpdate::setConfig(const UpdateConfig& newConfig) {
    std::lock_guard<std::mutex> lock(configMutex);
    config = newConfig;
}

bool JSUpdate::versionGreater(const std::string& a, const std::string& b) {
    std::regex versionRegex(R"((\d+)\.(\d+)\.(\d+))");
    std::smatch matchA, matchB;
    
    if (std::regex_match(a, matchA, versionRegex) && 
        std::regex_match(b, matchB, versionRegex)) {
        
        for (int i = 1; i <= 3; i++) {
            int partA = std::stoi(matchA[i]);
            int partB = std::stoi(matchB[i]);
            
            if (partA > partB) return true;
            if (partA < partB) return false;
        }
    }
    
    return false;
}

bool JSUpdate::downloadFile(const std::string& url, const std::string& savePath) {
    try {
        FetchOptions options;
        options.timeout = 300; // 5分钟超时
        options.headers["User-Agent"] = "miniapp-updater/1.0";
        
        Response response = Fetch::fetch(url, options);
        
        if (response.isOk()) {
            // 确保目录存在
            fs::path filePath(savePath);
            fs::create_directories(filePath.parent_path());
            
            // 写入文件
            std::ofstream file(savePath, std::ios::binary);
            if (file) {
                file.write(response.body.c_str(), response.body.size());
                file.close();
                
                // 设置文件权限
                chmod(savePath.c_str(), 0644);
                return true;
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Download error: " << e.what() << std::endl;
    }
    
    return false;
}

std::string JSUpdate::execShell(const std::string& cmd) {
    std::array<char, 128> buffer;
    std::string result;
    
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) {
        return "";
    }
    
    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
        result += buffer.data();
    }
    
    pclose(pipe);
    return result;
}

// 设置仓库配置
void JSUpdate::setRepo(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() >= 1);
        ASSERT(info[0].is_object());
        
        JSContext* ctx = info.GetContext();
        JSValue configObj = info[0];
        
        UpdateConfig cfg = getConfig();
        
        // 获取owner
        JSValue ownerVal = JS_GetPropertyStr(ctx, configObj, "owner");
        if (!JS_IsUndefined(ownerVal)) {
            cfg.owner = JQString(ctx, ownerVal).getString();
            JS_FreeValue(ctx, ownerVal);
        }
        
        // 获取repo
        JSValue repoVal = JS_GetPropertyStr(ctx, configObj, "repo");
        if (!JS_IsUndefined(repoVal)) {
            cfg.repo = JQString(ctx, repoVal).getString();
            JS_FreeValue(ctx, repoVal);
        }
        
        // 获取下载路径
        JSValue pathVal = JS_GetPropertyStr(ctx, configObj, "downloadPath");
        if (!JS_IsUndefined(pathVal)) {
            std::string newPath = JQString(ctx, pathVal).getString();
            if (!newPath.empty()) {
                cfg.downloadPath = newPath;
                fs::create_directories(newPath);
            }
            JS_FreeValue(ctx, pathVal);
        }
        
        // 获取当前版本
        JSValue versionVal = JS_GetPropertyStr(ctx, configObj, "currentVersion");
        if (!JS_IsUndefined(versionVal)) {
            cfg.currentVersion = JQString(ctx, versionVal).getString();
            JS_FreeValue(ctx, versionVal);
        }
        
        // 获取文件过滤模式
        JSValue filterVal = JS_GetPropertyStr(ctx, configObj, "filterPattern");
        if (!JS_IsUndefined(filterVal)) {
            cfg.filterPattern = JQString(ctx, filterVal).getString();
            JS_FreeValue(ctx, filterVal);
        }
        
        setConfig(cfg);
        
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

// 检查更新（同步版本）
void JSUpdate::check(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 0);
        
        UpdateConfig cfg = getConfig();
        
        // 构建GitHub API URL
        std::string url = "https://api.github.com/repos/" + 
                         cfg.owner + "/" + cfg.repo + "/releases/latest";
        
        FetchOptions options;
        options.headers["User-Agent"] = "miniapp-updater/1.0";
        options.headers["Accept"] = "application/vnd.github.v3+json";
        options.timeout = 30;
        
        Response response = Fetch::fetch(url, options);
        
        if (!response.isOk()) {
            info.GetReturnValue().Set(Bson::object{
                {"success", false},
                {"error", "HTTP " + std::to_string(response.status)}
            });
            return;
        }
        
        try {
            nlohmann::json releaseInfo = response.json();
            
            Bson::object result = {
                {"success", true},
                {"hasUpdate", false},
                {"currentVersion", cfg.currentVersion},
                {"latestVersion", ""},
                {"releaseNotes", ""},
                {"downloadUrl", ""},
                {"downloadSize", 0},
                {"publishedAt", ""}
            };
            
            if (releaseInfo.contains("tag_name")) {
                std::string latestVersion = releaseInfo["tag_name"];
                result["latestVersion"] = latestVersion;
                
                // 去除版本号前的"v"前缀（如果有）
                if (latestVersion.size() > 0 && latestVersion[0] == 'v') {
                    latestVersion = latestVersion.substr(1);
                }
                
                // 检查是否有新版本
                if (versionGreater(latestVersion, cfg.currentVersion)) {
                    result["hasUpdate"] = true;
                }
                
                // 获取发布说明
                if (releaseInfo.contains("body") && !releaseInfo["body"].is_null()) {
                    result["releaseNotes"] = releaseInfo["body"].get<std::string>();
                }
                
                // 获取发布时间
                if (releaseInfo.contains("published_at") && !releaseInfo["published_at"].is_null()) {
                    result["publishedAt"] = releaseInfo["published_at"].get<std::string>();
                }
                
                // 查找可下载的asset
                if (releaseInfo.contains("assets") && releaseInfo["assets"].is_array()) {
                    std::regex filterRegex(cfg.filterPattern);
                    
                    for (const auto& asset : releaseInfo["assets"]) {
                        if (asset.contains("browser_download_url") && 
                            asset.contains("name")) {
                            
                            std::string assetName = asset["name"].get<std::string>();
                            
                            if (std::regex_match(assetName, filterRegex)) {
                                result["downloadUrl"] = asset["browser_download_url"].get<std::string>();
                                result["assetName"] = assetName;
                                
                                if (asset.contains("size") && !asset["size"].is_null()) {
                                    result["downloadSize"] = static_cast<int>(asset["size"].get<int64_t>());
                                }
                                break;
                            }
                        }
                    }
                }
            }
            
            info.GetReturnValue().Set(result);
            
        } catch (const nlohmann::json::parse_error& e) {
            info.GetReturnValue().Set(Bson::object{
                {"success", false},
                {"error", "JSON parse error: " + std::string(e.what())}
            });
        }
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

// 下载更新文件（异步版本）
void JSUpdate::download(JQAsyncInfo& info) {
    try {
        ASSERT(info.Length() == 0);
        
        UpdateConfig cfg = getConfig();
        
        // 先检查更新以获取下载URL
        std::string checkUrl = "https://api.github.com/repos/" + 
                              cfg.owner + "/" + cfg.repo + "/releases/latest";
        
        FetchOptions checkOptions;
        checkOptions.headers["User-Agent"] = "miniapp-updater/1.0";
        checkOptions.timeout = 30;
        
        Response checkResponse = Fetch::fetch(checkUrl, checkOptions);
        
        if (!checkResponse.isOk()) {
            info.post(Bson::object{
                {"success", false},
                {"error", "Failed to check for updates: HTTP " + std::to_string(checkResponse.status)}
            });
            return;
        }
        
        nlohmann::json releaseInfo = checkResponse.json();
        
        std::string downloadUrl;
        std::string assetName;
        
        if (releaseInfo.contains("assets") && releaseInfo["assets"].is_array()) {
            std::regex filterRegex(cfg.filterPattern);
            
            for (const auto& asset : releaseInfo["assets"]) {
                if (asset.contains("browser_download_url") && 
                    asset.contains("name")) {
                    
                    std::string name = asset["name"].get<std::string>();
                    
                    if (std::regex_match(name, filterRegex)) {
                        downloadUrl = asset["browser_download_url"].get<std::string>();
                        assetName = name;
                        break;
                    }
                }
            }
        }
        
        if (downloadUrl.empty()) {
            info.post(Bson::object{
                {"success", false},
                {"error", "No matching download asset found"}
            });
            return;
        }
        
        // 构建保存路径
        std::string savePath = cfg.downloadPath + "/" + assetName;
        
        // 开始下载
        FetchOptions downloadOptions;
        downloadOptions.headers["User-Agent"] = "miniapp-updater/1.0";
        downloadOptions.timeout = 300; // 5分钟超时
        
        Response downloadResponse = Fetch::fetch(downloadUrl, downloadOptions);
        
        if (!downloadResponse.isOk()) {
            info.post(Bson::object{
                {"success", false},
                {"error", "Download failed: HTTP " + std::to_string(downloadResponse.status)}
            });
            return;
        }
        
        // 保存文件
        fs::path filePath(savePath);
        fs::create_directories(filePath.parent_path());
        
        std::ofstream file(savePath, std::ios::binary);
        if (!file) {
            info.post(Bson::object{
                {"success", false},
                {"error", "Failed to create file: " + savePath}
            });
            return;
        }
        
        file.write(downloadResponse.body.c_str(), downloadResponse.body.size());
        file.close();
        
        // 设置文件权限
        chmod(savePath.c_str(), 0644);
        
        // 返回下载信息
        struct stat fileStat;
        if (stat(savePath.c_str(), &fileStat) == 0) {
            info.post(Bson::object{
                {"success", true},
                {"path", savePath},
                {"size", static_cast<int>(fileStat.st_size)},
                {"assetName", assetName}
            });
        } else {
            info.post(Bson::object{
                {"success", true},
                {"path", savePath},
                {"assetName", assetName}
            });
        }
        
    } catch (const std::exception& e) {
        info.post(Bson::object{
            {"success", false},
            {"error", e.what()}
        });
    }
}

// 获取当前配置
void JSUpdate::getCurrentConfig(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 0);
        
        UpdateConfig cfg = getConfig();
        
        info.GetReturnValue().Set(Bson::object{
            {"owner", cfg.owner},
            {"repo", cfg.repo},
            {"downloadPath", cfg.downloadPath},
            {"currentVersion", cfg.currentVersion},
            {"filterPattern", cfg.filterPattern}
        });
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

// 清理下载目录
void JSUpdate::cleanup(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() <= 1);
        
        int maxAgeDays = 7; // 默认保留7天内的文件
        if (info.Length() == 1 && info[0].is_int32()) {
            maxAgeDays = info[0].int32_value();
        }
        
        UpdateConfig cfg = getConfig();
        
        int deletedCount = 0;
        int errorCount = 0;
        std::time_t now = std::time(nullptr);
        std::time_t cutoffTime = now - (maxAgeDays * 24 * 3600);
        
        try {
            for (const auto& entry : fs::directory_iterator(cfg.downloadPath)) {
                if (fs::is_regular_file(entry.path())) {
                    auto lastWriteTime = fs::last_write_time(entry.path());
                    auto timeT = decltype(lastWriteTime)::clock::to_time_t(lastWriteTime);
                    
                    if (timeT < cutoffTime) {
                        if (fs::remove(entry.path())) {
                            deletedCount++;
                        } else {
                            errorCount++;
                        }
                    }
                }
            }
            
            info.GetReturnValue().Set(Bson::object{
                {"success", true},
                {"deleted", deletedCount},
                {"errors", errorCount}
            });
            
        } catch (const fs::filesystem_error& e) {
            info.GetReturnValue().Set(Bson::object{
                {"success", false},
                {"error", e.what()}
            });
        }
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

JSValue createUpdate(JQModuleEnv* env)
{
    JQFunctionTemplateRef tpl = JQFunctionTemplate::New(env, "Update");
    
    // 设置对象创建器
    tpl->InstanceTemplate()->setObjectCreator([]() {
        return new JSUpdate();
    });
    
    // 设置对象析构器
    tpl->InstanceTemplate()->setObjectDestroyer([](void* data) {
        delete static_cast<JSUpdate*>(data);
    });
    
    // 注册方法
    tpl->SetProtoMethod("setRepo", &JSUpdate::setRepo);
    tpl->SetProtoMethod("check", &JSUpdate::check);
    tpl->SetProtoMethod("getConfig", &JSUpdate::getCurrentConfig);  // 注意这里重命名了
    tpl->SetProtoMethod("cleanup", &JSUpdate::cleanup);
    tpl->SetProtoMethodPromise("download", &JSUpdate::download);
    
    // 初始化模板
    JSUpdate::InitTpl(tpl);
    
    return tpl->CallConstructor();
}