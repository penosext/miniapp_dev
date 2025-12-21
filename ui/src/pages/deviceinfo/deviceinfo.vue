<!-- device.vue -->
<!--
    Copyright (C) 2025 Langning Chen

    This file is part of miniapp.

    miniapp is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    miniapp is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with miniapp.  If not, see <https://www.gnu.org/licenses/>.
-->

<template>
  <div>
    <scroller class="container" scroll-direction="vertical" :show-scrollbar="true">
      <!-- 设备概览 -->
      <div class="section">
        <div class="device-summary">
          <text class="device-icon">📱</text>
          <text class="device-name">{{ deviceSummary }}</text>
        </div>
        
        <div class="action-buttons">
          <text @click="refreshAllInfo" class="action-btn action-btn-primary">刷新信息</text>
          <text @click="runDiagnostics" class="action-btn action-btn-warning">系统诊断</text>
          <text @click="$falcon.navTo('index', {})" class="action-btn">返回主页</text>
        </div>
      </div>

      <!-- 系统信息 -->
      <div class="section" v-if="!isLoading && !errorMessage">
        <text class="section-title">系统信息</text>
        <div class="info-card">
          <text class="card-title">基本系统</text>
          <div class="info-row">
            <text class="info-label">设备型号:</text>
            <text class="info-value">{{ deviceModel }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">设备名称:</text>
            <text class="info-value">{{ deviceName }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">主机名:</text>
            <text class="info-value">{{ hostname }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">内核版本:</text>
            <text class="info-value">{{ kernelVersion }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">系统时间:</text>
            <text class="info-value">{{ systemTime }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">运行时间:</text>
            <text class="info-value">{{ uptime }}</text>
          </div>
        </div>

        <!-- CPU信息 -->
        <div class="info-card">
          <text class="card-title">CPU信息</text>
          <div class="info-row">
            <text class="info-label">CPU型号:</text>
            <text class="info-value">{{ cpuModel }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">CPU架构:</text>
            <text class="info-value">{{ cpuArch }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">CPU核心数:</text>
            <text class="info-value">{{ cpuCores }} 核心</text>
          </div>
          <div class="info-row">
            <text class="info-label">CPU频率:</text>
            <text class="info-value">{{ cpuFrequency }}</text>
          </div>
          <div class="section-grid">
            <div class="stat-box">
              <text class="stat-title">CPU负载</text>
              <text class="stat-value">{{ cpuLoadPercent }}%</text>
              <div class="progress-container">
                <div class="progress-bar" :style="{ width: cpuLoadPercent + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 内存信息 -->
        <div class="info-card">
          <text class="card-title">内存信息</text>
          <div class="info-row">
            <text class="info-label">总内存:</text>
            <text class="info-value">{{ formatMemory.total }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">已使用:</text>
            <text class="info-value">{{ formatMemory.used }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">可用内存:</text>
            <text class="info-value">{{ formatMemory.free }}</text>
          </div>
          <div class="section-grid">
            <div class="stat-box">
              <text class="stat-title">内存使用率</text>
              <text class="stat-value">{{ memoryUsagePercent }}%</text>
              <div class="progress-container">
                <div class="progress-bar" :style="{ width: memoryUsagePercent + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 存储信息 -->
        <div class="info-card">
          <text class="card-title">存储信息</text>
          <div class="info-row">
            <text class="info-label">总存储:</text>
            <text class="info-value">{{ formatStorage.total }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">已使用:</text>
            <text class="info-value">{{ formatStorage.used }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">可用存储:</text>
            <text class="info-value">{{ formatStorage.free }}</text>
          </div>
          <div class="section-grid">
            <div class="stat-box">
              <text class="stat-title">存储使用率</text>
              <text class="stat-value">{{ storageUsagePercent }}%</text>
              <div class="progress-container">
                <div class="progress-bar" :style="{ width: storageUsagePercent + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 网络信息 -->
        <div class="info-card">
          <text class="card-title">网络信息</text>
          <div class="info-row">
            <text class="info-label">IP地址:</text>
            <text class="info-value">{{ ipAddress }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">MAC地址:</text>
            <text class="info-value">{{ macAddress }}</text>
          </div>
          <div class="info-row">
            <text class="info-label">网络状态:</text>
            <text class="info-value">{{ networkStatus }}</text>
          </div>
        </div>

        <!-- 其他信息 -->
        <div class="info-card">
          <text class="card-title">其他信息</text>
          <div class="info-row">
            <text class="info-label">进程数:</text>
            <text class="info-value">{{ processes }} 个</text>
          </div>
          <div class="info-row">
            <text class="info-label">在线用户:</text>
            <text class="info-value">{{ users }} 个</text>
          </div>
          <div class="info-row">
            <text class="info-label">电池状态:</text>
            <text class="info-value">{{ batteryLevel }}</text>
          </div>
        </div>

        <!-- 系统命令 -->
        <div class="section">
          <text class="section-title">系统命令</text>
          <div class="operations-grid">
            <text @click="runCommand('top -n 1')" class="operation-btn operation-btn-primary">查看进程</text>
            <text @click="runCommand('df -h')" class="operation-btn operation-btn-primary">磁盘使用</text>
            <text @click="runCommand('free -h')" class="operation-btn operation-btn-primary">内存详情</text>
            <text @click="runCommand('ifconfig')" class="operation-btn operation-btn-primary">网络配置</text>
            <text @click="runCommand('dmesg | tail -20')" class="operation-btn operation-btn-warning">系统日志</text>
            <text @click="runCommand('ps aux')" class="operation-btn operation-btn-warning">所有进程</text>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-section">
        <text class="loading-text">正在获取设备信息...</text>
      </div>

      <!-- 错误状态 -->
      <div v-if="errorMessage" class="error-section">
        <text class="error-text">{{ errorMessage }}</text>
        <text @click="initializeShell" class="action-btn action-btn-danger">重试</text>
      </div>
    </scroller>

    <!-- 刷新按钮 -->
    <text @click="refreshAllInfo" class="refresh-btn">↻</text>

    <Loading />
    <ToastMessage />
  </div>
</template>

<style lang="less" scoped>
@import url('deviceinfo.less');
</style>

<script>
import device from './device';
import Loading from '../../components/Loading.vue';
import ToastMessage from '../../components/ToastMessage.vue';
export default {
    ...device,
    components: {
        Loading,
        ToastMessage
    }
}
</script>