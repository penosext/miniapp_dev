<template>
<div>
<scroller class="container" scroll-direction="vertical" :show-scrollbar="true">

<!-- 更新状态卡片 -->
<div class="update-status-card">
<div class="update-status-container">
<div class="status-text-container">
<text class="status-label">更新状态</text>
<text :class="'status-text ' + statusClass">{{statusText}}</text>
</div>
<text @click="forceCheck" class="btn btn-primary">检查更新</text>
</div>

<!-- 设备信息 -->
<div v-if="deviceModel" class="device-info-card" style="margin-top: 10px;">
<text class="device-info-title">设备信息</text>
<text class="device-info-content">型号: {{deviceModel}} | 版本: v{{currentVersion}}</text>
</div>
</div>

<!-- 错误信息 -->
<div v-if="errorMessage" class="error-card">
<text class="error-title">错误信息</text>
<text class="error-content">{{errorMessage}}</text>
</div>

<!-- 镜像源设置卡片 -->
<div class="mirror-settings-card">
<text class="section-title">下载设置</text>

<div class="mirror-slider-container">
<text class="mirror-slider-label">选择镜像源:</text>
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
<text class="mirror-current">当前源: {{currentMirror.name}}</text>
<text :class="'mirror-status ' + (useMirror?'mirror-status-active':'mirror-status-disabled')">
{{useMirror?'镜像加速':' 直接下载'}}
</text>
</div>
</div>

<!-- 版本信息卡片 -->
<div v-if="latestVersion" class="version-info-card">
<text class="section-title">版本信息</text>
<div class="version-line">
<text class="version-label">当前版本</text>
<text class="version-value version-old">v{{currentVersion}}</text>
</div>
<div class="version-line">
<text class="version-label">最新版本</text>
<text class="version-value version-new">v{{latestVersion}}</text>
</div>
<div v-if="fileSize>0" class="version-line">
<text class="version-label">文件大小</text>
<text class="version-value file-size">{{formattedFileSize}}</text>
</div>
<div v-if="currentDeviceFilename" class="version-line">
<text class="version-label">目标文件</text>
<text class="version-value">{{currentDeviceFilename}}</text>
</div>
</div>

<!-- 更新说明卡片 -->
<div v-if="releaseNotes" class="release-notes-card">
<text class="release-notes-title">更新说明</text>
<scroller class="release-notes-content" scroll-direction="vertical">
<text>{{releaseNotes}}</text>
</scroller>
</div>

<!-- 操作按钮卡片 -->
<div class="operations-card">
<text class="section-title">更新操作</text>

<div class="operations-grid">
<text v-if="hasUpdate&&status==='available'" @click="downloadUpdate" class="operation-btn operation-btn-success">下载并安装</text>
<text v-else-if="status==='downloading'" class="operation-btn operation-btn-disabled">正在下载...</text>
<text v-else-if="status==='installing'" class="operation-btn operation-btn-disabled">正在安装...</text>
<text v-else class="operation-btn operation-btn-disabled">暂无更新</text>

<text @click="openGitHub" class="operation-btn operation-btn-info">GitHub页面</text>
<text @click="showDeviceInfo" class="operation-btn operation-btn-primary">设备信息</text>
</div>
</div>

<!-- 使用说明卡片 -->
<div class="instructions-card">
<text class="instructions-title">使用说明</text>
<text class="instructions-content">
1. 点击"检查更新"按钮获取最新版本信息
2. 左右滑动选择镜像源，点击按钮切换
3. 如果有新版本，点击"下载并安装更新"按钮
4. 下载完成后会自动安装
5. 安装完成后请重启应用
6. 如果自动更新失败，可以手动下载安装
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
export default{...update,components:{Loading,ToastMessage}};
</script>