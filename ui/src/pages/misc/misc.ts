import { defineComponent } from 'vue';
import { showSuccess, showError } from '../../components/ToastMessage';

export type miscOptions = {};

export default defineComponent({
    data() {
        return {
            $page: {} as FalconPage<miscOptions>,

            // 亮度
            brightness: 50,

            // 亮屏时间 slider index
            brightTimeIndex: 2,

            // 手电
            torchOn: false,

            // 显示文本
            brightTimeText: '1 小时',
        };
    },

    methods: {
        /** 执行 shell（仿 shell 页面写法） */
        runShell(cmd: string) {
            try {
                // shell 页面就是通过 navTo 执行
                $falcon.navTo('shell', { cmd });
                showSuccess(cmd);
            } catch (e) {
                showError('执行失败');
            }
        },

        /** 屏幕亮度 */
        onBrightnessChange(e: any) {
            const value = e.detail.value;
            this.brightness = value;
            this.runShell(`hal-screen set ${value}`);
        },

        /** 亮屏时间 */
        onBrightTimeChange(e: any) {
            const index = e.detail.value;
            this.brightTimeIndex = index;

            const map = [
                { sec: 30, text: '30 秒' },
                { sec: 1800, text: '30 分钟' },
                { sec: 3600, text: '1 小时' },
                { sec: 7200, text: '2 小时' },
                { sec: 10800, text: '3 小时' },
                { sec: 2147483647, text: '无限' },
            ];

            const item = map[index];
            this.brightTimeText = item.text;
            this.runShell(`hal-screen bright_time ${item.sec}`);
        },

        /** 手电切换 */
        toggleTorch() {
            this.torchOn = !this.torchOn;
            this.runShell(`led_utils ${this.torchOn ? 1 : 0}`);
        },
    }
});
