// Copyright (C) 2025 Langning Chen
//
// This file is part of miniapp.
//
// miniapp is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// miniapp is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with miniapp.  If not, see <https://www.gnu.org/licenses/>.

#pragma once

#include <string>
#include <functional>
#include <memory>
#include <mutex>
#include <atomic>
#include <vector>
#include <filesystem>
#include "Fetch.hpp"
#include <nlohmann/json.hpp>
#include <Exceptions/AssertFailed.hpp>  // 添加 ASSERT 宏

namespace fs = std::filesystem;

struct UpdateInfo {
    std::string version;
    std::string name;
    std::string description;
    std::string release_date;
    std::string download_url;
    std::string checksum_sha256;
    size_t file_size;
    std::string min_system_version;
    std::string release_notes;
    std::string manifest_path;
    
    static UpdateInfo fromJson(const nlohmann::json& json);
    nlohmann::json toJson() const;
    
    bool isNewerThan(const std::string& other_version) const;
};

struct DownloadProgress {
    size_t downloaded_bytes;
    size_t total_bytes;
    double percentage;
    double speed_kbps;
    std::string status;
    std::string file_path;
};

using DownloadCallback = std::function<void(const DownloadProgress& progress)>;

class Update {
private:
    std::string current_release_url;
    std::string update_json_url;
    std::string download_directory;
    std::string manifest_directory;
    std::mutex download_mutex;
    std::atomic<bool> is_downloading{false};
    std::shared_ptr<std::atomic<bool>> cancel_download;
    
public:
    Update();
    ~Update();
    
    void setManifestDirectory(const std::string& directory);
    std::string getCurrentVersion() const;
    std::string getAppName() const;
    
    void setReleaseUrl(const std::string& release_url);
    std::string getReleaseUrl() const;
    
    void setDownloadDirectory(const std::string& directory);
    std::string getDownloadDirectory() const;
    
    UpdateInfo checkForUpdates();
    UpdateInfo getUpdateInfo(const std::string& update_json_url);
    
    bool downloadUpdate(const UpdateInfo& update_info, 
                       DownloadCallback progress_callback = nullptr);
    
    bool installUpdate(const std::string& file_path);
    
    bool updateManifest(const UpdateInfo& update_info);
    
    void cancelDownload();
    bool isDownloading() const;
    
    bool verifyFileIntegrity(const std::string& file_path, 
                            const std::string& expected_checksum);
    
    void cleanupOldVersions(const std::string& keep_version);
    
    bool verifyFileSize(const std::string& file_path, size_t expected_size);
};
