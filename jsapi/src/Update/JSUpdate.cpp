#include "JSUpdate.hpp"
#include "Fetch.hpp"
#include "Exceptions/AssertFailed.hpp"
#include "Exceptions/NetworkError.hpp"
#include "strUtils.hpp"
#include <iostream>
#include <sstream>
#include <regex>
#include <fstream>
#include <sys/stat.h>
#include <unistd.h>
#include <sys/types.h>
#include <dirent.h>
#include <ctime>

using namespace JQUTIL_NS;

JSUpdate::JSUpdate() : 
    owner("octocat"),
    repo("Hello-World"),
    downloadPath("/userdisk/downloads"),
    currentVersion("1.0.0"),
    filterPattern(".*\\.(tar\\.gz|zip|apk|bin)$")
{
    // 创建下载目录
    system(("mkdir -p " + downloadPath).c_str());
}

JSUpdate::~JSUpdate() = default;

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
        options.timeout = 300;
        options.headers["User-Agent"] = "miniapp-updater/1.0";
        
        Response response = Fetch::fetch(url, options);
        
        if (response.isOk()) {
            // 确保目录存在
            std::string dirCmd = "mkdir -p $(dirname " + savePath + ")";
            system(dirCmd.c_str());
            
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
        JSContext* ctx = info.GetContext();
        
        // 检查是否是对象
        if (!JS_IsObject(ctx, info[0])) {
            info.GetReturnValue().ThrowInternalError("First argument must be an object");
            return;
        }
        
        JSValue configObj = info[0];
        
        std::lock_guard<std::mutex> lock(configMutex);
        
        // 获取owner
        JSValue ownerVal = JS_GetPropertyStr(ctx, configObj, "owner");
        if (!JS_IsUndefined(ownerVal)) {
            const char* ownerStr = JS_ToCString(ctx, ownerVal);
            if (ownerStr) {
                owner = ownerStr;
                JS_FreeCString(ctx, ownerStr);
            }
            JS_FreeValue(ctx, ownerVal);
        }
        
        // 获取repo
        JSValue repoVal = JS_GetPropertyStr(ctx, configObj, "repo");
        if (!JS_IsUndefined(repoVal)) {
            const char* repoStr = JS_ToCString(ctx, repoVal);
            if (repoStr) {
                repo = repoStr;
                JS_FreeCString(ctx, repoStr);
            }
            JS_FreeValue(ctx, repoVal);
        }
        
        // 获取下载路径
        JSValue pathVal = JS_GetPropertyStr(ctx, configObj, "downloadPath");
        if (!JS_IsUndefined(pathVal)) {
            const char* pathStr = JS_ToCString(ctx, pathVal);
            if (pathStr) {
                downloadPath = pathStr;
                // 创建目录
                std::string cmd = "mkdir -p " + downloadPath;
                system(cmd.c_str());
                JS_FreeCString(ctx, pathStr);
            }
            JS_FreeValue(ctx, pathVal);
        }
        
        // 获取当前版本
        JSValue versionVal = JS_GetPropertyStr(ctx, configObj, "currentVersion");
        if (!JS_IsUndefined(versionVal)) {
            const char* versionStr = JS_ToCString(ctx, versionVal);
            if (versionStr) {
                currentVersion = versionStr;
                JS_FreeCString(ctx, versionStr);
            }
            JS_FreeValue(ctx, versionVal);
        }
        
        // 获取文件过滤模式
        JSValue filterVal = JS_GetPropertyStr(ctx, configObj, "filterPattern");
        if (!JS_IsUndefined(filterVal)) {
            const char* filterStr = JS_ToCString(ctx, filterVal);
            if (filterStr) {
                filterPattern = filterStr;
                JS_FreeCString(ctx, filterStr);
            }
            JS_FreeValue(ctx, filterVal);
        }
        
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

// 检查更新（异步版本）
void JSUpdate::check(JQAsyncInfo& info) {
    try {
        std::lock_guard<std::mutex> lock(configMutex);
        
        // 构建GitHub API URL
        std::string url = "https://api.github.com/repos/" + owner + "/" + repo + "/releases/latest";
        
        FetchOptions options;
        options.headers["User-Agent"] = "miniapp-updater/1.0";
        options.headers["Accept"] = "application/vnd.github.v3+json";
        options.timeout = 30;
        
        Response response = Fetch::fetch(url, options);
        
        if (!response.isOk()) {
            info.post(Bson::object{
                {"success", false},
                {"error", "HTTP " + std::to_string(response.status)}
            });
            return;
        }
        
        try {
            nlohmann::json releaseInfo = nlohmann::json::parse(response.body);
            
            Bson::object result = {
                {"success", true},
                {"hasUpdate", false},
                {"currentVersion", currentVersion},
                {"latestVersion", ""},
                {"releaseNotes", ""},
                {"downloadUrl", ""},
                {"downloadSize", 0},
                {"publishedAt", ""}
            };
            
            if (releaseInfo.contains("tag_name")) {
                std::string latestVersion = releaseInfo["tag_name"].get<std::string>();
                result["latestVersion"] = latestVersion;
                
                // 去除版本号前的"v"前缀（如果有）
                std::string cleanVersion = latestVersion;
                if (cleanVersion.size() > 0 && cleanVersion[0] == 'v') {
                    cleanVersion = cleanVersion.substr(1);
                }
                
                // 检查是否有新版本
                if (versionGreater(cleanVersion, currentVersion)) {
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
                    std::regex filterRegex(filterPattern);
                    
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
            
            info.post(result);
            
        } catch (const nlohmann::json::parse_error& e) {
            info.post(Bson::object{
                {"success", false},
                {"error", "JSON parse error: " + std::string(e.what())}
            });
        }
        
    } catch (const std::exception& e) {
        info.post(Bson::object{
            {"success", false},
            {"error", e.what()}
        });
    }
}

// 下载更新文件（异步版本）
void JSUpdate::download(JQAsyncInfo& info) {
    try {
        std::lock_guard<std::mutex> lock(configMutex);
        
        // 先检查更新以获取下载URL
        std::string checkUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/releases/latest";
        
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
        
        nlohmann::json releaseInfo = nlohmann::json::parse(checkResponse.body);
        
        std::string downloadUrl;
        std::string assetName;
        
        if (releaseInfo.contains("assets") && releaseInfo["assets"].is_array()) {
            std::regex filterRegex(filterPattern);
            
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
        std::string savePath = downloadPath + "/" + assetName;
        
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
        
        // 确保目录存在
        std::string dirCmd = "mkdir -p " + downloadPath;
        system(dirCmd.c_str());
        
        // 保存文件
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
        
        // 获取文件大小
        struct stat fileStat;
        int fileSize = 0;
        if (stat(savePath.c_str(), &fileStat) == 0) {
            fileSize = static_cast<int>(fileStat.st_size);
        }
        
        info.post(Bson::object{
            {"success", true},
            {"path", savePath},
            {"size", fileSize},
            {"assetName", assetName}
        });
        
    } catch (const std::exception& e) {
        info.post(Bson::object{
            {"success", false},
            {"error", e.what()}
        });
    }
}

// 获取当前配置（异步版本）
void JSUpdate::getConfig(JQAsyncInfo& info) {
    try {
        std::lock_guard<std::mutex> lock(configMutex);
        
        info.post(Bson::object{
            {"owner", owner},
            {"repo", repo},
            {"downloadPath", downloadPath},
            {"currentVersion", currentVersion},
            {"filterPattern", filterPattern}
        });
        
    } catch (const std::exception& e) {
        info.post(Bson::object{
            {"success", false},
            {"error", e.what()}
        });
    }
}

// 清理下载目录（同步版本）
void JSUpdate::cleanup(JQFunctionInfo& info) {
    try {
        int maxAgeDays = 7; // 默认保留7天内的文件
        
        if (info.Length() >= 1) {
            JSContext* ctx = info.GetContext();
            // 检查是否是整数
            int isInt = JS_IsNumber(ctx, info[0]);
            if (isInt) {
                int32_t days;
                JS_ToInt32(ctx, &days, info[0]);
                if (days > 0) {
                    maxAgeDays = days;
                }
            }
        }
        
        std::lock_guard<std::mutex> lock(configMutex);
        
        int deletedCount = 0;
        int errorCount = 0;
        time_t now = time(nullptr);
        time_t cutoffTime = now - (maxAgeDays * 24 * 3600);
        
        // 使用opendir/readdir来遍历目录
        DIR* dir = opendir(downloadPath.c_str());
        if (dir) {
            struct dirent* entry;
            while ((entry = readdir(dir)) != nullptr) {
                if (entry->d_type == DT_REG) { // 普通文件
                    std::string filePath = downloadPath + "/" + entry->d_name;
                    
                    struct stat fileStat;
                    if (stat(filePath.c_str(), &fileStat) == 0) {
                        if (fileStat.st_mtime < cutoffTime) {
                            if (remove(filePath.c_str()) == 0) {
                                deletedCount++;
                            } else {
                                errorCount++;
                            }
                        }
                    }
                }
            }
            closedir(dir);
        }
        
        info.GetReturnValue().Set(Bson::object{
            {"success", true},
            {"deleted", deletedCount},
            {"errors", errorCount}
        });
        
    } catch (const std::exception& e) {
        info.GetReturnValue().Set(Bson::object{
            {"success", false},
            {"error", e.what()}
        });
    }
}

JSValue createUpdate(JQModuleEnv* env)
{
    JQFunctionTemplateRef tpl = JQFunctionTemplate::New(env, "Update");
    
    // 设置对象创建器
    tpl->InstanceTemplate()->setObjectCreator([]() {
        return new JSUpdate();
    });
    
    // 注册方法
    tpl->SetProtoMethod("setRepo", &JSUpdate::setRepo);
    tpl->SetProtoMethod("cleanup", &JSUpdate::cleanup);
    tpl->SetProtoMethodPromise("check", &JSUpdate::check);
    tpl->SetProtoMethodPromise("download", &JSUpdate::download);
    tpl->SetProtoMethodPromise("getConfig", &JSUpdate::getConfig);
    
    // 初始化模板
    JSUpdate::InitTpl(tpl);
    
    return tpl->CallConstructor();
}