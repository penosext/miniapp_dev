// src/pages/shellSettings/shellSettings.ts
import { defineComponent } from 'vue';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils';
import { showInfo } from '../../components/ToastMessage';
import { Shell } from 'langningchen';

const TOOL_DIR = '/userdisk/paper/toolshell';
const ENABLE_KEY = 'toolshell_enable';

type ScriptItem = {
  name: string;
  filename: string;
  enabled: boolean;
};

export default defineComponent({
  data() {
    return {
      scripts: [] as ScriptItem[],
      enableMap: {} as Record<string, boolean>,
      shellInitialized: false,
    };
  },

  async mounted() {
    try {
      // 确保 shell 初始化 可以直接 reuse Shell
      if (Shell && typeof Shell.initialize === 'function') {
        await Shell.initialize();
        this.shellInitialized = true;
      }
    } catch {
      // ignore
    }

    await this.ensureToolDir();
    await this.loadEnableMap();
    await this.scanScripts();

    // 如果路由带 create 标志（从工具栏直接新建），打开新建流程
    const opts = (this.$page.loadOptions as any) || {};
    if (opts.create) {
      this.createScript();
    }
  },

  methods: {
    exec(cmd: string) {
      // 直接用 Shell.exec
      if (Shell && Shell.exec) {
        return Shell.exec(cmd);
      }
      return Promise.reject(new Error('Shell 不可用'));
    },

    async ensureToolDir() {
      try {
        await this.exec(`mkdir -p ${TOOL_DIR}`);
      } catch (e) {
        console.warn('ensureToolDir 失败', e);
      }
    },

    async loadEnableMap() {
      try {
        const res = await $falcon.jsapi.storage.getStorage({ key: ENABLE_KEY });
        this.enableMap = JSON.parse(res.data || '{}');
      } catch {
        this.enableMap = {};
      }
    },

    async saveEnableMap() {
      await $falcon.jsapi.storage.setStorage({
        key: ENABLE_KEY,
        data: JSON.stringify(this.enableMap),
      });
    },

    async scanScripts() {
      try {
        const res = await this.exec(`ls -1 ${TOOL_DIR}`).catch(() => '');
        const lines = (res || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const shFiles = lines.filter(l => l.endsWith('.sh'));
        this.scripts = shFiles.map(f => {
          const name = f.replace(/\.sh$/, '');
          return {
            name,
            filename: f,
            enabled: !!this.enableMap[name],
          };
        });
      } catch (e) {
        console.warn('scanScripts 失败', e);
        this.scripts = [];
      }
    },

    // 三步新建脚本（用户输入名字 -> 输入内容 -> 生成）
    createScript() {
      let scriptName = '';
      let scriptContent = '';

      // Step 1: 名称（无需 .sh）
      this.notice('请输入 Shell 脚本名称（无需 .sh 后缀）', () => {
        openSoftKeyboard(
          () => '',
          async (name) => {
            name = (name || '').trim();
            if (!name) return;

            // 验证合法性（简单防护）
            if (name.includes('/') || name.includes('..')) {
              showInfo('名称不合法，不能包含 / 或 ..');
              return;
            }
            scriptName = name;

            // Step 2: 内容
            this.notice('请输入 Shell 脚本内容', () => {
              openSoftKeyboard(
                () => '',
                async (content) => {
                  content = content || '';
                  scriptContent = content;

                  // Step 3: 确认并写文件
                  const filename = `${scriptName}.sh`;
                  const path = `${TOOL_DIR}/${filename}`;

                  // 为了安全地写入包含单引号的内容，采用 here-doc 风格写入
                  // echo '...' > file 中处理复杂字符时可能出错，使用 cat <<'EOF' > file ... EOF
                  const safeCmd = `cat <<'EOF' > ${path}\n${scriptContent}\nEOF && chmod +x ${path}`;
                  try {
                    await this.exec(safeCmd);
                    // 新建后默认未启用
                    this.enableMap[scriptName] = false;
                    await this.saveEnableMap();
                    await this.scanScripts();
                    showInfo(`脚本 ${filename} 已创建`);
                  } catch (e: any) {
                    console.error('写文件失败', e);
                    showInfo(`创建失败: ${e?.message || e}`);
                  }
                }
              );
            });
          }
        );
      });
    },

    async enable(item: ScriptItem) {
      this.enableMap[item.name] = true;
      item.enabled = true;
      await this.saveEnableMap();
      // notify shell page via storage; shell will rescan on show
      showInfo(`已启用 ${item.name}`);
    },

    async disable(item: ScriptItem) {
      this.enableMap[item.name] = false;
      item.enabled = false;
      await this.saveEnableMap();
      showInfo(`已停用 ${item.name}`);
    },

    notice(text: string, ok: () => void) {
      // 用项目内 Toast/提示代替弹窗消息
      showInfo(text);
      setTimeout(ok, 250); // 触发弹出软键盘
    },
  },
});
