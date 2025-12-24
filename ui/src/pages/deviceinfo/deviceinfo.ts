import { defineComponent } from 'vue';
import { Shell } from 'langningchen';

// 设备信息接口
interface DeviceInfo {
  ipAddress?: string;
  deviceId?: string;
  systemInfo?: {
    model?: string;
    version?: string;
    kernel?: string;
  };
  networkInfo?: {
    interfaces?: string;
    connections?: string;
  };
  storageInfo?: {
    total?: string;
    used?: string;
    free?: string;
  };
  timestamp?: number;
  error?: string;
}

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,
      
      // 加载状态
      isLoading: true,
      isRefreshing: false,
      shellInitialized: false,
      
      // 设备信息
      deviceInfo: {} as DeviceInfo,
      
      // Shell模块引用
      shellModule: null as any,
    };
  },

  mounted() {
    console.log('DeviceInfo页面开始加载...');
    
    // 设置页面返回键处理
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on("backpressed", this.handleBackPress);
    
    // 初始化并加载设备信息
    this.initializeAndLoad();
  },

  beforeDestroy() {
    this.$page.$npage.off("backpressed", this.handleBackPress);
  },

  methods: {
    // 初始化Shell并加载设备信息
    async initializeAndLoad() {
      this.isLoading = true;
      
      try {
        // 初始化Shell模块
        await this.initializeShell();
        
        // 获取设备信息
        await this.fetchDeviceInfo();
      } catch (error: any) {
        console.error('加载设备信息失败:', error);
        this.deviceInfo.error = `加载失败: ${error.message || '未知错误'}`;
      } finally {
        this.isLoading = false;
        this.isRefreshing = false;
      }
    },
    
    // 初始化Shell模块
    async initializeShell() {
      try {
        console.log('初始化Shell模块...');
        
        // 检查Shell对象是否存在
        if (!Shell) {
          throw new Error('Shell对象未定义');
        }
        
        // 检查initialize方法是否存在
        if (typeof Shell.initialize !== 'function') {
          throw new Error('Shell.initialize方法不存在');
        }
        
        // 初始化Shell
        await Shell.initialize();
        
        this.shellModule = Shell;
        this.shellInitialized = true;
        console.log('Shell模块初始化成功');
        
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        throw new Error(`Shell初始化失败: ${error.message}`);
      }
    },
    
    // 获取设备信息
    async fetchDeviceInfo() {
      if (!this.shellInitialized || !Shell) {
        throw new Error('Shell模块未初始化');
      }
      
      try {
        // 清空之前的设备信息
        this.deviceInfo = {
          timestamp: Date.now()
        };
        
        console.log('开始获取设备信息...');
        
        // 1. 获取IP地址（主要信息）- 使用新的命令
        try {
          // 使用新的命令获取wlan0接口的IP地址
          const ipResult = await Shell.exec("ip addr show wlan0 2>/dev/null | grep -m1 'inet ' | awk '{print $2}' | cut -d/ -f1");
          const ipAddress = ipResult.trim();
          
          if (ipAddress) {
            this.deviceInfo.ipAddress = ipAddress;
            console.log('IP地址:', this.deviceInfo.ipAddress);
          } else {
            // 如果wlan0没有IP，尝试eth0接口
            console.log('wlan0接口未获取到IP，尝试eth0接口...');
            const ethIpResult = await Shell.exec("ip addr show eth0 2>/dev/null | grep -m1 'inet ' | awk '{print $2}' | cut -d/ -f1");
            const ethIpAddress = ethIpResult.trim();
            
            if (ethIpAddress) {
              this.deviceInfo.ipAddress = ethIpAddress;
              console.log('eth0接口IP地址:', this.deviceInfo.ipAddress);
            } else {
              // 如果都没有，尝试获取所有接口的第一个IPv4地址
              console.log('尝试获取所有接口的IP地址...');
              const allIpResult = await Shell.exec("ip -4 addr | grep -m1 'inet ' | awk '{print $2}' | cut -d/ -f1");
              const allIpAddress = allIpResult.trim();
              
              this.deviceInfo.ipAddress = allIpAddress || '未获取到IP地址';
              console.log('所有接口IP地址:', this.deviceInfo.ipAddress);
            }
          }
        } catch (ipError: any) {
          console.warn('获取IP地址失败:', ipError);
          this.deviceInfo.ipAddress = '获取失败，尝试备用方法...';
          
          // 备用方法：尝试使用ifconfig
          try {
            const ifconfigResult = await Shell.exec('ifconfig 2>/dev/null || ip addr 2>/dev/null');
            this.deviceInfo.ipAddress = this.extractIPFromIfconfig(ifconfigResult) || '未获取到IP地址';
          } catch (altError: any) {
            this.deviceInfo.ipAddress = `错误: ${altError.message}`;
          }
        }
        
        // 2. 获取设备ID
        try {
          const deviceIdResult = await Shell.exec('cat /proc/sys/kernel/random/uuid || cat /etc/machine-id');
          this.deviceInfo.deviceId = deviceIdResult.trim().substring(0, 32);
        } catch (idError: any) {
          console.warn('获取设备ID失败:', idError);
          this.deviceInfo.deviceId = '未知';
        }
        
        // 3. 获取系统信息
        try {
          const modelResult = await Shell.exec('uname -m');
          const versionResult = await Shell.exec('uname -r');
          const kernelResult = await Shell.exec('uname -s');
          
          this.deviceInfo.systemInfo = {
            model: modelResult.trim(),
            version: versionResult.trim(),
            kernel: kernelResult.trim()
          };
        } catch (sysError: any) {
          console.warn('获取系统信息失败:', sysError);
          this.deviceInfo.systemInfo = {
            model: '未知',
            version: '未知',
            kernel: '未知'
          };
        }
        
        // 4. 获取网络信息
        try {
          const ifaceResult = await Shell.exec('ip -4 addr show 2>/dev/null || ifconfig -a 2>/dev/null');
          this.deviceInfo.networkInfo = {
            interfaces: ifaceResult.trim()
          };
        } catch (netError: any) {
          console.warn('获取网络信息失败:', netError);
          this.deviceInfo.networkInfo = {
            interfaces: '获取失败'
          };
        }
        
        // 5. 获取存储信息
        try {
          const storageResult = await Shell.exec('df -h /');
          const storageLines = storageResult.split('\n');
          if (storageLines.length > 1) {
            const storageParts = storageLines[1].split(/\s+/);
            this.deviceInfo.storageInfo = {
              total: storageParts[1] || '未知',
              used: storageParts[2] || '未知',
              free: storageParts[3] || '未知'
            };
          } else {
            this.deviceInfo.storageInfo = {
              total: '未知',
              used: '未知',
              free: '未知'
            };
          }
        } catch (storageError: any) {
          console.warn('获取存储信息失败:', storageError);
          this.deviceInfo.storageInfo = {
            total: '未知',
            used: '未知',
            free: '未知'
          };
        }
        
        console.log('设备信息获取完成:', this.deviceInfo);
        
      } catch (error: any) {
        console.error('获取设备信息过程中出错:', error);
        this.deviceInfo.error = `获取信息失败: ${error.message || '未知错误'}`;
        throw error;
      }
    },
    
    // 从ifconfig输出中提取IP地址
    extractIPFromIfconfig(ifconfigOutput: string): string {
      if (!ifconfigOutput) return '';
      
      // 尝试匹配IPv4地址
      const ipv4Regex = /inet (?:addr:)?(\d+\.\d+\.\d+\.\d+)/g;
      const matches = ifconfigOutput.match(ipv4Regex);
      
      if (matches && matches.length > 0) {
        // 过滤掉127.0.0.1本地回环地址
        const nonLoopbackIps = matches.filter(ip => !ip.includes('127.0.0.1'));
        if (nonLoopbackIps.length > 0) {
          // 提取第一个非回环地址的IP
          const match = nonLoopbackIps[0].match(/(\d+\.\d+\.\d+\.\d+)/);
          return match ? match[1] : '';
        }
      }
      
      return '';
    },
    
    // 刷新设备信息
    async refreshInfo() {
      if (this.isRefreshing) return;
      
      this.isRefreshing = true;
      await this.fetchDeviceInfo();
      this.isRefreshing = false;
    },
    
    // 处理返回键
    handleBackPress() {
      this.$page.finish();
    },
    
    // 格式化IP地址显示
    formatIP(ip: string | undefined): string {
      if (!ip) return '未获取到';
      
      // 如果IP是错误信息，直接返回
      if (ip.includes('错误') || ip.includes('失败')) {
        return ip;
      }
      
      return ip;
    }
  }
});
