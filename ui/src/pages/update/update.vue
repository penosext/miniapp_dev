<template>
<div>
<scroller class="container" scroll-direction="vertical" :show-scrollbar="true">

<div class="section">
<text class="section-title">软件更新</text>
<div class="item">
<text class="item-text">更新状态:</text>
<text :class="'update-status ' + statusClass">{{statusText}}</text>
<text @click="forceCheck" class="btn btn-primary">检查更新</text>
</div>

<div v-if="errorMessage" class="item">
<text class="item-text" style="color:#dc3545;">错误:</text>
<text class="item-text" style="color:#dc3545;flex:1;">{{errorMessage}}</text>
</div>
</div>

<div class="section">
<text class="section-title">下载设置</text>

<div class="mirror-settings">
<div class="mirror-slider-container">
<text class="mirror-slider-label">镜像源:</text>
<scroller class="mirror-slider-scroller" scroll-direction="horizontal" :show-scrollbar="false">
<div class="mirror-slider-content">
<text v-for="mirror in mirrors"
:key="mirror.id"
:class="'mirror-slider-item ' + (selectedMirror===mirror.id?'mirror-slider-item-selected':'')"
@click="selectMirror(mirror.id)">{{mirror.buttonName}}</text>
</div>
</scroller>
</div>

<div class="mirror-status-info">
<text class="mirror-current">{{currentMirror.name}}</text>
<text :class="'mirror-status ' + (useMirror?'mirror-status-active':'mirror-status-disabled')">{{useMirror?'镜像加速已启用':'镜像加速未启用'}}</text>
</div>
</div>
</div>

<div v-if="latestVersion" class="section">
<text class="section-title">版本信息</text>
<div class="version-info">
<div class="version-line">
<text class="version-label">当前版本:</text>
<text class="version-value version-old">{{currentVersion}} 
<span v-if="currentVersion === latestVersion" class="version-tag tag-latest">最新</span>
<span v-else class="version-tag tag-current">当前</span>
</text>
</div>
<div class="version-line">
<text class="version-label">最新版本:</text>
<text class="version-value version-new">{{latestVersion}} 
<span class="version-tag tag-latest">最新</span>
</text>
</div>
<div v-if="fileSize>0" class="version-line">
<text class="version-label">文件大小:</text>
<text class="version-value">{{formattedFileSize}}</text>
</div>
</div>
</div>

<div v-if="releaseNotes" class="section">
<text class="section-title">更新说明</text>
<scroller class="release-notes" scroll-direction="vertical">
<text style="color:#ffffff;">{{releaseNotes}}</text>
</scroller>
</div>

<div class="section">
<text class="section-title">操作</text>

<div class="item">
<text v-if="hasUpdate&&status==='available'" @click="downloadUpdate" class="btn btn-success">下载并安装最新版</text>
<text v-else-if="status==='downloading'||status==='installing'" class="btn btn-disabled" style="opacity:0.5;">正在处理...</text>
<text v-else class="btn btn-disabled" style="opacity:0.5;">暂无更新</text>
</div>

<div class="operations-grid">
<text @click="openGitHub" class="operation-btn operation-btn-info">GitHub页面</text>
<text @click="showDeviceInfo" class="operation-btn operation-btn-warning">设备信息</text>
</div>
</div>

<!-- 历史版本下载区域 -->
<div v-if="allVersions.length > 0" class="section">
<text class="section-title">历史版本下载</text>
<text style="font-size:12px;color:#888888;margin-bottom:10px;line-height:16px;">
  注：可以下载历史版本，下载后点击"查看路径"获取文件位置，然后手动安装<br>
  最新版本会标记为<span style="color:#28a745;">绿色</span>，当前版本标记为<span style="color:#ffc107;">黄色</span>
</text>

<scroller class="history-scroll-area" scroll-direction="vertical" :show-scrollbar="true">
<div v-for="version in allVersions" :key="version.version" class="history-item">
<!-- 版本标题行 -->
<div class="history-header" @click="toggleVersionDetails(version.version)">
<div class="history-version-info">
<text :style="{
  color: version.isLatest ? '#28a745' : 
         version.version === currentVersion ? '#ffc107' : '#ffffff',
  fontSize: '14px',
  fontWeight: version.isLatest ? 'bold' : 'normal'
}">
  {{version.isLatest ? '最新版 v' + version.version : 'v' + version.version}}
  <text v-if="version.isLatest" class="version-tag tag-latest">最新</text>
  <text v-else-if="version.version === currentVersion" class="version-tag tag-current">当前</text>
</text>
<text class="version-date">
  {{version.releaseDate || formatDate(version.date)}}
  <text v-if="getDownloadedVersion(version.version)" style="color:#28a745;margin-left:8px;">✓ 已下载</text>
</text>
</div>

<!-- 下载按钮 -->
<text v-if="version.version !== currentVersion"
  @click.stop="downloadHistoryVersion(version)"
  :class="'history-download-btn ' + 
    (downloadingHistoryVersion === version.version ? 'btn-disabled' : '')"
  style="min-width:60px;text-align:center;">
  {{downloadingHistoryVersion === version.version ? '下载中...' : '下载'}}
</text>
<text v-else class="btn-disabled" style="opacity:0.5;min-width:60px;text-align:center;">
  当前版本
</text>
</div>

<!-- 版本详情（点击展开） -->
<div v-if="expandedVersions.includes(version.version)" class="history-details">
<!-- 文件信息 -->
<div class="version-line" style="margin-top:5px;">
<text class="version-label">文件大小:</text>
<text class="version-value">{{formatFileSize(version.fileSize)}}</text>
</div>

<!-- 更新时间 -->
<div class="version-line">
<text class="version-label">更新时间:</text>
<text class="version-value">{{formatDate(version.date)}}</text>
</div>

<!-- 文件名称 -->
<div class="version-line">
<text class="version-label">文件名称:</text>
<text class="version-value" style="font-size:12px;color:#aaaaaa;">{{version.assetName || '未知'}}</text>
</div>

<!-- 操作按钮 -->
<div class="history-actions" v-if="getDownloadedVersion(version.version)">
<text @click="showInstallPath(version.version)" 
  class="operation-btn operation-btn-info" style="flex:1;text-align:center;">
  查看路径
</text>
<text @click="installHistoryVersion(getDownloadedVersion(version.version)!.filePath, version.version)"
  class="operation-btn operation-btn-success" style="flex:1;text-align:center;">
  安装此版本
</text>
</div>

<!-- 更新说明预览 -->
<div v-if="version.notes" style="margin-top:10px;padding-top:10px;border-top:1px solid #333;">
<text class="version-label" style="margin-bottom:5px;">更新说明:</text>
<text style="font-size:12px;color:#aaaaaa;line-height:16px;max-height:80px;overflow:hidden;">
  {{version.notes.substring(0, 200)}}{{version.notes.length > 200 ? '...' : ''}}
</text>
</div>
</div>
</div>
</scroller>
</div>

<!-- 已下载历史版本 -->
<div v-if="downloadedVersions.length > 0" class="section">
<text class="section-title">已下载的历史版本</text>
<text style="font-size:12px;color:#888888;margin-bottom:10px;line-height:16px;">
  点击"安装"后，请重启应用生效。最多保留最近5个下载记录。
</text>

<div v-for="item in downloadedVersions.slice(0, 5)" :key="item.filePath" 
  class="downloaded-item" style="margin-bottom:8px;">
<div class="downloaded-item-header">
<text class="downloaded-version-label">v{{item.version}} ({{item.deviceModel}})</text>
<text class="downloaded-time">{{formatDate(item.downloadTime)}}</text>
</div>

<div class="version-line">
<text class="version-label">文件大小:</text>
<text class="version-value">{{formatFileSize(item.fileSize)}}</text>
</div>

<div style="flex-direction:row;gap:5px;margin-top:10px;">
<text @click="showFilePath(item.filePath)" 
  class="operation-btn operation-btn-info" style="flex:1;text-align:center;">
  查看文件
</text>
<text @click="installHistoryVersion(item.filePath, item.version)"
  class="operation-btn operation-btn-success" style="flex:1;text-align:center;">
  安装
</text>
</div>
</div>

<div style="flex-direction:row;justify-content:center;margin-top:10px;">
<text @click="clearDownloadedVersions" 
  class="operation-btn operation-btn-danger" style="font-size:12px;padding:5px 15px;">
  清空下载记录
</text>
</div>
</div>

<div class="section">
<text class="section-title">使用说明</text>
<text style="font-size:14px;color:#888888;line-height:20px;padding:5px;">
1. 点击"检查更新"按钮获取最新版本信息<br>
2. 左右滑动选择镜像源，点击按钮切换<br>
3. 如果有新版本，点击"下载并安装更新"按钮<br>
4. 历史版本可以下载后手动安装<br>
5. 下载完成后会自动安装或提示安装命令<br>
6. 安装完成后请重启应用生效<br>
7. 如果自动更新失败，可以手动下载安装
</text>
</div>

</scroller>
<Loading/>
<ToastMessage/>
</div>
</template>

<style lang="less" scoped>
@import url('update.less');
</style>

<script>
import update from './update';
import Loading from '../../components/Loading.vue';
import ToastMessage from '../../components/ToastMessage.vue';

export default {
  ...update,
  components: { Loading, ToastMessage },
  
  data() {
    return {
      ...update.data(),
    };
  },

  methods: {
    ...update.methods,
  }
};
</script>
